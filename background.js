import {PrayerTimeApi} from "./popup/js/prayerTimeApi.js";
import {prayerOrder} from "./popup/js/prayerOrder.js";

const BADGE_ALARM_NAME = "updateBadge";
const BADGE_UPDATE_PERIOD_MINUTES = 1;
const NOTIFICATION_PRAYERS = ["ogle", "ikindi", "aksam", "yatsi"];

const api = new PrayerTimeApi();

function storageGet(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
}

function storageSet(payload) {
    return new Promise((resolve) => {
        chrome.storage.local.set(payload, resolve);
    });
}

function toISODateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatCityName(rawName) {
    if (!rawName) {
        return "";
    }
    const lower = rawName.toLocaleLowerCase("tr-TR");
    return lower.replace(/\p{L}+/gu, (word) => {
        return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1);
    });
}

async function ensureCityTimes(location, {forceRefresh = false} = {}) {
    const cityName = location?.cityName || formatCityName(location?.stateName);
    return api.getCityTimes(cityName, {forceRefresh});
}


function normalizeDayEntry(dateKey, entry) {
    if (!entry) {
        return null;
    }
    return {
        date: dateKey,
        times: {
            imsak: entry.imsak,
            gunes: entry.gunes,
            ogle: entry.ogle,
            ikindi: entry.ikindi,
            aksam: entry.aksam,
            yatsi: entry.yatsi
        }
    };
}

function findTimesForDate(cityData, date) {
    const key = toISODateString(date);
    if (!cityData) {
        return null;
    }
    if (Array.isArray(cityData)) {
        const entry = cityData.find((item) => item?.date?.slice(0, 10) === key);
        if (!entry) {
            return null;
        }
        if (entry.times) {
            return entry;
        }
        return normalizeDayEntry(key, entry);
    }
    const entry = cityData[key];
    return normalizeDayEntry(key, entry);
}


function parsePrayerTime(timeStr, baseDate) {
    if (!timeStr || typeof timeStr !== "string") {
        return null;
    }

    const [hourStr, minuteStr] = timeStr.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return null;
    }

    const now = new Date();
    const base = baseDate || now;
    return new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        hour,
        minute,
        0,
        0
    );
}

function getNextPrayer(times, now = new Date(), baseDateForTimes = now) {
    if (!times) {
        return null;
    }

    for (const {key} of prayerOrder) {
        const date = parsePrayerTime(times[key], baseDateForTimes);
        if (date && date > now) {
            return {key, target: date};
        }
    }

    return null;
}

function getPrayerLabel(key) {
    const match = prayerOrder.find((entry) => entry.key === key);
    return match?.label || key;
}

function formatRemainingHHmm(remainingMs) {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    // Keep badge text within 4 characters so it fits nicely.
    if (hours === 0) {
        return `0:${String(minutes).padStart(2, "0")}`; // e.g. "0:05"
    }
    if (hours < 10) {
        return `${hours}:${String(minutes).padStart(2, "0")}`; // e.g. "8:45"
    }
    return `${hours}s`; // e.g. "10s", "12s"
}

function normalizeNotificationConfig(settings) {
    const rawConfig = settings?.notificationConfig || {};
    const normalized = {};
    NOTIFICATION_PRAYERS.forEach((key) => {
        const value = Number(rawConfig[key] ?? 0);
        if (Number.isFinite(value) && value > 0) {
            normalized[key] = value;
        }
    });
    return normalized;
}

async function maybeSendNotifications(now, cityData, settings) {
    const notificationConfig = normalizeNotificationConfig(settings);
    if (!Object.keys(notificationConfig).length) {
        return;
    }

    const {notificationLog = {}} = await storageGet(["notificationLog"]);

    const todayEntry = findTimesForDate(cityData, now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowEntry = findTimesForDate(cityData, tomorrow);


    const windows = [
        {date: now, entry: todayEntry},
        {date: tomorrow, entry: tomorrowEntry}
    ];

    for (const {date, entry} of windows) {
        if (!entry?.times) {
            continue;
        }

        for (const key of NOTIFICATION_PRAYERS) {
            const offsetMinutes = notificationConfig[key];
            if (!offsetMinutes) {
                continue;
            }

            const timeStr = entry.times[key];
            const prayerTime = parsePrayerTime(timeStr, date);
            if (!prayerTime) {
                continue;
            }

            const notificationTime = new Date(
                prayerTime.getTime() - offsetMinutes * 60 * 1000
            );
            const windowMs = BADGE_UPDATE_PERIOD_MINUTES * 60 * 1000;
            const deltaMs = now.getTime() - notificationTime.getTime();
            if (deltaMs < 0 || deltaMs >= windowMs) {
                continue;
            }

            const logKey = `${toISODateString(date)}-${key}-${offsetMinutes}`;
            if (notificationLog[logKey]) {
                continue;
            }

            const label = getPrayerLabel(key);
            const title = `${label} vaktine ${offsetMinutes} dakika kaldı`;
            const message = `Bugünkü ${label} vakti: ${timeStr}`;

            try {
                chrome.notifications.create(
                    `prayer-${logKey}`,
                    {
                        type: "basic",
                        iconUrl: "icons/icon128.png",
                        title,
                        message,
                        priority: 0
                    },
                    () => chrome.runtime.lastError && console.warn(chrome.runtime.lastError)
                );
            } catch (error) {
                console.error("Bildirim oluşturulamadı:", error);
            }

            notificationLog[logKey] = Date.now();
        }
    }

    await storageSet({notificationLog});
}

async function updateBadge() {
    try {
        const now = new Date();

        const {settings = {}} = await storageGet(["settings"]);
        const location = settings?.location;

        if (!location) {
            chrome.action.setBadgeText({text: ""});
            return;
        }

        const cityData = await ensureCityTimes(location);
        if (!cityData || (Array.isArray(cityData) && !cityData.length)) {
            chrome.action.setBadgeText({text: ""});
            return;
        }

        await maybeSendNotifications(now, cityData, settings);

        const todayEntry = findTimesForDate(cityData, now);

        let next = todayEntry?.times ? getNextPrayer(todayEntry.times, now) : null;

        if (!next) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowEntry = findTimesForDate(cityData, tomorrow);
            if (tomorrowEntry?.times) {
                next = getNextPrayer(tomorrowEntry.times, now, tomorrow);
            }
        }

        if (!next) {
            chrome.action.setBadgeText({text: ""});
            return;
        }

        const remainingMs = next.target.getTime() - now.getTime();
        if (remainingMs <= 0) {
            chrome.action.setBadgeText({text: ""});
            return;
        }

        const text = formatRemainingHHmm(remainingMs);
        chrome.action.setBadgeText({text});
        chrome.action.setBadgeBackgroundColor({color: "#0f766e"});
    } catch (error) {
        console.error("Badge update failed:", error);
        chrome.action.setBadgeText({text: ""});
    }
}

function ensureBadgeAlarm() {
    chrome.alarms.get(BADGE_ALARM_NAME, (existing) => {
        if (existing) {
            return;
        }
        chrome.alarms.create(BADGE_ALARM_NAME, {
            periodInMinutes: BADGE_UPDATE_PERIOD_MINUTES
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["settings"], ({settings}) => {
        if (!settings) {
            const defaults = {
                location: null,
                autoRefreshMinutes: 30,
                notificationsEnabled: false
            };
            chrome.storage.local.set({settings: defaults});
        }
    });

    chrome.action.setBadgeText({text: ""});
    chrome.action.setBadgeBackgroundColor({color: "#0f766e"});
    ensureBadgeAlarm();
    updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
    ensureBadgeAlarm();
    updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name === BADGE_ALARM_NAME) {
        updateBadge();
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.settings) {
        updateBadge();
    }
});

chrome.action.onClicked.addListener(() => {
    console.info("Namaz Vakti action clicked");
});

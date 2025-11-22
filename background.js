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

async function ensureMonthlyTimes(location, {forceRefresh = false} = {}) {
    const {prayerCache = {}} = await storageGet(["prayerCache"]);

    const today = new Date();
    const startDate = toISODateString(new Date(today.getFullYear(), today.getMonth(), 1));
    const cacheKey = `${location.districtId}-${startDate}`;

    if (!forceRefresh && prayerCache[cacheKey]?.data?.length) {
        return prayerCache[cacheKey].data;
    }

    const data = await api.getMonthlyTimes(location.districtId, startDate);

    const updatedCache = {
        ...prayerCache,
        [cacheKey]: {
            data,
            fetchedAt: Date.now()
        }
    };

    await storageSet({prayerCache: updatedCache});
    return data;
}

function findTimesForDate(monthlyData, date) {
    const key = toISODateString(date);
    return monthlyData.find((entry) => entry?.date?.slice(0, 10) === key);
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
    return `${hours}h`; // e.g. "10h", "12h"
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

async function maybeSendNotifications(now, monthly, settings) {
    const notificationConfig = normalizeNotificationConfig(settings);
    if (!Object.keys(notificationConfig).length) {
        return;
    }

    const {notificationLog = {}} = await storageGet(["notificationLog"]);

    const todayEntry = findTimesForDate(monthly, now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowEntry = findTimesForDate(monthly, tomorrow);

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

        const monthly = await ensureMonthlyTimes(location);
        if (!Array.isArray(monthly) || !monthly.length) {
            chrome.action.setBadgeText({text: ""});
            return;
        }

        await maybeSendNotifications(now, monthly, settings);

        const todayEntry = findTimesForDate(monthly, now);
        let next = todayEntry?.times ? getNextPrayer(todayEntry.times, now) : null;

        if (!next) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowEntry = findTimesForDate(monthly, tomorrow);
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

import {states} from "./states.js";
import {prayerOrder} from "./prayerOrder.js";
import {PrayerTimeApi} from "./prayerTimeApi.js";

const prayerList = document.getElementById("prayer-list");
const refreshButton = document.getElementById("refresh-btn");
const locationEl = document.getElementById("location");
const changeCityButton = document.getElementById("change-city-btn");
const cityModal = document.getElementById("city-modal");
const cityForm = document.getElementById("city-form");
const citySelect = document.getElementById("city-select");
const cancelModalButton = document.getElementById("cancel-modal");
const notificationsButton = document.getElementById("notifications-btn");
const notificationsModal = document.getElementById("notifications-modal");
const closeNotificationsButton = document.getElementById("close-notifications");
const remainingTimeEl = document.getElementById("remaining-time");
const hijriDateEl = document.getElementById("hijri-date");
const notificationSelects = {
    ogle: document.getElementById("notif-ogle"),
    ikindi: document.getElementById("notif-ikindi"),
    aksam: document.getElementById("notif-aksam"),
    yatsi: document.getElementById("notif-yatsi")
};

const api = new PrayerTimeApi();
let currentLocation = null;
let countdownInterval = null;
let countdownTarget = null;
let currentCityTimes = null;

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

function formatRemainingHHmmss(remainingMs) {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0")
    ].join(":");
}

function clearCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    countdownTarget = null;
    currentCityTimes = null;
    if (remainingTimeEl) {
        remainingTimeEl.textContent = "--:--:--";
    }
}

function formatHijriDate(date) {
    try {
        const formatter = new Intl.DateTimeFormat("tr-TR-u-ca-islamic", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        return formatter.format(date);
    } catch (error) {
        console.error("Hijri date formatting failed:", error);
        return "";
    }
}

function formatHijriFromApi(hijri) {
    if (!hijri) {
        return "";
    }
    const day = hijri.day ? String(hijri.day) : "";
    const monthName = hijri.month?.en || "";
    const year = hijri.year ? String(hijri.year) : "";
    const parts = [day, monthName, year].filter(Boolean);
    return parts.join(" ");
}

function formatHijriValue(hijri) {
    if (typeof hijri === "string") {
        return hijri;
    }
    if (hijri && typeof hijri === "object") {
        return formatHijriFromApi(hijri);
    }
    return "";
}

function updateHijriDate(hijri) {
    if (!hijriDateEl) {
        return;
    }
    const text = formatHijriValue(hijri) || formatHijriDate(new Date());
    hijriDateEl.textContent = text || "";
}


function populateNotificationSelects() {
    const options = [
        {value: "0", label: "Bildirim yok"},
        {value: "10", label: "10 dk önce"},
        {value: "15", label: "15 dk önce"},
        {value: "20", label: "20 dk önce"},
        {value: "25", label: "25 dk önce"},
        {value: "30", label: "30 dk önce"},
        {value: "35", label: "35 dk önce"},
        {value: "40", label: "40 dk önce"},
        {value: "45", label: "45 dk önce"}
    ];

    Object.values(notificationSelects).forEach((select) => {
        if (!select) {
            return;
        }
        select.innerHTML = "";
        options.forEach((opt) => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
    });
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
        },
        hijriText: entry.hicriTarih || ""
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


function recalculateCountdownTarget() {
    if (!currentCityTimes) {
        countdownTarget = null;
        return;
    }

    const now = new Date();
    const todayEntry = findTimesForDate(currentCityTimes, now);
    let next = todayEntry?.times ? getNextPrayer(todayEntry.times, now) : null;

    if (!next) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowEntry = findTimesForDate(currentCityTimes, tomorrow);
        if (tomorrowEntry?.times) {
            next = getNextPrayer(tomorrowEntry.times, now, tomorrow);
        }
    }

    countdownTarget = next ? next.target : null;
}

function updateCountdownDisplay() {
    if (!remainingTimeEl) {
        return;
    }

    if (!countdownTarget) {
        recalculateCountdownTarget();
        if (!countdownTarget) {
            remainingTimeEl.textContent = "--:--:--";
            return;
        }
    }

    const now = new Date();
    let remainingMs = countdownTarget.getTime() - now.getTime();
    if (remainingMs <= 0) {
        recalculateCountdownTarget();
        if (!countdownTarget) {
            remainingTimeEl.textContent = "--:--:--";
            return;
        }
        remainingMs = countdownTarget.getTime() - now.getTime();
    }

    remainingTimeEl.textContent = formatRemainingHHmmss(remainingMs);
}

function startCountdown(cityData) {
    const isValid =
        Array.isArray(cityData) || (cityData && typeof cityData === "object");
    currentCityTimes = isValid ? cityData : null;
    if (!currentCityTimes) {
        clearCountdown();
        return;
    }


    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    recalculateCountdownTarget();
    if (!countdownTarget) {
        clearCountdown();
        return;
    }

    updateCountdownDisplay();

    countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function formatStateName(rawName) {
    if (!rawName) return "";
    const lower = rawName.toLocaleLowerCase("tr-TR");
    return lower.replace(/\p{L}+/gu, (word) => {
        return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1);
    });
}

function setStatus(message) {
    prayerList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "prayer status";
    li.textContent = message;
    prayerList.appendChild(li);
    clearCountdown();
    if (hijriDateEl) {
        hijriDateEl.textContent = "";
    }
}

function renderTimes(times) {
    prayerList.innerHTML = "";
    prayerOrder.forEach(({key, label}) => {
        const value = times?.[key] || "--:--";
        const li = document.createElement("li");
        li.className = "prayer";
        li.innerHTML = `<span>${label}</span><span class="time">${value}</span>`;
        prayerList.appendChild(li);
    });
}

function populateCitySelect() {
    citySelect.innerHTML = `<option value="" disabled selected>Şehir seçin</option>`;
    states
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
        .forEach((state) => {
            const option = document.createElement("option");
            option.value = state.id;
            option.textContent = formatStateName(state.name);
            citySelect.appendChild(option);
        });
}

function showCityModal() {
    cityModal.classList.remove("hidden");
}

function hideCityModal() {
    cityModal.classList.add("hidden");
}

function showNotificationsModal() {
    if (!notificationsModal) {
        return;
    }
    notificationsModal.classList.remove("hidden");
}

function hideNotificationsModal() {
    if (!notificationsModal) {
        return;
    }
    notificationsModal.classList.add("hidden");
}

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

async function ensureCityTimes(location, {forceRefresh = false} = {}) {
    const cityName = location?.cityName || formatStateName(location?.stateName);
    return api.getCityTimes(cityName, {forceRefresh});
}


function findTodayTimes(cityData) {
    const today = new Date();
    return findTimesForDate(cityData, today);
}


function applyNotificationSettings(notificationConfig = {}) {
    const allowedValues = new Set(["0", "10", "15", "20", "25", "30", "35", "40", "45"]);
    Object.entries(notificationSelects).forEach(([key, select]) => {
        if (!select) {
            return;
        }
        const minutes = notificationConfig[key];
        const value = minutes != null ? String(minutes) : "0";
        select.value = allowedValues.has(value) ? value : "0";
    });
}

async function saveNotificationSettings() {
    const {settings = {}} = await storageGet(["settings"]);
    const currentConfig = settings.notificationConfig || {};
    const updatedConfig = {...currentConfig};

    Object.entries(notificationSelects).forEach(([key, select]) => {
        if (!select) {
            return;
        }
        const minutes = Number(select.value || "0");
        if (!minutes) {
            delete updatedConfig[key];
        } else {
            updatedConfig[key] = minutes;
        }
    });

    const updatedSettings = {
        ...settings,
        notificationConfig: updatedConfig
    };
    await storageSet({settings: updatedSettings});
}

function attachNotificationListeners() {
    Object.values(notificationSelects).forEach((select) => {
        if (!select) {
            return;
        }
        select.addEventListener("change", () => {
            saveNotificationSettings().catch((error) => {
                console.error("Bildirim ayarları kaydedilemedi:", error);
            });
        });
    });
}

async function loadAndRender(location, {forceRefresh = false} = {}) {
    if (!location) {
        setStatus("Şehir seçilmedi");
        showCityModal();
        return;
    }

    locationEl.textContent = formatStateName(location.stateName);
    setStatus("Vakitler getiriliyor...");

    try {
        const cityData = await ensureCityTimes(location, {forceRefresh});
        const today = findTodayTimes(cityData);
        if (!today?.times) {
            setStatus("Bugunun vakitleri bulunamadi.");
            return;
        }
        renderTimes(today.times);
        startCountdown(cityData);
        updateHijriDate(today.hijriText || today.hijri);


    } catch (error) {
        console.error(error);
        setStatus("Vakitler alınırken hata oluştu.");
    }
}

async function saveCity(stateId) {
    const selectedState = states.find((state) => state.id === stateId);
    if (!selectedState) {
        setStatus("Geçersiz şehir");
        return;
    }

    setStatus("Şehir ayarlanıyor...");

    try {
        const location = {
            stateId,
            stateName: selectedState.name,
            cityName: formatStateName(selectedState.name)
        };
        const {settings = {}} = await storageGet(["settings"]);
        await storageSet({settings: {...settings, location}});

        currentLocation = location;
        hideCityModal();
        await loadAndRender(location, {forceRefresh: false});
    } catch (error) {
        console.error(error);
        setStatus("Şehir seçilirken hata oluştu.");
    }

}

async function loadSettings() {
    const {settings} = await storageGet(["settings"]);
    const storedLocation = settings?.location;
    applyNotificationSettings(settings?.notificationConfig || {});

    if (storedLocation && typeof storedLocation === "object" && storedLocation.stateId) {
        const selectedState = states.find((state) => state.id === storedLocation.stateId);
        const needsUpdate = !storedLocation.stateName || !storedLocation.cityName;
        const normalizedLocation = {
            ...storedLocation,
            stateName: storedLocation.stateName || selectedState?.name,
            cityName: storedLocation.cityName || formatStateName(storedLocation.stateName || selectedState?.name)
        };
        if (needsUpdate && normalizedLocation.cityName) {
            await storageSet({settings: {...settings, location: normalizedLocation}});
        }
        currentLocation = normalizedLocation;
        citySelect.value = storedLocation.stateId;
        await loadAndRender(normalizedLocation);
        return;
    }


    locationEl.textContent = "Şehir seçilmedi";
    showCityModal();
}

refreshButton.addEventListener("click", () => {
    if (!currentLocation) {
        showCityModal();
        return;
    }
    loadAndRender(currentLocation, {forceRefresh: true});
});

changeCityButton.addEventListener("click", showCityModal);
cancelModalButton.addEventListener("click", hideCityModal);

if (notificationsButton) {
    notificationsButton.addEventListener("click", showNotificationsModal);
}

if (closeNotificationsButton) {
    closeNotificationsButton.addEventListener("click", hideNotificationsModal);
}

cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const stateId = citySelect.value;
    if (!stateId) {
        return;
    }
    saveCity(stateId);
});

document.addEventListener("DOMContentLoaded", () => {
    populateCitySelect();
    populateNotificationSelects();
    attachNotificationListeners();
    setStatus("Şehir seçin");
    loadSettings().catch((error) => {
        console.error(error);
        setStatus("Ayarlar yüklenirken hata oluştu.");
    });
});

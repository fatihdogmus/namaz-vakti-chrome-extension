const DEFAULT_BASE = "https://raw.githubusercontent.com/fatihdogmus/namaz-vakti-chrome-extension/refs/heads/master/data/json";
const DB_NAME = "prayer-times";
const DB_VERSION = 1;
const STORE_NAME = "cities";

export class PrayerTimeApi {
    constructor(baseUrl = DEFAULT_BASE) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.dbPromise = null;
    }

    async openDb() {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, {keyPath: "city"});
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    async getCachedCity(city) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(city);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async setCachedCity(city, data, year) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.put({city, data, year, fetchedAt: Date.now()});
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    toCitySlug(cityName) {
        if (!cityName) {
            return "";
        }
        return cityName
            .toLocaleLowerCase("tr-TR")
            .replace(/\u011f/g, "g")
            .replace(/\u0131/g, "i")
            .replace(/\u00f6/g, "o")
            .replace(/\u00fc/g, "u")
            .replace(/\u015f/g, "s")
            .replace(/\u00e7/g, "c")
            .replace(/[^a-z]/g, "");
    }

    async fetchCityTimes(citySlug) {
        const url = `${this.baseUrl}/${citySlug}.json`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Istek basarisiz: ${response.status}`);
        }
        return response.json();
    }

    getYearFromData(data) {
        if (!data || Array.isArray(data)) {
            return null;
        }
        const keys = Object.keys(data);
        if (!keys.length) {
            return null;
        }
        let maxYear = null;
        keys.forEach((key) => {
            const yearText = key.slice(0, 4);
            if (/^\d{4}$/.test(yearText)) {
                const year = Number(yearText);
                if (!maxYear || year > maxYear) {
                    maxYear = year;
                }
            }
        });
        return maxYear;
    }

    async getCityTimes(cityName, {forceRefresh = false} = {}) {
        const citySlug = this.toCitySlug(cityName);
        if (!citySlug) {
            throw new Error("Sehir adi bulunamadi");
        }

        if (!forceRefresh) {
            const cached = await this.getCachedCity(citySlug);
            const cachedYear = cached?.year ?? this.getYearFromData(cached?.data);
            const currentYear = new Date().getFullYear();
            if (cached?.data && cachedYear === currentYear) {
                return cached.data;
            }
        }

        const data = await this.fetchCityTimes(citySlug);
        const currentYear = this.getYearFromData(data) || new Date().getFullYear();
        await this.setCachedCity(citySlug, data, currentYear);
        return data;
    }
}

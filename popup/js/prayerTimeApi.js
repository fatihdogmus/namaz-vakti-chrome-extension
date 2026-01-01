const DEFAULT_BASE = "https://api.aladhan.com/v1";

export class PrayerTimeApi {
    constructor(baseUrl = DEFAULT_BASE) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }

    async fetchJson(path) {
        const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`İstek başarısız: ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.code && payload.code !== 200) {
            throw new Error(`İstek başarısız: ${payload.code}`);
        }
        return payload;
    }

    normalizeTimeString(value) {
        if (!value || typeof value !== "string") {
            return null;
        }
        return value.split(" ")[0];
    }

    toIsoDateString(gregorianDate) {
        if (!gregorianDate) {
            return null;
        }
        const parts = gregorianDate.split("-");
        if (parts.length !== 3) {
            return null;
        }
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
    }

    mapMonthlyEntry(entry) {
        const timings = entry?.timings || {};
        const isoDate = this.toIsoDateString(entry?.date?.gregorian?.date);
        if (!isoDate) {
            return null;
        }
        return {
            date: isoDate,
            times: {
                imsak: this.normalizeTimeString(timings.Fajr),
                gunes: this.normalizeTimeString(timings.Sunrise),
                ogle: this.normalizeTimeString(timings.Dhuhr),
                ikindi: this.normalizeTimeString(timings.Asr),
                aksam: this.normalizeTimeString(timings.Maghrib),
                yatsi: this.normalizeTimeString(timings.Isha)
            },
            hijri: entry?.date?.hijri || null
        };
    }

    async getMonthlyTimes(cityName, year, month) {
        if (!cityName) {
            throw new Error("Şehir adı bulunamadı");
        }
        const encodedCity = encodeURIComponent(cityName);
        const {data = []} = await this.fetchJson(
            `/calendarByCity/${year}/${month}?city=${encodedCity}&country=Turkey&method=13`
        );
        return data
            .map((entry) => this.mapMonthlyEntry(entry))
            .filter(Boolean);
    }
}


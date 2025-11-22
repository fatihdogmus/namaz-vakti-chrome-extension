const DEFAULT_BASE = "https://ezanvakti.imsakiyem.com";

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
        return response.json();
    }

    async getDistricts(stateId) {
        const {data = []} = await this.fetchJson(
            `/api/locations/districts?stateId=${stateId}`
        );
        return data;
    }

    chooseDistrict(state, districts) {
        if (!districts.length) {
            throw new Error("İlçe bulunamadı");
        }

        const targetName = state.name.toLocaleUpperCase("tr-TR");
        const exactMatch = districts.find((d) => d.name === targetName);
        const merkezMatch = districts.find((d) => d.name.includes("MERKEZ"));
        const chosen = exactMatch || merkezMatch || districts[0];

        return {
            districtId: chosen._id || chosen.id,
            districtName: chosen.name
        };
    }

    async selectDistrictForState(state) {
        const districts = await this.getDistricts(state.id);
        return this.chooseDistrict(state, districts);
    }

    async getMonthlyTimes(districtId, startDate) {
        const {data = []} = await this.fetchJson(
            `/api/prayer-times/${districtId}/monthly?startDate=${startDate}`
        );
        return data;
    }
}

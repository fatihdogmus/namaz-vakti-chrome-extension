const prayerList = document.getElementById("prayer-list");
const refreshButton = document.getElementById("refresh-btn");
const locationEl = document.getElementById("location");
const changeCityButton = document.getElementById("change-city-btn");
const cityModal = document.getElementById("city-modal");
const cityForm = document.getElementById("city-form");
const citySelect = document.getElementById("city-select");
const cancelModalButton = document.getElementById("cancel-modal");

const cities = [
    "Adana",
    "Ankara",
    "Antalya",
    "Bursa",
    "Diyarbakır",
    "Erzurum",
    "Eskişehir",
    "Gaziantep",
    "İstanbul",
    "İzmir",
    "Kayseri",
    "Konya",
    "Malatya",
    "Samsun",
    "Şanlıurfa",
    "Trabzon"
];

const sampleTimes = [
    {name: "İmsak", time: "05:12"},
    {name: "Güneş", time: "06:38"},
    {name: "Öğle", time: "12:48"},
    {name: "İkindi", time: "16:15"},
    {name: "Akşam", time: "19:38"},
    {name: "Yatsı", time: "21:05"}
];

function renderTimes(times) {
    prayerList.innerHTML = "";
    times.forEach(({name, time}) => {
        const li = document.createElement("li");
        li.className = "prayer";
        li.innerHTML = `<span>${name}</span><span class="time">${time}</span>`;
        prayerList.appendChild(li);
    });
}

function populateCitySelect() {
    citySelect.innerHTML = `<option value="" disabled selected>Şehir seçin</option>`;
    cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

function showCityModal() {
    cityModal.classList.remove("hidden");
}

function hideCityModal() {
    cityModal.classList.add("hidden");
}

function saveCity(city) {
    chrome.storage.local.get(["settings"], ({settings}) => {
        const current = settings || {};
        const updated = {...current, location: city};
        chrome.storage.local.set({settings: updated}, () => {
            locationEl.textContent = city;
        });
    });
}

function loadSettings() {
    chrome.storage.local.get(["settings"], ({settings}) => {
        if (settings?.location) {
            locationEl.textContent = settings.location;
            citySelect.value = settings.location;
        } else {
            locationEl.textContent = "Şehir seçilmedi";
            showCityModal();
        }
    });
}

refreshButton.addEventListener("click", () => {
    // Placeholder for later API call.
    renderTimes(sampleTimes);
});

changeCityButton.addEventListener("click", showCityModal);
cancelModalButton.addEventListener("click", hideCityModal);

cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = citySelect.value;
    if (!city) {
        return;
    }
    saveCity(city);
    hideCityModal();
});

document.addEventListener("DOMContentLoaded", () => {
    populateCitySelect();
    renderTimes(sampleTimes);
    loadSettings();
});

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { chromium } = require("playwright");

const cities = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kilis",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Şanlıurfa",
  "Şırnak",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak"
];

const BASE_URL = "https://namazvakitleri.diyanet.gov.tr";
const DOWNLOAD_DIR = path.resolve(__dirname, "data");
const DOWNLOAD_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAsciiSlug(value) {
  const map = {
    Ç: "C",
    ç: "c",
    Ğ: "G",
    ğ: "g",
    İ: "I",
    ı: "i",
    Ö: "O",
    ö: "o",
    Ş: "S",
    ş: "s",
    Ü: "U",
    ü: "u"
  };

  return value
    .split("")
    .map((char) => map[char] || char)
    .join("")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9\-]/g, "")
    .toLowerCase();
}

function normalizeHeader(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.toString().trim();
  if (!trimmed) {
    return null;
  }

  const map = {
    "Miladi Tarih": "miladiTarih",
    "Hicri Tarih": "hicriTarih",
    "İmsak": "imsak",
    "Güneş": "gunes",
    "Öğle": "ogle",
    "İkindi": "ikindi",
    "Akşam": "aksam",
    "Yatsı": "yatsi"
  };

  return map[trimmed] || toAsciiSlug(trimmed).replace(/-/g, "_");
}

function parseMiladiDate(value) {
  if (!value) {
    return null;
  }

  const parts = value.split(" ").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const day = parts[0].padStart(2, "0");
  const month = parts[1].toLocaleLowerCase("tr-TR");
  const year = parts[2];
  const months = {
    ocak: "01",
    subat: "02",
    "şubat": "02",
    mart: "03",
    nisan: "04",
    mayis: "05",
    "mayıs": "05",
    haziran: "06",
    temmuz: "07",
    agustos: "08",
    ağustos: "08",
    eylul: "09",
    eylül: "09",
    ekim: "10",
    kasim: "11",
    kasım: "11",
    aralik: "12",
    aralık: "12"
  };

  const monthValue = months[month];
  if (!monthValue || !/^\d{4}$/.test(year)) {
    return null;
  }

  return `${year}-${monthValue}-${day}`;
}

function parseExcelToJson(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!rows.length) {
    return {};
  }

  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader).filter(Boolean);
    return normalized.includes("miladiTarih") && normalized.includes("hicriTarih");
  });

  if (headerRowIndex === -1) {
    return {};
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const records = {};

  for (const row of rows.slice(headerRowIndex + 1)) {
    const hasData = row.some((cell) => String(cell).trim() !== "");
    if (!hasData) {
      continue;
    }

    const record = {};
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      record[header] = String(row[index] ?? "").trim();
    });

    if (!record.miladiTarih) {
      continue;
    }

    const isoDate = parseMiladiDate(record.miladiTarih);
    if (!isoDate) {
      continue;
    }

    records[isoDate] = {
      hicriTarih: record.hicriTarih,
      imsak: record.imsak,
      gunes: record.gunes,
      ogle: record.ogle,
      ikindi: record.ikindi,
      aksam: record.aksam,
      yatsi: record.yatsi
    };
  }

  return records;
}

function toCityLabel(value) {
  const overrides = {
    Kastamonu: "KASTAMONU"
  };

  if (overrides[value]) {
    return overrides[value];
  }

  return value.toLocaleUpperCase("tr-TR");
}

async function scrape() {
  await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const countrySelect = page.locator("select.country-select");
    const citySelect = page.locator("select.city-select");
    const districtSelect = page.locator("select.district-select");

    await countrySelect.waitFor({ state: "visible" });
    await citySelect.waitFor({ state: "visible" });
    await districtSelect.waitFor({ state: "visible" });

    await countrySelect.selectOption({ label: "TÜRKİYE" });
    await sleep(DOWNLOAD_DELAY_MS);

    for (const city of cities) {
      try {
        const cityLabel = toCityLabel(city);

        await citySelect.selectOption({ label: cityLabel });
        await districtSelect
          .locator("option", { hasText: cityLabel })
          .first()
          .waitFor({ state: "attached" });
        await sleep(DOWNLOAD_DELAY_MS);

        await districtSelect.selectOption({ label: cityLabel });
        await sleep(DOWNLOAD_DELAY_MS);

        const yearlyTabButton = page.getByRole("button", { name: /Yıllık Namaz Vakti/i });
        await yearlyTabButton.click();
        await sleep(DOWNLOAD_DELAY_MS);

        const excelButton = page.locator(".dt-buttons .buttons-excel");
        await excelButton.waitFor({ state: "visible" });

        const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
        await excelButton.click();
        const download = await downloadPromise;

        const fileName = `${toAsciiSlug(city)}-yillik-namaz-vakitleri.xlsx`;
        const filePath = path.join(DOWNLOAD_DIR, fileName);
        await download.saveAs(filePath);

        console.log(`Saved: ${filePath}`);
        await sleep(DOWNLOAD_DELAY_MS);
      } catch (error) {
        console.error(`Failed for ${city}:`, error);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

}

async function parseDownloadedExcels() {
  const jsonDir = path.resolve(DOWNLOAD_DIR, "json");
  await fs.promises.mkdir(jsonDir, { recursive: true });

  for (const city of cities) {
    const fileName = `${toAsciiSlug(city)}-yillik-namaz-vakitleri.xlsx`;
    const filePath = path.join(DOWNLOAD_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`Missing: ${filePath}`);
      continue;
    }

    const jsonFileName = `${toAsciiSlug(city)}.json`;
    const jsonFilePath = path.join(jsonDir, jsonFileName);
    const data = parseExcelToJson(filePath);
    await fs.promises.writeFile(jsonFilePath, JSON.stringify(data));

    console.log(`Saved: ${jsonFilePath}`);
  }
}

async function run() {
  try {
    // await scrape();
    await parseDownloadedExcels();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  }
}

run();

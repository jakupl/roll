const fs = require('fs').promises;
const fetch = require('node-fetch');

const BUFF_CSFLOAT_THRESHOLD = 0.95;
const BUFF_YOUPIN_THRESHOLD = 0.95;

const BUFF_URL = 'https://jakupl.github.io/buff/buffPriceList.json';
const CSFLOAT_URL = 'https://jakupl.github.io/csfloat/floatPriceList.json';
const YOUPIN_URL = 'https://jakupl.github.io/youpin/youpinPriceList.json';

const OUTPUT_FILE = 'filteredPriceList.json';
const LOG_FILE = 'debug-log.txt';

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Błąd pobierania ${url}: ${error.message}`);
    return null;
  }
}

async function main() {
  let log = `Uruchomiono: ${new Date().toISOString()}\n\n`;

  const rawBuff = await fetchJson(BUFF_URL);
  const rawCsfloat = await fetchJson(CSFLOAT_URL);
  const rawYoupin = await fetchJson(YOUPIN_URL);

  if (!rawBuff || !rawCsfloat || !rawYoupin) {
    log += 'Nie udało się pobrać jednego lub więcej źródeł.\n';
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({}, null, 4));
    await fs.writeFile(LOG_FILE, log);
    return;
  }

  const buffData = {};
  for (const [key, value] of Object.entries(rawBuff)) {
    if (key !== 'updated_at' && typeof value === 'object' && 'price' in value) {
      buffData[key] = value.price;
    }
  }

  const csfloatData = rawCsfloat.items || {};
  const youpinData = rawYoupin.items || {};

  const csfloatPrices = {};
  for (const [item, obj] of Object.entries(csfloatData)) {
    if (typeof obj === 'object' && 'price' in obj) {
      csfloatPrices[item] = obj.price;
    }
  }

  const youpinPrices = {};
  for (const [item, obj] of Object.entries(youpinData)) {
    if (typeof obj === 'object' && 'price' in obj) {
      youpinPrices[item] = obj.price;
    }
  }

  log += `Buff: ${Object.keys(buffData).length} itemów\n`;
  log += `CSFloat: ${Object.keys(csfloatPrices).length} itemów\n`;
  log += `Youpin: ${Object.keys(youpinPrices).length} itemów\n\n`;

  const filteredItems = {};
  let checked = 0;
  let presentInAll = 0;

  for (const [item, buffPrice] of Object.entries(buffData)) {
    checked++;
    const csfloatPrice = csfloatPrices[item];
    const youpinPrice = youpinPrices[item];

    if (csfloatPrice !== undefined && youpinPrice !== undefined) {
      presentInAll++;
      if (
        csfloatPrice >= BUFF_CSFLOAT_THRESHOLD * buffPrice &&
        youpinPrice >= BUFF_YOUPIN_THRESHOLD * buffPrice
      ) {
        filteredItems[item] = {
          buff_price: buffPrice,
          csfloat_price: csfloatPrice,
          youpin_price: youpinPrice
        };
      }
    }
  }

  log += `Sprawdzono itemów z Buff: ${checked}\n`;
  log += `Obecne na wszystkich trzech rynkach: ${presentInAll}\n`;
  log += `Spełniające progi (>= ${BUFF_CSFLOAT_THRESHOLD * 100}% Buff): ${Object.keys(filteredItems).length}\n`;

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
  await fs.writeFile(LOG_FILE, log);

  console.log(`Gotowe. Przefiltrowano: ${Object.keys(filteredItems).length} itemów`);
}

main();

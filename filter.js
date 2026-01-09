const fs = require('fs').promises;
const fetch = require('node-fetch');

const BUFF_CSFLOAT_THRESHOLD = 0.95; 
const BUFF_YOUPIN_THRESHOLD = 0.95;  
const MIN_BUFF_STOCK = 15;           
const MIN_CSFLOAT_STOCK = 10;        

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
    log += 'Nie udało się pobrać danych z jednego ze źródeł.\n';
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({}, null, 4));
    await fs.writeFile(LOG_FILE, log);
    return;
  }

  const buffData = {};
  for (const [key, value] of Object.entries(rawBuff)) {
    if (key !== 'updated_at' && typeof value === 'object' && 'price' in value && 'stock' in value) {
      buffData[key] = { price: value.price, stock: value.stock };
    }
  }

  const csfloatData = {};
  for (const [key, value] of Object.entries(rawCsfloat)) {
    if (typeof value === 'object' && 'price' in value && 'stock' in value) {
      csfloatData[key] = { price: value.price, stock: value.stock };
    }
  }

  const youpinData = {};
  for (const [key, value] of Object.entries(rawYoupin)) {
    if (typeof value === 'object' && 'price' in value && 'stock' in value) {
      youpinData[key] = { price: value.price, stock: value.stock };
    }
  }

  log += `Buff items (po oczyszczeniu): ${Object.keys(buffData).length}\n`;
  log += `CSFloat items: ${Object.keys(csfloatData).length}\n`;
  log += `Youpin items: ${Object.keys(youpinData).length}\n\n`;

  const filteredItems = {};
  let checked = 0;
  let presentInAll = 0;
  let passedStockAndPrice = 0;

  for (const [item, buffObj] of Object.entries(buffData)) {
    checked++;
    const { price: buffPrice, stock: buffStock } = buffObj;

    const csfloatObj = csfloatData[item];
    const youpinObj = youpinData[item];

    if (csfloatObj && youpinObj) {
      presentInAll++;
      const { price: csfloatPrice, stock: csfloatStock } = csfloatObj;
      const { price: youpinPrice, stock: youpinStock } = youpinObj;

      if (buffStock >= MIN_BUFF_STOCK && csfloatStock >= MIN_CSFLOAT_STOCK &&
          csfloatPrice >= BUFF_CSFLOAT_THRESHOLD * buffPrice &&
          youpinPrice >= BUFF_YOUPIN_THRESHOLD * buffPrice) {

        passedStockAndPrice++;

        filteredItems[item] = {
          buff_price: buffPrice,
          buff_stock: buffStock,
          csfloat_price: csfloatPrice,
          csfloat_stock: csfloatStock,
          youpin_price: youpinPrice,
          youpin_stock: youpinStock
        };
      }
    }
  }

  log += `Sprawdzono itemów z Buff: ${checked}\n`;
  log += `Obecne na wszystkich 3 rynkach: ${presentInAll}\n`;
  log += `Spełniające stock + progi cenowe: ${passedStockAndPrice}\n\n`;
  log += `Przykładowe itemy z Buff (pierwsze 5): ${JSON.stringify(Object.keys(buffData).slice(0, 5))}\n`;

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
  await fs.writeFile(LOG_FILE, log);

  console.log(`Gotowe! Przefiltrowano ${Object.keys(filteredItems).length} itemów.`);
}

main();

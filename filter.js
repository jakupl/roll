const fs = require('fs').promises;
const fetch = require('node-fetch');

const BUFF_CSFLOAT_THRESHOLD = 0.95;  // 95% ceny Buff
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
    log += 'Nie udało się pobrać jednego lub więcej źródeł.\n';
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({}, null, 4));
    await fs.writeFile(LOG_FILE, log);
    return;
  }


  const buffData = rawBuff;      // { item: { price, stock } }
  const csfloatData = rawCsfloat;
  const youpinData = rawYoupin;

  log += `Buff items: ${Object.keys(buffData).length}\n`;
  log += `CSFloat items: ${Object.keys(csfloatData).length}\n`;
  log += `Youpin items: ${Object.keys(youpinData).length}\n\n`;

  const filteredItems = {};
  let checked = 0;
  let presentInAll = 0;
  let passedStock = 0;

  for (const [item, buffObj] of Object.entries(buffData)) {
    if (typeof buffObj !== 'object' || !('price' in buffObj) || !('stock' in buffObj)) continue;

    checked++;
    const buffPrice = buffObj.price;
    const buffStock = buffObj.stock;

    const csfloatObj = csfloatData[item];
    const youpinObj = youpinData[item];

    if (csfloatObj && youpinObj &&
        typeof csfloatObj === 'object' && 'price' in csfloatObj && 'stock' in csfloatObj &&
        typeof youpinObj === 'object' && 'price' in youpinObj && 'stock' in youpinObj) {

      const csfloatPrice = csfloatObj.price;
      const csfloatStock = csfloatObj.stock;
      const youpinPrice = youpinObj.price;
      const youpinStock = youpinObj.stock; 

      presentInAll++;

      if (buffStock >= MIN_BUFF_STOCK && csfloatStock >= MIN_CSFLOAT_STOCK) {
        if (csfloatPrice >= BUFF_CSFLOAT_THRESHOLD * buffPrice &&
            youpinPrice >= BUFF_YOUPIN_THRESHOLD * buffPrice) {

          passedStock++;

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
  }

  log += `Sprawdzono itemów z Buff: ${checked}\n`;
  log += `Obecne na wszystkich trzech rynkach: ${presentInAll}\n`;
  log += `Spełniające min stock (Buff >=${MIN_BUFF_STOCK}, CSFloat >=${MIN_CSFLOAT_STOCK}): ${passedStock}\n`;
  log += `Ostatecznie przefiltrowane (z progami cenowymi): ${Object.keys(filteredItems).length}\n`;

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
  await fs.writeFile(LOG_FILE, log);

  console.log(`Gotowe. Przefiltrowano: ${Object.keys(filteredItems).length} itemów`);
}

main();

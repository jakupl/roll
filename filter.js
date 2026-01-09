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
    const data = await response.json();
    console.log(`Fetched ${url}: ${Object.keys(data).length} top-level keys`);
    return data;
  } catch (error) {
    console.error(`ERROR fetching ${url}: ${error.message}`);
    return null;
  }
}

async function main() {
  let log = `Run at: ${new Date().toISOString()}\n`;

  const buffData = await fetchJson(BUFF_URL);
  const csfloatData = await fetchJson(CSFLOAT_URL);
  const youpinData = await fetchJson(YOUPIN_URL);

  if (!buffData || !csfloatData || !youpinData) {
    log += 'One or more sources failed to load.\n';
    await fs.writeFile(LOG_FILE, log);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify({}, null, 4));
    console.log('Empty file saved due to fetch error.');
    return;
  }

  log += `\nBuff keys sample: ${JSON.stringify(Object.keys(buffData).slice(0, 10))}\n`;
  log += `CSFloat keys sample: ${JSON.stringify(Object.keys(csfloatData).slice(0, 10))}\n`;
  log += `Youpin keys sample: ${JSON.stringify(Object.keys(youpinData).slice(0, 10))}\n\n`;

  const filteredItems = {};
  let checked = 0;
  let matched = 0;

  for (const [item, buffPrice] of Object.entries(buffData)) {
    checked++;
    const csfloatPrice = csfloatData[item];
    const youpinPrice = youpinData[item];

    if (csfloatPrice !== undefined && youpinPrice !== undefined) {
      matched++;
      if (
        typeof buffPrice === 'number' &&
        typeof csfloatPrice === 'number' &&
        typeof youpinPrice === 'number' &&
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

  log += `Checked items: ${checked}\n`;
  log += `Items present in all three markets: ${matched}\n`;
  log += `Filtered items (meeting thresholds): ${Object.keys(filteredItems).length}\n`;

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
  await fs.writeFile(LOG_FILE, log);

  console.log(`Done. Filtered: ${Object.keys(filteredItems).length} items`);
  console.log(log);
}

main();

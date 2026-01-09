const fs = require('fs').promises;
const fetch = require('node-fetch');

const BUFF_CSFLOAT_THRESHOLD = 0.95;
const BUFF_YOUPIN_THRESHOLD = 0.95;

const BUFF_URL = 'https://jakupl.github.io/buff/buffPriceList.json';
const CSFLOAT_URL = 'https://jakupl.github.io/csfloat/floatPriceList.json';
const YOUPIN_URL = 'https://jakupl.github.io/youpin/youpinPriceList.json';

const OUTPUT_FILE = 'filteredPriceList.json';

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}: ${error}`);
    return null;
  }
}

async function main() {
  const buffData = await fetchJson(BUFF_URL);
  const csfloatData = await fetchJson(CSFLOAT_URL);
  const youpinData = await fetchJson(YOUPIN_URL);

  if (!buffData || !csfloatData || !youpinData) {
    console.log('Failed to fetch one or more price lists. Exiting.');
    return;
  }

  const filteredItems = {};

  for (const [item, buffPrice] of Object.entries(buffData)) {
    const csfloatPrice = csfloatData[item];
    const youpinPrice = youpinData[item];

    if (csfloatPrice !== undefined && youpinPrice !== undefined) {
      if (csfloatPrice >= BUFF_CSFLOAT_THRESHOLD * buffPrice &&
          youpinPrice >= BUFF_YOUPIN_THRESHOLD * buffPrice) {
        filteredItems[item] = {
          buff_price: buffPrice,
          csfloat_price: csfloatPrice,
          youpin_price: youpinPrice
        };
      }
    }
  }

  try {
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
    console.log(`Filtered items saved to ${OUTPUT_FILE}. Total items: ${Object.keys(filteredItems).length}`);
  } catch (error) {
    console.error(`Error writing file: ${error}`);
  }
}

main();

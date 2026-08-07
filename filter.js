
// Ceny pochodzą z BetterFlipper Partner API zamiast ze statycznych plików
// na GitHub Pages. Node >= 18 ma wbudowany fetch, więc node-fetch nie jest
// już potrzebny.

const fs = require('fs').promises;

// 1 / 0.66 = ~1.515
const PRICE_CONVERSION_RATE = 0.65; 

// jesli zawiera slowo
const BLACKLIST_PARTIAL = [

    "Sticker",
"Souvenir"
];

const BLACKLIST_EXACT = [

];

const BUFF_CSFLOAT_THRESHOLD = 0.95;
const MIN_BUFF_STOCK    = 15;
const MIN_CSFLOAT_STOCK = 10;

const MIN_BUFF_PRICE = 15.00;      
const MAX_BUFF_PRICE = 1234.00;    

const BFP_API_BASE = process.env.BFP_API_BASE || 'https://apisystem.betterflipper.com/partner/v1';
const BFP_API_KEY  = process.env.BFP_API_KEY || '';

const OUTPUT_FILE = 'filteredPriceList.json';
const LOG_FILE    = 'debug-log.txt';

/**
 * Pobiera cennik jednego marketu z BetterFlippera i zwraca { nazwa: { price, stock } }.
 *
 * API oddaje { items: [{ name, bid, ask, count }] }. `ask` to najniższy listing —
 * dokładnie to, co wcześniej niosło pole `price`, a `count` to dawny `stock`.
 * Ceny są w USD, tak jak w poprzednich źródłach, więc progi filtrów zostają bez zmian.
 *
 * Zwraca null przy błędzie — wywołujący przerywa wtedy przebieg.
 */
async function fetchMarket(market) {
  const url = `${BFP_API_BASE}/prices/${market}`;
  try {
    const response = await fetch(url, { headers: { 'X-API-Key': BFP_API_KEY } });
    if (!response.ok) {
      // API zwraca powód w polu `detail` — bez niego diagnoza to zgadywanka.
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${detail.slice(0, 200)}`);
    }

    const raw = await response.json();
    const out = {};
    for (const item of raw.items || []) {
      if (!item.name || item.ask === null || item.ask === undefined) continue;
      out[item.name] = { price: item.ask, stock: item.count ?? 0 };
    }
    return out;
  } catch (error) {
    console.error(`Błąd pobierania ${market}: ${error.message}`);
    return null;
  }
}

async function main() {
  let log = `Uruchomiono: ${new Date().toISOString()}\n\n`;
  log += `Filtry cenowe Buff: ${MIN_BUFF_PRICE} – ${MAX_BUFF_PRICE === Infinity ? 'bez górnego limitu' : MAX_BUFF_PRICE}\n`;
  
  const calculatedMultiplier = 1 / PRICE_CONVERSION_RATE;
  log += `Przelicznik użytkownika: ${PRICE_CONVERSION_RATE} -> Mnożnik cen: ${calculatedMultiplier.toFixed(4)}\n\n`;

  if (!BFP_API_KEY) {
    log += 'Brak BFP_API_KEY — bez klucza BetterFlipper nie pobiorę cenników.\n';
    await fs.writeFile(LOG_FILE, log);
    console.error('Brak BFP_API_KEY. Ustaw sekret w Settings → Secrets and variables → Actions.');
    process.exitCode = 1;
    return;
  }

  const [buffData, csfloatData] = await Promise.all([
    fetchMarket('buff'),
    fetchMarket('csfloat'),
  ]);

  // Nadpisanie wyniku pustką skasowałoby działający cennik na Pages,
  // więc przy błędzie zostawiamy poprzedni plik nietknięty.
  if (!buffData || !csfloatData) {
    log += 'Nie udało się pobrać danych z jednego ze źródeł — zostawiam poprzedni cennik.\n';
    await fs.writeFile(LOG_FILE, log);
    console.error('Pobieranie nieudane — filteredPriceList.json bez zmian.');
    process.exitCode = 1;
    return;
  }

  log += `Buff items: ${Object.keys(buffData).length}\n`;
  log += `CSFloat items: ${Object.keys(csfloatData).length}\n\n`;

  log += `Przykładowe klucze Buff: ${JSON.stringify(Object.keys(buffData).slice(0,5))}\n\n`;

  const filteredItems = {};
  let checked       = 0;
  let presentInBoth = 0;
  let passedFilters = 0;
  let blacklisted   = 0; 

  for (const [item, buffObj] of Object.entries(buffData)) {
    checked++;

    if (BLACKLIST_EXACT.includes(item)) {
        blacklisted++;
        continue;
    }

    const isPartialBlacklisted = BLACKLIST_PARTIAL.some(keyword => 
        item.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isPartialBlacklisted) {
        blacklisted++;
        continue;
    }

    const { price: buffPrice, stock: buffStock } = buffObj;

    if (buffPrice < MIN_BUFF_PRICE || buffPrice > MAX_BUFF_PRICE) {
      continue;
    }

    const csfloatObj = csfloatData[item];

    if (csfloatObj) {
      presentInBoth++;

      const { price: csfloatPrice, stock: csfloatStock } = csfloatObj;

      if (
        buffStock     >= MIN_BUFF_STOCK    &&
        csfloatStock  >= MIN_CSFLOAT_STOCK &&
        csfloatPrice  >= BUFF_CSFLOAT_THRESHOLD * buffPrice
      ) {
        passedFilters++;

        const adjustedPrice = buffPrice * calculatedMultiplier;

        filteredItems[item] = {
          buff_price: Number(adjustedPrice.toFixed(2))
        };
      }
    }
  }

  log += `Sprawdzono itemów z Buff: ${checked}\n`;
  log += `Odrzucono przez Blacklistę: ${blacklisted}\n`; 
  log += `Obecne na obu rynkach: ${presentInBoth}\n`;
  log += `Spełniające wszystkie filtry: ${passedFilters}\n`;

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(filteredItems, null, 4), 'utf-8');
  await fs.writeFile(LOG_FILE, log);

  console.log(`Gotowe! Znaleziono ${Object.keys(filteredItems).length} itemów spełniających warunki.`);
  console.log(`Zastosowano przelicznik: 1 / ${PRICE_CONVERSION_RATE} = * ${calculatedMultiplier.toFixed(4)}`);
}

main().catch(err => console.error('Błąd w main:', err));

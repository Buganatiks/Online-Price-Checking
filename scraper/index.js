// ITMA price scraper
// Reads the list of enabled stores from Supabase, pulls each Shopify
// store's public product feed, and saves products, prices, price
// history and specs back to Supabase.
//
// Runs on GitHub Actions. Needs two secrets:
//   SUPABASE_URL         e.g. https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY  starts with sb_secret_ (never commit this)

import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { detectBrand, detectCategory, extractSpecs } from './specs.js';

const PAGE_SIZE = 250;          // Shopify's max per page
const MAX_PAGES = 80;           // safety cap: 20,000 products per store
const PAGE_DELAY_MS = 1200;     // be polite to the stores
const DB_BATCH = 500;
const USER_AGENT = 'ITMA-PriceChecker/1.0 (personal price comparison)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Add it under GitHub repo Settings > Secrets and variables > Actions.`);
    process.exit(1);
  }
  return v.trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toPrice(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------- Shopify ----------

export async function fetchShopifyProducts(baseUrl, { fetchImpl = fetch, delay = PAGE_DELAY_MS } = {}) {
  const base = baseUrl.replace(/\/+$/, '');
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.status !== 429 && res.status < 500) break;
      await sleep(3000 * attempt); // rate limited or server hiccup: wait and retry
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Not a Shopify product feed (got a web page instead of data)');
    }
    if (!Array.isArray(data.products)) throw new Error('Not a Shopify product feed (no products list)');
    all.push(...data.products);
    if (data.products.length < PAGE_SIZE) break;
    if (delay) await sleep(delay);
  }
  return all;
}

// One row per variant, because variants (e.g. 8GB vs 16GB) have different prices.
export function toRows(storeId, baseUrl, products, now) {
  const base = baseUrl.replace(/\/+$/, '');
  const rows = [];
  for (const p of products) {
    const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [null];
    const category = detectCategory(p.product_type, p.title, p.tags);
    const brand = detectBrand(p.vendor, p.title);
    for (const v of variants) {
      const variantTitle = v && v.title && !/^default title$/i.test(v.title) ? v.title : '';
      const title = variantTitle ? `${p.title} - ${variantTitle}` : p.title;
      const image =
        (v && v.featured_image && v.featured_image.src) ||
        (Array.isArray(p.images) && p.images[0] && p.images[0].src) ||
        null;
      const price = toPrice(v ? v.price : null);
      const compare = toPrice(v ? v.compare_at_price : null);
      rows.push({
        store_id: storeId,
        external_id: String(v ? v.id : p.id),
        title: (title || '').trim().slice(0, 500),
        brand,
        product_type: p.product_type || null,
        category,
        url: `${base}/products/${p.handle}${v && variants.length > 1 ? `?variant=${v.id}` : ''}`,
        image_url: image,
        price,
        compare_at_price: compare && price && compare > price ? compare : null,
        in_stock: v ? v.available !== false : true,
        last_seen_at: now,
        updated_at: now,
        _specs: extractSpecs(title, category),
      });
    }
  }
  // Drop duplicates (same variant listed twice) so the upsert doesn't fail.
  const seen = new Map();
  for (const r of rows) seen.set(r.external_id, r);
  return [...seen.values()];
}

// ---------- Supabase ----------

async function fetchAll(query, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

async function saveStore(db, store, rows, runStart) {
  // What we knew before this run, so we can record only real price changes.
  const existing = await fetchAll(() =>
    db.from('products').select('id, external_id, price, in_stock').eq('store_id', store.id).order('id'),
  );
  const before = new Map(existing.map((e) => [e.external_id, e]));

  const saved = [];
  for (const batch of chunk(rows, DB_BATCH)) {
    const payload = batch.map(({ _specs, ...r }) => r);
    const { data, error } = await db
      .from('products')
      .upsert(payload, { onConflict: 'store_id,external_id' })
      .select('id, external_id');
    if (error) throw error;
    saved.push(...data);
  }
  const idByExternal = new Map(saved.map((s) => [s.external_id, s.id]));

  // Price history: new products, price changes, and stock changes.
  const history = [];
  let newCount = 0;
  let changedCount = 0;
  for (const r of rows) {
    const id = idByExternal.get(r.external_id);
    if (!id || r.price === null) continue;
    const prev = before.get(r.external_id);
    const isNew = !prev;
    const priceChanged = prev && Number(prev.price) !== r.price;
    const stockChanged = prev && prev.in_stock !== r.in_stock;
    if (isNew) newCount++;
    if (priceChanged) changedCount++;
    if (isNew || priceChanged || stockChanged) {
      history.push({ product_id: id, price: r.price, in_stock: r.in_stock, recorded_at: runStart });
    }
  }
  for (const batch of chunk(history, DB_BATCH)) {
    const { error } = await db.from('price_history').insert(batch);
    if (error) throw error;
  }

  // Specs (EAV rows).
  const specRows = [];
  for (const r of rows) {
    const id = idByExternal.get(r.external_id);
    if (!id) continue;
    for (const [spec_key, spec_value] of Object.entries(r._specs)) {
      specRows.push({ product_id: id, spec_key, spec_value });
    }
  }
  for (const batch of chunk(specRows, DB_BATCH)) {
    const { error } = await db.from('product_specifications').upsert(batch, { onConflict: 'product_id,spec_key' });
    if (error) throw error;
  }

  // Anything this store no longer lists is marked out of stock (kept for history).
  const { data: gone, error: goneErr } = await db
    .from('products')
    .update({ in_stock: false, updated_at: runStart })
    .eq('store_id', store.id)
    .eq('in_stock', true)
    .lt('last_seen_at', runStart)
    .select('id');
  if (goneErr) throw goneErr;

  return { newCount, changedCount, specCount: specRows.length, removed: gone.length };
}

// ---------- Run ----------

function writeSummary(results) {
  const lines = [
    '## ITMA scrape results',
    '',
    '| Store | Status | Products | New | Price changes | No longer listed |',
    '|---|---|---|---|---|---|',
    ...results.map((r) =>
      r.ok
        ? `| ${r.name} | ✅ OK | ${r.count} | ${r.newCount} | ${r.changedCount} | ${r.removed} |`
        : `| ${r.name} | ❌ ${r.error.replace(/\|/g, '/')} | - | - | - | - |`,
    ),
  ];
  const md = lines.join('\n');
  console.log('\n' + md + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

async function main() {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SECRET_KEY');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const onlyStore = (process.env.ONLY_STORE || '').trim().toLowerCase();
  const { data: stores, error } = await db.from('stores').select('*').eq('enabled', true).order('name');
  if (error) {
    console.error('Could not read the stores table:', error.message);
    process.exit(1);
  }
  const targets = stores.filter((s) => !onlyStore || s.name.toLowerCase() === onlyStore);
  if (!targets.length) {
    console.error('No enabled stores to scrape.');
    process.exit(1);
  }

  const results = [];
  for (const store of targets) {
    const runStart = new Date().toISOString();
    console.log(`\n▶ ${store.name} (${store.base_url})`);
    if (store.platform !== 'shopify') {
      results.push({ name: store.name, ok: false, error: `platform "${store.platform}" not supported yet` });
      continue;
    }
    try {
      const products = await fetchShopifyProducts(store.base_url);
      const rows = toRows(store.id, store.base_url, products, runStart);
      console.log(`  fetched ${products.length} products (${rows.length} listings)`);
      const stats = await saveStore(db, store, rows, runStart);
      console.log(`  saved: ${stats.newCount} new, ${stats.changedCount} price changes, ${stats.specCount} specs, ${stats.removed} no longer listed`);
      results.push({ name: store.name, ok: true, count: rows.length, ...stats });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      console.error(`  ✖ ${msg}`);
      results.push({ name: store.name, ok: false, error: msg });
    }
  }

  writeSummary(results);
  // Fail the run (so GitHub emails you) only if every store failed.
  if (results.every((r) => !r.ok)) process.exit(1);
}

// Only run when called directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBrand, detectCategory, extractSpecs } from '../scraper/specs.js';
import { toRows, fetchShopifyProducts } from '../scraper/index.js';

// [title, productType, vendor, expectedCategory, expectedBrand, expectedSpecs (subset)]
const cases = [
  ['GMKtec NucBox G3 GMK-G3 N100 8/512 BK', '', 'PCWORX', 'Desktops', 'GMKtec', { cpu: 'Intel N100', ram: '8GB', storage: '512GB' }],
  ['Kingston KF432C16BBA/8 8GB 3200MHz DDR4 CL16 DIMM FURY Beast RGB', '', 'My Store', 'Memory', 'Kingston', { capacity: '8GB', memory_type: 'DDR4', speed: '3200MHz', module: 'DIMM' }],
  ['KINGSTON 16GB DDR4 3200MHZ FURY BEAST RAM', 'RAM', 'Kingston', 'Memory', 'Kingston', { capacity: '16GB', memory_type: 'DDR4', speed: '3200MHz' }],
  ['Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz', '', 'Corsair', 'Memory', 'Corsair', { capacity: '32GB', kit: '2x16GB', memory_type: 'DDR5' }],
  ['HP 23.8" 524SF (94C18AA) IPS Monitor', '', 'HP', 'Monitors', 'HP', { screen_size: '23.8"', panel: 'IPS' }],
  ['MSI MAG 275QF 27" QHD 180Hz Rapid IPS Gaming Monitor', 'Monitor', 'MSI', 'Monitors', 'MSI', { screen_size: '27"', resolution: 'QHD (1440p)', refresh_rate: '180Hz', panel: 'IPS' }],
  ['Tecware Infinity M2 Dual Tempered Glass mATX Case w/ 3x120mm ARGB Fans - Black', '', 'My Store', 'Cases', 'Tecware', { form_factor: 'Micro-ATX' }],
  ['Canon G3010 3 in 1 Ink Tank Color Wireless Printer', '', 'My Store', 'Printers', 'Canon', {}],
  ['Canon PIXMA E410 Compact All-In-One for Low-Cost Printing', '', 'My Store', 'Printers', 'Canon', {}],
  ['TP-Link Tapo C110 Home Security Wi-Fi Camera | CCTV', '', 'My Store', 'Cameras & CCTV', 'TP-Link', {}],
  ['SanDisk 32gb/64gb Cruzer Blade USB Flash Drive (Sdcz50-032g-B35)', '', 'My Store', 'Storage', 'SanDisk', { storage_type: 'USB Flash Drive' }],
  ['Monster Hunter Rise Chibi Plush Nargacuga', 'Collectibles', 'DataBlitz', 'Gaming & Consoles', null, {}],
  ['Dobe NSW Protective Case TPU Material For N Switch Lite Dark Gray', '', 'Dobe', 'Gaming & Consoles', 'Dobe', {}],
  ['LOGITECH H390 USB W/ Mic Headset', '', 'PC Express', 'Audio', 'Logitech', { connectivity: 'Wired' }],
  ['Microsoft 365 Personal (12 Months Subscription For PC, Mac, iOS, and Android | For 1 person)', '', 'PC Express', 'Software', 'Microsoft', {}],
  ['ASUS TUF Gaming A15 FA507NV Ryzen 7 7735HS 16GB 512GB SSD RTX 4060 15.6" FHD 144Hz', 'Laptop', 'ASUS', 'Laptops', 'ASUS', { cpu: 'AMD Ryzen 7 7735HS', cpu_brand: 'AMD', ram: '16GB', storage: '512GB', gpu: 'NVIDIA RTX 4060', screen_size: '15.6"', refresh_rate: '144Hz', resolution: 'FHD (1080p)' }],
  ['Lenovo IdeaPad Slim 3 Core i5-1335U 8GB/512GB 15.6" FHD', '', 'Lenovo', 'Laptops', 'Lenovo', { cpu: 'Intel Core i5-1335U', ram: '8GB', storage: '512GB', screen_size: '15.6"' }],
  ['Acer Nitro V 15 Core i5-13420H 16GB DDR5 1TB SSD RTX 4050', '', 'Acer', 'Laptops', 'Acer', { cpu: 'Intel Core i5-13420H', ram: '16GB', storage: '1TB', gpu: 'NVIDIA RTX 4050' }],
  ['MSI GeForce RTX 4060 Ti Ventus 2X Black 8GB GDDR6', 'Graphics Card', 'MSI', 'Graphics Cards', 'MSI', { gpu: 'NVIDIA RTX 4060 Ti', gpu_chip: 'NVIDIA', vram: '8GB' }],
  ['Sapphire Pulse Radeon RX 7600 XT 16GB GDDR6', '', 'Sapphire', 'Graphics Cards', 'Sapphire', { gpu: 'AMD Radeon RX 7600 XT', vram: '16GB' }],
  ['Gigabyte B650M AORUS ELITE AX DDR5 AM5 Motherboard', '', 'Gigabyte', 'Motherboards', 'Gigabyte', { chipset: 'B650', socket: 'AM5', form_factor: 'Micro-ATX', memory_type: 'DDR5', wifi: 'Yes' }],
  ['ASUS PRIME B760M-A WIFI D4 LGA1700', '', 'ASUS', 'Motherboards', 'ASUS', { chipset: 'B760', socket: 'LGA1700', form_factor: 'Micro-ATX', wifi: 'Yes' }],
  ['Seasonic Focus GX-750 750W 80+ Gold Fully Modular Power Supply', '', 'Seasonic', 'Power Supplies', 'Seasonic', { wattage: '750W', efficiency: '80+ Gold', modular: 'Fully Modular' }],
  ['Samsung 990 PRO 1TB PCIe Gen 4 NVMe M.2 SSD', '', 'Samsung', 'Storage', 'Samsung', { capacity: '1TB', storage_type: 'NVMe SSD', pcie_gen: 'Gen 4' }],
  ['Seagate Barracuda 2TB 7200RPM HDD', '', 'Seagate', 'Storage', 'Seagate', { capacity: '2TB', storage_type: 'HDD' }],
  ['AMD Ryzen 5 7600 Processor AM5', '', 'AMD', 'Processors', 'AMD', { cpu: 'AMD Ryzen 5 7600', socket: 'AM5' }],
  ['Intel Core i5-14400F Processor', '', 'Intel', 'Processors', 'Intel', { cpu: 'Intel Core i5-14400F' }],
  ['Deepcool AK400 CPU Cooler', '', 'Deepcool', 'Cooling', 'Deepcool', {}],
  ['Aula AC306 2.4G Wireless Keyboard and Mouse Combo', '', 'My Store', 'Keyboards', 'Aula', { connectivity: 'Wireless' }],
  ['Logitech G304 Lightspeed Wireless Gaming Mouse', '', 'Logitech', 'Mice', 'Logitech', { connectivity: 'Wireless' }],
  ['TP-Link Archer C6 AC1200 Wireless Router', '', 'TP-Link', 'Networking', 'TP-Link', {}],
  ['TP-Link TL-SG108 8-Port Gigabit Switch', '', 'TP-Link', 'Networking', 'TP-Link', {}],
  ['APC Back-UPS 650VA AVR', '', 'APC', 'UPS & Power', 'APC', {}],
  ['Apple MacBook Air 13" M3 chip 8GB 256GB', '', 'Apple', 'Laptops', 'Apple', { cpu: 'Apple M3', ram: '8GB', storage: '256GB', screen_size: '13"' }],
];

for (const [title, type, vendor, cat, brand, specs] of cases) {
  test(title, () => {
    const gotCat = detectCategory(type, title);
    assert.equal(gotCat, cat, 'category');
    assert.equal(detectBrand(vendor, title), brand, 'brand');
    const got = extractSpecs(title, gotCat);
    for (const [k, v] of Object.entries(specs)) assert.equal(got[k], v, `spec ${k}`);
  });
}

test('toRows: variants, default title, compare price, dedupe', () => {
  const products = [
    {
      id: 1, title: 'Kingston Fury Beast DDR5', handle: 'fury-beast', vendor: 'My Store', product_type: 'Memory', tags: [],
      images: [{ src: 'https://cdn/x.jpg' }],
      variants: [
        { id: 11, title: '16GB', price: '3500.00', compare_at_price: '3900.00', available: true },
        { id: 12, title: '32GB', price: '6500.00', compare_at_price: '0.00', available: false },
      ],
    },
    {
      id: 2, title: 'Samsung 990 PRO 1TB NVMe SSD', handle: '990-pro', vendor: 'Samsung', product_type: '', tags: '',
      images: [], variants: [{ id: 21, title: 'Default Title', price: '7,000', available: true }],
    },
  ];
  const rows = toRows('store-1', 'https://shop.example/', products, '2026-01-01T00:00:00Z');
  assert.equal(rows.length, 3);
  const r16 = rows.find((r) => r.external_id === '11');
  assert.equal(r16.title, 'Kingston Fury Beast DDR5 - 16GB');
  assert.equal(r16.compare_at_price, 3900);
  assert.equal(r16.brand, 'Kingston');
  assert.equal(r16.category, 'Memory');
  assert.equal(r16.url, 'https://shop.example/products/fury-beast?variant=11');
  assert.equal(r16._specs.capacity, '16GB');
  const r32 = rows.find((r) => r.external_id === '12');
  assert.equal(r32.compare_at_price, null);
  assert.equal(r32.in_stock, false);
  const ssd = rows.find((r) => r.external_id === '21');
  assert.equal(ssd.title, 'Samsung 990 PRO 1TB NVMe SSD');
  assert.equal(ssd.url, 'https://shop.example/products/990-pro');
  assert.equal(ssd.price, null); // "7,000" isn't a valid Shopify price string -> skipped safely
});

test('fetchShopifyProducts: paginates and rejects non-Shopify pages', async () => {
  const pages = [Array.from({ length: 250 }, (_, i) => ({ id: i })), [{ id: 999 }]];
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return { ok: true, status: 200, text: async () => JSON.stringify({ products: pages[page - 1] || [] }) };
  };
  const all = await fetchShopifyProducts('https://shop.example', { fetchImpl: fakeFetch, delay: 0 });
  assert.equal(all.length, 251);
  assert.equal(calls.length, 2);

  const htmlFetch = async () => ({ ok: true, status: 200, text: async () => '<html>nope</html>' });
  await assert.rejects(fetchShopifyProducts('https://x', { fetchImpl: htmlFetch, delay: 0 }), /Not a Shopify product feed/);
});

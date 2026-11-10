// Rule-based category detection and spec extraction for IT product titles.
// No AI needed: Shopify gives us the vendor and product type, and most
// spec details (RAM, storage, CPU, GPU, screen size...) follow
// predictable patterns in the product title.

// ---------- Brands ----------

const KNOWN_BRANDS = [
  'A4Tech', 'Acer', 'Adata', 'AMD', 'AOC', 'APC', 'Apple', 'Arctic', 'ASRock', 'ASUS',
  'Aula', 'Beelink', 'BenQ', 'Brother', 'Canon', 'Cooler Master', 'Corsair', 'Crucial',
  'D-Link', 'Darkflash', 'Deepcool', 'Dell', 'Epson', 'Fantech', 'G.Skill', 'Galax',
  'Gigabyte', 'GMKtec', 'HP', 'Huawei', 'HyperX', 'Infinix', 'Inno3D', 'Intel', 'Jabra',
  'Kingston', 'Lenovo', 'Lexar', 'LG', 'Lian Li', 'Logitech', 'Mercusys', 'Microsoft',
  'Montech', 'MSI', 'Noctua', 'NZXT', 'Palit', 'Philips', 'PNY', 'PowerColor', 'Rakk',
  'Rapoo', 'Razer', 'Samsung', 'SanDisk', 'Sapphire', 'Seagate', 'Seasonic', 'Secure',
  'SteelSeries', 'TeamGroup', 'Tecware', 'Tenda', 'Thermalright', 'Thermaltake',
  'TP-Link', 'Transcend', 'Ubiquiti', 'Ugreen', 'ViewSonic', 'Western Digital', 'WD',
  'Xiaomi', 'XPG', 'Zotac',
];

// Vendors that are really the store's own name or a placeholder, not a brand.
const GENERIC_VENDORS = /^(my store|default|vendor|unknown|n\/?a|none|pcworx|easypc|easy pc|datablitz|pc express|pcx|dynaquest|pc central|octagon|complink)$/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BRAND_PATTERNS = KNOWN_BRANDS
  .slice()
  .sort((a, b) => b.length - a.length) // match "Cooler Master" before shorter names
  .map((name) => ({ name, re: new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}([^a-z0-9]|$)`, 'i') }));

export function detectBrand(vendor, title) {
  const v = (vendor || '').trim();
  if (v && !GENERIC_VENDORS.test(v)) {
    const known = KNOWN_BRANDS.find((b) => b.toLowerCase() === v.toLowerCase());
    return known || v;
  }
  // Prefer a brand at the very start of the title, then anywhere in it.
  const t = title || '';
  for (const { name, re } of BRAND_PATTERNS) {
    if (new RegExp(`^\\s*${escapeRegex(name)}([^a-z0-9]|$)`, 'i').test(t)) return name;
  }
  for (const { name, re } of BRAND_PATTERNS) {
    if (re.test(t)) return name;
  }
  return null;
}

// ---------- Categories ----------
// Order matters: earlier rules win. For example, a laptop title often
// mentions "RTX 4060", so Laptops must be checked before Graphics Cards.

const CATEGORY_RULES = [
  ['Gaming & Consoles', /\b(nintendo|switch lite|switch oled|n ?switch|nsw|ps[45]\b|playstation|xbox|amiibo|plush|trading card|card game|union arena|racing wheel|wheel mod|joy-?con)\b/i],
  ['Printers', /\b(printer|pixma|ecotank|ink ?tank|toner|ink cartridge|scanner)\b/i],
  ['Laptops', /\b(laptop|notebook|chromebook|macbook|ideapad|thinkpad|vivobook|zenbook|tuf gaming [af]\d{2}|rog strix [gs]\d{2}|nitro v|aspire|predator helios|legion|loq|pavilion|victus|omen \d|inspiron|latitude)\b/i],
  ['Desktops', /\b(desktop|pc build|system unit|mini pc|nucbox|nuc\b|imac|pc package|gaming pc|all[- ]in[- ]one pc)\b/i],
  ['Monitors', /\b(monitor)\b/i],
  ['Graphics Cards', /\b(graphics card|video card|geforce|radeon|rtx ?\d{4}|gtx ?\d{3,4}|rx ?\d{4}|arc ?[ab]\d{3})\b/i],
  ['Motherboards', /\b(motherboard|mobo|mainboard|[abhxz][3-9]\d0[em]?(?=[\s-]?(?:m|i|ds3h|d3h|-?plus|-?pro|aorus|tuf|rog|prime|tomahawk|mortar|elite|gaming|wifi|steel|phantom|riptide|ax)))/i],
  ['Cases', /\b(pc case|computer case|gaming case|chassis|mid[- ]tower|mini[- ]tower|full[- ]tower|matx case|atx case|itx case|case w\/)\b|\bcase\b(?=.*\b(fans?|tempered glass|atx|matx|itx)\b)/i],
  ['Power Supplies', /\b(power supply|psu|80 ?\+|80 ?plus)\b/i],
  ['Cooling', /\b(cpu cooler|air cooler|liquid cooler|aio|cooler|heatsink|thermal paste|case fans?|fan kit|argb fans?)\b/i],
  ['Processors', /\b(processor|ryzen [3579] \d{4}[a-z0-9]*|core i[3579][- ]\d{4,5}[a-z]*|core ultra [579]|threadripper|xeon|athlon)\b/i],
  ['Storage', /\b(ssd|hdd|nvme|m\.2|hard drive|hard disk|flash drive|usb drive|thumb ?drive|memory card|micro ?sd|sd card|external drive|portable drive|cruzer)\b/i],
  ['Memory', /\b(ram|memory|ddr[345]x?|dimm|so-?dimm|fury beast|vengeance|trident z|ripjaws)\b/i],
  ['Keyboards', /\b(keyboard)\b/i],
  ['Mice', /\b(mouse|mice|mouse ?pad|mousepad)\b/i],
  ['Audio', /\b(headset|headphones?|earphones?|earbuds|speakers?|soundbar|microphone|mic\b|tws)\b/i],
  ['Cameras & CCTV', /\b(webcam|web camera|camera|cctv|ip cam|dashcam|dash cam)\b/i],
  ['Networking', /\b(router|network switch|\d+[- ]port|switch\b|access point|wi-?fi|mesh|modem|range extender|lan card|ethernet|network adapter|wireless adapter|bluetooth adapter)\b/i],
  ['UPS & Power', /\b(ups|avr|surge|power strip|extension cord|power bank|powerbank|charger)\b/i],
  ['Software', /\b(windows 1[01]|microsoft 365|office 20\d\d|office home|antivirus|kaspersky|eset|norton|license|subscription)\b/i],
  ['Accessories', /\b(cable|adapter|hub|dock|docking|stand|bag|backpack|sleeve|chair|desk|pad|cleaning|enclosure|kvm|converter|tablet|stylus|ink)\b/i],
];

export function detectCategory(productType, title, tags = []) {
  const type = (productType || '').trim();
  const tagText = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  // Product type is usually set by the store and is the most reliable hint.
  if (type) {
    for (const [category, re] of CATEGORY_RULES) {
      if (re.test(type)) return category;
    }
  }
  for (const [category, re] of CATEGORY_RULES) {
    if (re.test(title || '')) return category;
  }
  if (tagText) {
    for (const [category, re] of CATEGORY_RULES) {
      if (re.test(tagText)) return category;
    }
  }
  return 'Other';
}

// ---------- Spec extractors ----------

function first(re, text, fn = (m) => m[1]) {
  const m = text.match(re);
  return m ? fn(m) : null;
}

function normCapacity(num, unit) {
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  return `${n}${unit.toUpperCase()}`;
}

const RAM_SIZES = new Set([2, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128]);

function cpu(text) {
  const patterns = [
    [/\bcore ultra ([579])[- ]?(\d{3}[a-z]{0,2})\b/i, (m) => `Intel Core Ultra ${m[1]} ${m[2].toUpperCase()}`, 'Intel'],
    [/\bcore ultra ([579])\b/i, (m) => `Intel Core Ultra ${m[1]}`, 'Intel'],
    [/\b(?:intel )?(?:core )?(i[3579])[- ](\d{4,5}[a-z]{0,3})\b/i, (m) => `Intel Core ${m[1].toLowerCase()}-${m[2].toUpperCase()}`, 'Intel'],
    [/\bcore (i[3579])\b/i, (m) => `Intel Core ${m[1].toLowerCase()}`, 'Intel'],
    [/\bryzen (?:ai )?([3579])[- ](\d{3,4}[a-z0-9]{0,4})\b/i, (m) => `AMD Ryzen ${m[1]} ${m[2].toUpperCase()}`, 'AMD'],
    [/\bryzen ai (?:max\+? )?(\d{3})\b/i, (m) => `AMD Ryzen AI ${m[1]}`, 'AMD'],
    [/\bryzen ([3579])\b/i, (m) => `AMD Ryzen ${m[1]}`, 'AMD'],
    [/\b(?:apple )?(m[1-5])( pro| max| ultra)?(?: chip)?\b(?=.*\b(macbook|imac|mac mini|apple|chip)\b)/i, (m) => `Apple ${m[1].toUpperCase()}${m[2] ? ' ' + m[2].trim().replace(/^\w/, (c) => c.toUpperCase()) : ''}`, 'Apple'],
    [/\b(?:intel )?(n\d{3})\b/i, (m) => `Intel ${m[1].toUpperCase()}`, 'Intel'],
    [/\bcore (\d) (\d{3}[a-z]?)\b/i, (m) => `Intel Core ${m[1]} ${m[2].toUpperCase()}`, 'Intel'],
    [/\bceleron\b/i, () => 'Intel Celeron', 'Intel'],
    [/\bpentium\b/i, () => 'Intel Pentium', 'Intel'],
    [/\bsnapdragon x\b ?(elite|plus)?/i, (m) => `Snapdragon X${m[1] ? ' ' + m[1].replace(/^\w/, (c) => c.toUpperCase()) : ''}`, 'Qualcomm'],
  ];
  for (const [re, fmt, brand] of patterns) {
    const m = text.match(re);
    if (m) return { cpu: fmt(m), cpu_brand: brand };
  }
  return {};
}

function gpu(text) {
  const patterns = [
    [/\b(rtx|gtx) ?(\d{3,4})( ?ti)?( ?super)?\b/i, (m) => `NVIDIA ${m[1].toUpperCase()} ${m[2]}${m[3] ? ' Ti' : ''}${m[4] ? ' SUPER' : ''}`, 'NVIDIA'],
    [/\b(?:radeon )?rx ?(\d{4})( ?xtx| ?xt| ?gre)?\b/i, (m) => `AMD Radeon RX ${m[1]}${m[2] ? ' ' + m[2].trim().toUpperCase() : ''}`, 'AMD'],
    [/\barc ?([ab]\d{3})\b/i, (m) => `Intel Arc ${m[1].toUpperCase()}`, 'Intel'],
  ];
  for (const [re, fmt, chip] of patterns) {
    const m = text.match(re);
    if (m) return { gpu: fmt(m), gpu_chip: chip };
  }
  return {};
}

function ramAndStorage(text) {
  const out = {};
  // "8GB/512GB", "16GB | 1TB", "8/512"
  const combo =
    text.match(/\b(\d{1,3})\s?(?:gb)?\s?[/|]\s?(\d{3,4}|[12])\s?(gb|tb)?\b/i) ||
    // "8GB 256GB" or "16GB 1TB" written side by side
    text.match(/\b(\d{1,3})\s?gb,?\s+(\d{3,4}|[1248])\s?(gb|tb)\b/i);
  if (combo) {
    const ram = Number(combo[1]);
    let stor = Number(combo[2]);
    let unit = (combo[3] || '').toUpperCase();
    if (!unit) unit = stor <= 8 ? 'TB' : 'GB';
    if (RAM_SIZES.has(ram) && (unit === 'TB' || stor >= 128)) {
      out.ram = `${ram}GB`;
      out.storage = `${stor}${unit}`;
    }
  }
  if (!out.ram) {
    const ram = text.match(/\b(\d{1,3})\s?gb\s?(?:of\s)?(?:lp)?(?:ddr[345]x?|ram|memory|unified)\b/i);
    if (ram && RAM_SIZES.has(Number(ram[1]))) out.ram = `${Number(ram[1])}GB`;
  }
  if (!out.storage) {
    const st = text.match(/\b(\d{1,4}(?:\.\d)?)\s?(gb|tb)\s?(?:pcie\s?(?:gen\s?\d\s?)?)?(?:nvme|m\.2|ssd|hdd|emmc|storage)\b/i);
    if (st) out.storage = normCapacity(st[1], st[2]);
  }
  // Laptops often say "16GB 512GB SSD": first plain GB value before the storage is the RAM.
  if (!out.ram && out.storage) {
    const plain = text.match(/\b(\d{1,3})\s?gb\b/i);
    if (plain && RAM_SIZES.has(Number(plain[1])) && `${Number(plain[1])}GB` !== out.storage) {
      out.ram = `${Number(plain[1])}GB`;
    }
  }
  return out;
}

function screenSize(text) {
  const m = text.match(/(\d{2}(?:\.\d)?)\s?(?:"|”|''|-?\s?inch(?:es)?\b|in\b)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 10 && n <= 100 ? `${n}"` : null;
}

function refreshRate(text) {
  const m = text.match(/\b(\d{2,3})\s?hz\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 50 && n <= 600 ? `${n}Hz` : null;
}

function resolution(text) {
  if (/\b(4k|uhd|2160p|3840\s?x\s?2160)\b/i.test(text)) return '4K UHD';
  if (/\b(qhd|wqhd|1440p|2k|2560\s?x\s?1440)\b/i.test(text)) return 'QHD (1440p)';
  if (/\b(wuxga|1920\s?x\s?1200)\b/i.test(text)) return 'WUXGA (1200p)';
  if (/\b(fhd|full hd|1080p|1920\s?x\s?1080)\b/i.test(text)) return 'FHD (1080p)';
  if (/\b(hd|720p|1366\s?x\s?768)\b/i.test(text)) return 'HD';
  return null;
}

function panel(text) {
  const m = text.match(/\b(oled|qd-?oled|ips|va|tn|mini-?led)\b/i);
  return m ? m[1].toUpperCase().replace('-', '') : null;
}

function memoryType(text) {
  const m = text.match(/\b(lp)?(ddr[345])(x)?\b/i);
  if (!m) return null;
  return `${m[1] ? 'LP' : ''}${m[2].toUpperCase()}${m[3] ? 'X' : ''}`;
}

function memorySpeed(text) {
  const m = text.match(/\b(\d{4})\s?(mhz|mt\/s)\b/i);
  return m ? `${m[1]}MHz` : null;
}

function memoryKit(text) {
  const m = text.match(/\b([24])\s?x\s?(\d{1,2})\s?gb\b/i);
  return m ? `${m[1]}x${m[2]}GB` : null;
}

function storageType(text) {
  if (/\bnvme\b/i.test(text)) return 'NVMe SSD';
  if (/\b(m\.2)\b/i.test(text) && /\bssd\b/i.test(text)) return 'M.2 SSD';
  if (/\bssd\b/i.test(text)) return 'SSD';
  if (/\b(hdd|hard drive|hard disk)\b/i.test(text)) return 'HDD';
  if (/\b(micro ?sd|sd card|memory card)\b/i.test(text)) return 'Memory Card';
  if (/\b(flash drive|usb drive|thumb ?drive|cruzer)\b/i.test(text)) return 'USB Flash Drive';
  return null;
}

function formFactor(text) {
  if (/\b(e-?atx)\b/i.test(text)) return 'E-ATX';
  if (/\b(mini-?itx|itx)\b/i.test(text)) return 'Mini-ITX';
  if (/\b(micro-?atx|m-?atx|matx)\b/i.test(text)) return 'Micro-ATX';
  // MSI/Gigabyte/ASUS boards with "M" suffix (B650M, B760M) are Micro-ATX
  if (/\b[abhxz]\d{3}m\b/i.test(text)) return 'Micro-ATX';
  if (/\batx\b/i.test(text)) return 'ATX';
  return null;
}

function chipset(text) {
  const m = text.match(/\b([abhxz][3-9]\d0)[em]?\b/i);
  return m ? m[1].toUpperCase() : null;
}

function socket(text) {
  const m = text.match(/\b(am[45]|lga\s?\d{4}|sTRX?\d|tr\d)\b/i);
  return m ? m[1].toUpperCase().replace(/\s/g, '') : null;
}

function wattage(text) {
  const m = text.match(/\b(\d{3,4})\s?w(?:att)?s?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 200 && n <= 2000 ? `${n}W` : null;
}

function efficiency(text) {
  const m = text.match(/\b80\s?(?:\+|plus)\s?(white|bronze|silver|gold|platinum|titanium)?\b/i);
  if (!m) return null;
  return m[1] ? `80+ ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}` : '80+';
}

function modular(text) {
  if (/\b(fully|full) modular\b/i.test(text)) return 'Fully Modular';
  if (/\bsemi[- ]?modular\b/i.test(text)) return 'Semi-Modular';
  if (/\bnon[- ]?modular\b/i.test(text)) return 'Non-Modular';
  return null;
}

function vram(text) {
  const m = text.match(/\b(\d{1,2})\s?gb\s?(?:g?ddr\d[x]?|vram)\b/i);
  return m ? `${Number(m[1])}GB` : null;
}

function connectivity(text) {
  const wireless = /\b(wireless|2\.4\s?g(hz)?|bluetooth|bt\b)\b/i.test(text);
  const wired = /\b(wired|usb)\b/i.test(text);
  if (wireless && /\bbluetooth\b/i.test(text)) return 'Wireless (Bluetooth)';
  if (wireless) return 'Wireless';
  if (wired) return 'Wired';
  return null;
}

// ---------- Main entry ----------

export function extractSpecs(title, category) {
  const text = (title || '').replace(/\s+/g, ' ');
  const specs = {};
  const set = (key, val) => {
    if (val !== null && val !== undefined && val !== '') specs[key] = String(val);
  };

  switch (category) {
    case 'Laptops':
    case 'Desktops': {
      const c = cpu(text);
      set('cpu', c.cpu); set('cpu_brand', c.cpu_brand);
      const g = gpu(text);
      set('gpu', g.gpu);
      const rs = ramAndStorage(text);
      set('ram', rs.ram); set('storage', rs.storage);
      if (category === 'Laptops') {
        set('screen_size', screenSize(text));
        set('refresh_rate', refreshRate(text));
        set('resolution', resolution(text));
      }
      break;
    }
    case 'Processors': {
      const c = cpu(text);
      set('cpu', c.cpu); set('cpu_brand', c.cpu_brand);
      set('socket', socket(text));
      break;
    }
    case 'Graphics Cards': {
      const g = gpu(text);
      set('gpu', g.gpu); set('gpu_chip', g.gpu_chip);
      set('vram', vram(text));
      break;
    }
    case 'Motherboards': {
      set('chipset', chipset(text));
      set('socket', socket(text));
      set('form_factor', formFactor(text));
      set('memory_type', memoryType(text));
      if (/\b(wi-?fi|ax\b|wifi\s?\d)\b/i.test(text)) set('wifi', 'Yes');
      break;
    }
    case 'Memory': {
      const cap = text.match(/\b(\d{1,3})\s?gb\b/i);
      const kit = memoryKit(text);
      if (kit) {
        const [n, size] = kit.match(/(\d)x(\d+)/).slice(1).map(Number);
        set('capacity', `${n * size}GB`);
        set('kit', kit);
      } else if (cap) {
        set('capacity', `${Number(cap[1])}GB`);
      }
      set('memory_type', memoryType(text));
      set('speed', memorySpeed(text));
      if (/\b(so-?dimm|laptop)\b/i.test(text)) set('module', 'SO-DIMM');
      else if (/\b(dimm|desktop)\b/i.test(text)) set('module', 'DIMM');
      break;
    }
    case 'Storage': {
      const st = text.match(/\b(\d{1,4}(?:\.\d)?)\s?(gb|tb)\b/i);
      if (st) set('capacity', normCapacity(st[1], st[2]));
      set('storage_type', storageType(text));
      const gen = text.match(/\bgen\s?([345])\b/i);
      if (gen) set('pcie_gen', `Gen ${gen[1]}`);
      break;
    }
    case 'Monitors': {
      set('screen_size', screenSize(text));
      set('resolution', resolution(text));
      set('refresh_rate', refreshRate(text));
      set('panel', panel(text));
      if (/\bcurved\b/i.test(text)) set('curved', 'Yes');
      break;
    }
    case 'Power Supplies': {
      set('wattage', wattage(text));
      set('efficiency', efficiency(text));
      set('modular', modular(text));
      break;
    }
    case 'Cases': {
      set('form_factor', formFactor(text));
      break;
    }
    case 'Keyboards':
    case 'Mice':
    case 'Audio': {
      set('connectivity', connectivity(text));
      if (category === 'Keyboards' && /\bmechanical\b/i.test(text)) set('switch_type', 'Mechanical');
      break;
    }
    default:
      break;
  }
  return specs;
}

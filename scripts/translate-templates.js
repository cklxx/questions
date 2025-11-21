const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '..', 'data', 'templates.json');
const TARGET = path.resolve(__dirname, '..', 'data', 'templates_en.json');
const placeholderRegex = /{{\s*[^}]+\s*}}/g;
const BATCH_CHAR_LIMIT = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizePlaceholders = (text) => {
  const placeholders = Array.from(text.match(placeholderRegex) || []);
  let safe = text;
  placeholders.forEach((ph, idx) => {
    safe = safe.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `__PH_${idx}__`);
  });
  return { safe, placeholders };
};

const restorePlaceholders = (text, placeholders) => {
  let restored = text;
  placeholders.forEach((ph, idx) => {
    restored = restored.replace(new RegExp(`__PH_${idx}__`, 'g'), ph);
  });
  return restored;
};

const translateViaGoogle = async (text, attempt = 0) => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(
    text,
  )}`;
  const res = await fetch(url);
  if (res.status === 429 && attempt < 5) {
    const wait = 1000 * (attempt + 1);
    console.warn(`Google rate limited, retrying in ${wait}ms`);
    await sleep(wait);
    return translateViaGoogle(text, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Google translate failed: ${res.status}`);
  }
  const data = await res.json();
  const translated = (data?.[0] || []).map((chunk) => chunk[0]).join('');
  if (!translated) throw new Error('Missing translation text');
  return translated;
};

const translateBatch = async (batch) => {
  const payload = batch.map((item) => `[[${item.id}]]${item.safe}[[/${item.id}]]`).join('\n');
  const translated = await translateViaGoogle(payload);
  const regex = /\[\[\s*(\d+)\s*\]\]([\s\S]*?)\[\[\s*\/\s*\1\s*\]\]/g;
  const matches = new Map();
  let match;
  while ((match = regex.exec(translated)) !== null) {
    matches.set(Number(match[1]), match[2]);
  }

  if (matches.size !== batch.length) {
    console.warn(`Batch parse mismatch: expected ${batch.length}, got ${matches.size}; falling back to single requests.`);
    return Promise.all(
      batch.map(async (item) => {
        const translatedSafe = await translateViaGoogle(item.safe);
        return restorePlaceholders(translatedSafe, item.placeholders).trim();
      }),
    );
  }

  return batch.map((item) => restorePlaceholders(matches.get(item.id) ?? item.safe, item.placeholders).trim());
};

const collectStrings = (node, set) => {
  if (typeof node === 'string') {
    const hasNonAscii = [...node].some((ch) => ch.charCodeAt(0) > 127);
    if (hasNonAscii) set.add(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectStrings(item, set));
    return;
  }
  if (node && typeof node === 'object') {
    Object.values(node).forEach((value) => collectStrings(value, set));
  }
};

const buildTranslationMap = async (strings) => {
  const items = Array.from(strings).map((original, idx) => {
    const { safe, placeholders } = sanitizePlaceholders(original);
    return { id: idx, original, safe, placeholders };
  });

  const batches = [];
  let current = [];
  let length = 0;

  items.forEach((item) => {
    const segmentLength = item.safe.length + String(item.id).length * 2 + 10;
    if (current.length && length + segmentLength > BATCH_CHAR_LIMIT) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(item);
    length += segmentLength;
  });
  if (current.length) batches.push(current);

  const translations = new Map();
  for (let i = 0; i < batches.length; i += 1) {
    console.log(`  translating batch ${i + 1}/${batches.length}`);
    const batch = batches[i];
    const results = await translateBatch(batch);
    batch.forEach((item, idx) => {
      translations.set(item.original, results[idx]);
    });
    await sleep(150);
  }

  return translations;
};

const translateValue = (value, map) => (typeof value === 'string' && map.has(value) ? map.get(value) : value);

const translateTemplate = (tpl, map) => {
  const translateFallback = (val) => translateValue(val, map);
  const translateMaybe = (val) => (typeof val === 'string' ? translateFallback(val) : val);

  const next = {
    ...tpl,
    name: translateFallback(tpl.name),
    short_description: translateFallback(tpl.short_description),
    prompt_template: translateFallback(tpl.prompt_template),
  };

  next.placeholders = (tpl.placeholders || []).map((p) => ({
    ...p,
    label: translateFallback(p.label),
    hint: translateFallback(p.hint),
    default: translateMaybe(p.default),
    enum_options: p.enum_options ? p.enum_options.map((opt) => translateValue(opt, map)) : undefined,
  }));

  if (tpl.controls) {
    next.controls = tpl.controls.map((ctrl) => ({
      ...ctrl,
      label: translateValue(ctrl.label, map),
    }));
  }

  if (tpl.evaluation_rules) {
    next.evaluation_rules = {
      auto_checks: tpl.evaluation_rules.auto_checks
        ? tpl.evaluation_rules.auto_checks.map((item) => translateValue(item, map))
        : undefined,
      manual_checklist: tpl.evaluation_rules.manual_checklist
        ? tpl.evaluation_rules.manual_checklist.map((item) => translateValue(item, map))
        : undefined,
    };
  }

  next.tags = tpl.tags ? tpl.tags.map((tag) => translateValue(tag, map)) : undefined;

  if (tpl.example_inputs) {
    next.example_inputs = tpl.example_inputs.map((ex) => ({
      ...ex,
      name: translateValue(ex.name, map),
      notes: translateValue(ex.notes, map),
      placeholder_values: Object.fromEntries(
        Object.entries(ex.placeholder_values || {}).map(([key, val]) => [
          key,
          typeof val === 'string' ? translateValue(val, map) : val,
        ]),
      ),
    }));
  }

  return next;
};

const run = async () => {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const strings = new Set();
  collectStrings(source, strings);

  console.log(`Translating ${strings.size} unique strings...`);
  const translationMap = await buildTranslationMap(strings);

  const categories = source.categories.map((cat) => ({
    ...cat,
    name: translateValue(cat.name, translationMap),
    description: translateValue(cat.description, translationMap),
    templates: (cat.templates || []).map((tpl) => translateTemplate(tpl, translationMap)),
  }));

  const output = {
    ...source,
    language: 'en',
    categories,
  };

  fs.writeFileSync(TARGET, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Done. Saved translated dataset to ${TARGET}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

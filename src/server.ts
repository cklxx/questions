import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, statSync } from 'fs';
import geoip from 'geoip-lite';
import { getAIConfig } from './aiFiller';

type Language = 'zh' | 'en';

const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../data/templates.json');
const dataPathEn = path.resolve(__dirname, '../data/templates_en.json');
const appRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const supportedLanguages: Language[] = ['zh', 'en'];
const defaultLanguage: Language = 'zh';
const priorityCategories = ['text2image'];

const sortByPriority = <T extends { id: string }>(items: T[], priorities: string[]): T[] => {
  const priorityMap = new Map(priorities.map((id, idx) => [id, idx]));
  const base = priorities.length;

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = priorityMap.has(a.item.id) ? priorityMap.get(a.item.id)! : base + a.index;
      const bRank = priorityMap.has(b.item.id) ? priorityMap.get(b.item.id)! : base + b.index;
      return aRank - bRank;
    })
    .map((entry) => entry.item);
};

const addTemplateMeta = (tpl: any, fallbackUpdatedAt: string) => ({
  ...tpl,
  updated_at: tpl.updated_at || fallbackUpdatedAt,
});

const loadDataset = (lang: Language, filePath: string) => {
  const lastModified = statSync(filePath).mtime.toISOString();
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  const categories = sortByPriority(parsed.categories || [], priorityCategories);
  const allTemplates: any[] = [];
  categories.forEach((cat: any) => {
    if (cat.templates && Array.isArray(cat.templates)) {
      allTemplates.push(...cat.templates.map((tpl: any) => addTemplateMeta(tpl, lastModified)));
    }
  });

  return {
    data: { ...parsed, categories },
    allTemplates,
    lastModified,
  };
};

const zhDataset = loadDataset('zh', dataPath);
if (!existsSync(dataPathEn)) {
  console.warn('templates_en.json not found, falling back to zh dataset for en requests.');
}
const datasets: Record<Language, ReturnType<typeof loadDataset>> = {
  zh: zhDataset,
  en: existsSync(dataPathEn) ? loadDataset('en', dataPathEn) : zhDataset,
};

const defaultDataset = datasets[defaultLanguage];
const datasetLastModified = defaultDataset.lastModified;

const normalizeLanguage = (candidate?: string): Language =>
  supportedLanguages.includes(candidate as Language) ? (candidate as Language) : defaultLanguage;

const getLanguageForRequest = (req: express.Request): Language => {
  if (typeof req.query.lang === 'string') {
    return normalizeLanguage(req.query.lang.toLowerCase());
  }
  const detected = detectLanguage(req).language;
  return normalizeLanguage(detected);
};

const getDatasetForRequest = (req: express.Request) => {
  const lang = getLanguageForRequest(req);
  return { lang, ...datasets[lang] };
};

const templatePaths = Array.from(
  new Set(datasets[defaultLanguage].allTemplates.map((tpl: any) => tpl.id)),
).map((id) => `/templates/${id}`);

const getSiteUrl = (req: any) => {
  if (SITE_URL) return SITE_URL;
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0];
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/, '');
};

const app = express();
app.use(express.json());

const getClientIp = (req: express.Request) => {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const rawIp = req.socket.remoteAddress || req.ip || '';
  return rawIp.replace(/^::ffff:/, '');
};

const detectLanguage = (req: express.Request): { language: Language; source: string; country?: string } => {
  const acceptLang = (req.get('accept-language') || '').toLowerCase();
  if (acceptLang.includes('zh')) {
    return { language: 'zh', source: 'accept-language' };
  }

  const ip = getClientIp(req);
  const geo = ip ? geoip.lookup(ip) : null;
  const country = geo?.country || '';
  if (country === 'CN') {
    return { language: 'zh', source: 'geoip', country };
  }

  const englishCountries = new Set(['US', 'GB', 'AU', 'CA', 'NZ', 'IE', 'SG', 'IN']);
  if (englishCountries.has(country)) {
    return { language: 'en', source: 'geoip', country };
  }

  return { language: 'en', source: 'default', country: country || undefined };
};

// API routes
app.get('/api/templates/categories', (req, res) => {
  const { data: dataset } = getDatasetForRequest(req);
  res.json({ categories: dataset.categories || [] });
});

app.get('/api/config', (req, res) => {
  res.json(getAIConfig());
});

app.get('/api/templates', (req, res) => {
  const { data: dataset, allTemplates } = getDatasetForRequest(req);
  const { category } = req.query;
  let templates = allTemplates;
  if (category && typeof category === 'string') {
    templates = allTemplates.filter((t: any) => t.category_id === category);
  }
  res.json({ templates });
});

app.get('/api/templates/:id', (req, res) => {
  const { allTemplates } = getDatasetForRequest(req);
  const template = allTemplates.find((t: any) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

app.post('/api/templates/:id/render', (req, res) => {
  const { allTemplates } = getDatasetForRequest(req);
  const template = allTemplates.find((t: any) => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { placeholderValues = {} } = req.body;
  let rendered = template.prompt_template || '';
  const missing: string[] = [];

  (template.placeholders || []).forEach((p: any) => {
    const val = placeholderValues[p.key];
    const filled = val !== undefined && val !== null && val !== '';
    const pattern = new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(pattern, filled ? String(val) : `{{${p.key}}}`);
    if (p.required && !filled) {
      missing.push(p.label || p.key);
    }
  });

  res.json({ rendered_prompt: rendered, missing_required: missing });
});

app.post('/api/templates/:id/ai-fill', async (req, res) => {
  const { allTemplates } = getDatasetForRequest(req);
  const template = allTemplates.find((t: any) => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { placeholderValues = {}, target_key } = req.body;
  const { suggestValues } = await import('./aiFiller');

  try {
    const result = await suggestValues(template, placeholderValues, target_key);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'AI fill failed' });
  }
});

app.get('/api/locale', (req, res) => {
  const result = detectLanguage(req);
  res.json(result);
});

app.get('/robots.txt', (req, res) => {
  const siteUrl = getSiteUrl(req);
  const lines = [
    'User-agent: *',
    'Allow: /',
    siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '',
  ].filter(Boolean);
  res.type('text/plain').send(lines.join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const siteUrl = getSiteUrl(req);
  const base = siteUrl || `${req.protocol}://${req.get('host')}`;
  const normalizedBase = base.replace(/\/+$/, '');
  const urls = [`${normalizedBase}/`, ...templatePaths.map((p) => `${normalizedBase}${p}`)];
  const lastmod = datasetLastModified;
  const doc = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (loc) =>
        `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq></url>`,
    ),
    '</urlset>',
  ].join('');

  res.type('application/xml').send(doc);
});

const startServer = async () => {
  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: path.join(appRoot, 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('🚀 Vite dev server integrated (HMR enabled)');
  } else {
    app.use(express.static(path.join(appRoot, 'public')));
    app.use((_req, res) => {
      res.sendFile(path.join(appRoot, 'public/index.html'));
    });
  }

  console.log(
    `Loaded ${defaultDataset.allTemplates.length} templates across ${defaultDataset.data.categories.length} categories.`,
  );

  app.listen(PORT, () => {
    console.log(`Template server running at http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});

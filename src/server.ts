import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, statSync } from 'fs';
import { getAIConfig } from './aiFiller';

const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../data/templates.json');
const appRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const datasetLastModified = statSync(dataPath).mtime.toISOString();

// Extract all templates from categories
const allTemplates: any[] = [];
(data.categories || []).forEach((cat: any) => {
  if (cat.templates && Array.isArray(cat.templates)) {
    allTemplates.push(...cat.templates);
  }
});

const templatePaths = Array.from(new Set(allTemplates.map((tpl: any) => tpl.id))).map(
  (id) => `/templates/${id}`,
);

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

// API routes
app.get('/api/templates/categories', (req, res) => {
  res.json({ categories: data.categories || [] });
});

app.get('/api/config', (req, res) => {
  res.json(getAIConfig());
});

app.get('/api/templates', (req, res) => {
  const { category } = req.query;
  let templates = allTemplates;
  if (category && typeof category === 'string') {
    templates = allTemplates.filter((t: any) => t.category_id === category);
  }
  res.json({ templates });
});

app.get('/api/templates/:id', (req, res) => {
  const template = allTemplates.find((t: any) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

app.post('/api/templates/:id/render', (req, res) => {
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

// Development: Vite middleware
if (isDev) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: path.join(appRoot, 'frontend'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  console.log('🚀 Vite dev server integrated (HMR enabled)');
}
// Production: Serve static files
else {
  app.use(express.static(path.join(appRoot, 'public')));
  app.use((_req, res) => {
    res.sendFile(path.join(appRoot, 'public/index.html'));
  });
}

console.log(`Loaded ${allTemplates.length} templates across ${data.categories.length} categories.`);

app.listen(PORT, () => {
  console.log(`Template server running at http://localhost:${PORT}`);
});

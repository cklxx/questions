import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { getAIConfig } from './aiFiller';

const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../data/templates.json');
const appRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

const data = JSON.parse(readFileSync(dataPath, 'utf8'));

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
  let templates = data.templates || [];
  if (category && typeof category === 'string') {
    templates = templates.filter((t: any) => t.category_id === category);
  }
  res.json({ templates });
});

app.get('/api/templates/:id', (req, res) => {
  const template = (data.templates || []).find((t: any) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

app.post('/api/templates/:id/render', (req, res) => {
  const template = (data.templates || []).find((t: any) => t.id === req.params.id);
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
  const template = (data.templates || []).find((t: any) => t.id === req.params.id);
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

const templates = data.templates || [];
const categories = data.categories || [];
console.log(`Loaded ${templates.length} templates across ${categories.length} categories.`);

app.listen(PORT, () => {
  console.log(`Template server running at http://localhost:${PORT}`);
});

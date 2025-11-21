import express from 'express';
import path from 'path';
import { loadTemplates } from './templateLoader';
import createTemplateRouter from './routes/templates';
import { TemplateStore } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

let templateStore: TemplateStore;
try {
  templateStore = loadTemplates();
  console.log(
    `Loaded ${templateStore.templatesById.size} templates across ${templateStore.raw.categories.length} categories.`,
  );
} catch (err) {
  const error = err as Error;
  console.error('模板加载失败:', error.message);
  process.exit(1);
}

app.use('/api/templates', createTemplateRouter(templateStore));

const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));

app.use((_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Template server running at http://localhost:${PORT}`);
});

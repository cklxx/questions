import { Router, Request, Response } from 'express';
import { renderTemplate } from '../promptRenderer';
import { suggestValues } from '../aiFiller';
import { TemplateStore } from '../types';

export default function createTemplateRouter(templateStore: TemplateStore): Router {
  const router = Router();

  router.get('/categories', (_req: Request, res: Response) => {
    const categories = templateStore.raw.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      template_count: (cat.templates || []).length,
    }));
    res.json({ categories });
  });

  router.get('/', (req: Request, res: Response) => {
    const { category } = req.query;
    const categoryFilter = typeof category === 'string' ? category : undefined;
    const templates: unknown[] = [];
    templateStore.raw.categories.forEach((cat) => {
      if (categoryFilter && cat.id !== categoryFilter) return;
      (cat.templates || []).forEach((tpl) => {
        templates.push({
          id: tpl.id,
          name: tpl.name,
          short_description: tpl.short_description,
          category_id: tpl.category_id,
          tags: tpl.tags || [],
        });
      });
    });
    res.json({ templates });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const tpl = templateStore.templatesById.get(req.params.id);
    if (!tpl) {
      return res.status(404).json({ error: '模板不存在' });
    }
    return res.json(tpl);
  });

  router.post('/:id/render', (req: Request, res: Response) => {
    const tpl = templateStore.templatesById.get(req.params.id);
    if (!tpl) {
      return res.status(404).json({ error: '模板不存在' });
    }
    const body = (req.body || {}) as { placeholderValues?: Record<string, unknown> };
    const { placeholderValues = {} } = body;
    const { rendered, missingRequired } = renderTemplate(tpl, placeholderValues);
    return res.json({ rendered_prompt: rendered, missing_required: missingRequired });
  });

  router.post('/:id/ai-fill', (req: Request, res: Response) => {
    const tpl = templateStore.templatesById.get(req.params.id);
    if (!tpl) {
      return res.status(404).json({ error: '模板不存在' });
    }
    const body = (req.body || {}) as { placeholderValues?: Record<string, unknown>; target_key?: string };
    const { placeholderValues = {}, target_key: targetKey } = body;
    const suggestions = suggestValues(tpl, placeholderValues, targetKey);
    return res.json(suggestions);
  });

  return router;
}

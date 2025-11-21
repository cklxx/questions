import fs from 'fs';
import path from 'path';
import { Category, Template, TemplateLibrary, TemplateStore } from './types';

const DATA_PATH = path.resolve(process.cwd(), 'data/templates.json');

function assertUniqueIds(items: { id: string }[], type: string): void {
  const seen = new Set<string>();
  items.forEach((item) => {
    if (seen.has(item.id)) {
      throw new Error(`${type} ID 重复: ${item.id}`);
    }
    seen.add(item.id);
  });
}

function validateTemplate(template: Template): void {
  if (!template.id || !template.name || !template.prompt_template) {
    throw new Error(`模板缺少核心字段: ${template.id || 'unknown'}`);
  }

  const placeholderKeys = new Set((template.placeholders || []).map((p) => p.key));
  if (placeholderKeys.size !== (template.placeholders || []).length) {
    throw new Error(`模板 ${template.id} 的占位符 key 存在重复`);
  }

  const missingPlaceholders = Array.from(placeholderKeys).filter(
    (key) => !template.prompt_template.includes(`{{${key}}}`),
  );
  if (missingPlaceholders.length > 0) {
    throw new Error(`模板 ${template.id} 的 prompt_template 未包含占位符: ${missingPlaceholders.join(', ')}`);
  }
}

export function loadTemplates(): TemplateStore {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw) as TemplateLibrary;

  if (!Array.isArray(data.categories)) {
    throw new Error('templates.json 缺少 categories 数组');
  }

  assertUniqueIds(data.categories, '分类');

  const templatesById = new Map<string, Template>();
  data.categories.forEach((category: Category) => {
    const templates = category.templates || [];
    assertUniqueIds(templates, `分类 ${category.id} 下模板`);
    templates.forEach((tpl: Template) => {
      validateTemplate(tpl);
      templatesById.set(tpl.id, tpl);
    });
  });

  return { raw: data, templatesById };
}

import { Placeholder, Template } from './types';

function enforceConstraints(value: unknown, placeholder: Placeholder): unknown {
  if (!placeholder.constraints) return value;
  const constraints = placeholder.constraints;
  let adjustedValue: unknown = value;

  if (typeof adjustedValue === 'number') {
    let numericValue = adjustedValue;
    if (typeof constraints.min === 'number') {
      numericValue = Math.max(numericValue, constraints.min);
    }
    if (typeof constraints.max === 'number') {
      numericValue = Math.min(numericValue, constraints.max);
    }
    adjustedValue = numericValue;
  }

  if (typeof adjustedValue === 'string' && typeof constraints.maxLength === 'number') {
    adjustedValue = adjustedValue.slice(0, constraints.maxLength);
  }

  return adjustedValue;
}

function replacePlaceholder(templateText: string, key: string, value: unknown): string {
  const placeholderPattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
  return templateText.replace(placeholderPattern, String(value));
}

export function renderTemplate(
  template: Template,
  values: Record<string, unknown> = {},
): { rendered: string; missingRequired: string[] } {
  let rendered = template.prompt_template;
  const missingRequired: string[] = [];

  (template.placeholders || []).forEach((placeholder) => {
    const provided = values[placeholder.key];
    const resolved = provided ?? placeholder.default;
    if (resolved === undefined || resolved === null || resolved === '') {
      if (placeholder.required) {
        missingRequired.push(placeholder.key);
      }
      return;
    }
    const safeValue = enforceConstraints(resolved, placeholder);
    rendered = replacePlaceholder(rendered, placeholder.key, safeValue ?? '');
  });

  return { rendered, missingRequired };
}

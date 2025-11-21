import { Placeholder, Template } from './types';

function pickEnumOption(placeholder: Placeholder): unknown {
  if (Array.isArray(placeholder.enum_options) && placeholder.enum_options.length > 0) {
    return placeholder.enum_options[0];
  }
  return placeholder.default ?? placeholder.label;
}

function deriveFromExample(template: Template, key: string): unknown {
  const [firstExample] = template.example_inputs || [];
  return firstExample?.placeholder_values?.[key];
}

export function suggestValues(
  template: Template,
  userValues: Record<string, unknown> = {},
  targetKey?: string,
): { suggested_values: Record<string, unknown>; reasoning: string } {
  const suggested: Record<string, unknown> = {};

  (template.placeholders || []).forEach((placeholder) => {
    if (targetKey && placeholder.key !== targetKey) {
      return;
    }

    if (userValues[placeholder.key] !== undefined && userValues[placeholder.key] !== '') {
      return;
    }

    let value = deriveFromExample(template, placeholder.key);
    if (value === undefined || value === null) {
      if (placeholder.type === 'enum') {
        value = pickEnumOption(placeholder);
      } else if (placeholder.default !== undefined) {
        value = placeholder.default;
      } else if (placeholder.type === 'number') {
        value = placeholder.constraints?.min ?? 1;
      } else if (placeholder.type === 'boolean') {
        value = placeholder.default ?? false;
      } else {
        value = placeholder.hint || '';
      }
    }
    suggested[placeholder.key] = value;
  });

  return {
    suggested_values: suggested,
    reasoning: '基于示例、默认值和占位符类型的规则型填充',
  };
}

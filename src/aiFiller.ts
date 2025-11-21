import OpenAI from 'openai';
import { Placeholder, Template } from './types';

// Environment configuration
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
};

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!AI_CONFIG.apiKey) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: AI_CONFIG.apiKey,
      baseURL: AI_CONFIG.baseURL,
    });
  }
  return openaiClient;
}

export function isAIConfigured(): boolean {
  return !!AI_CONFIG.apiKey;
}

export function getAIConfig() {
  return {
    configured: isAIConfigured(),
    baseUrl: AI_CONFIG.baseURL,
    model: AI_CONFIG.model,
  };
}

// Fallback rule-based filling
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

function ruleBasedSuggest(
  template: Template,
  userValues: Record<string, unknown> = {},
  targetKey?: string,
): Record<string, unknown> {
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

  return suggested;
}

// AI-based filling using OpenAI SDK
function buildAIPrompt(
  template: Template,
  userValues: Record<string, unknown>,
  targetKey?: string,
): string {
  const placeholdersDef = (template.placeholders || [])
    .filter((p) => !targetKey || p.key === targetKey)
    .filter((p) => p.ai_fill)
    .map((p) => ({
      key: p.key,
      label: p.label,
      type: p.type,
      hint: p.hint,
      required: p.required,
      enum_options: p.enum_options,
      constraints: p.constraints,
    }));

  const examples = template.example_inputs?.[0]?.placeholder_values || {};

  const prompt = `
You are helping to fill in a template for: "${template.name}"
Description: ${template.short_description}

Template structure: ${template.prompt_template}

Placeholders to fill:
${JSON.stringify(placeholdersDef, null, 2)}

User has already filled:
${JSON.stringify(userValues, null, 2)}

${Object.keys(examples).length > 0 ? `Example values:\n${JSON.stringify(examples, null, 2)}` : ''}

${targetKey ? `Focus on filling ONLY the field: "${targetKey}"` : 'Fill in all missing required fields and suggest values for optional fields when appropriate.'}

Rules:
1. Return ONLY valid JSON with the structure: {"suggested_values": {"field_key": "value"}}
2. Respect field types (string, number, boolean, enum)
3. For enum fields, choose from the provided options only
4. Follow constraints (min, max) for number fields
5. Use hints and examples as guidance
6. Keep values concise and relevant to the template purpose
7. For Chinese templates, provide Chinese values

Return your response now:`.trim();

  return prompt;
}

export async function suggestValues(
  template: Template,
  userValues: Record<string, unknown> = {},
  targetKey?: string,
): Promise<{ suggested_values: Record<string, unknown>; reasoning: string }> {
  const client = getOpenAIClient();

  // If AI is not configured, fall back to rule-based
  if (!client) {
    const suggested = ruleBasedSuggest(template, userValues, targetKey);
    return {
      suggested_values: suggested,
      reasoning: '基于示例、默认值和占位符类型的规则型填充（AI 未配置）',
    };
  }

  try {
    const prompt = buildAIPrompt(template, userValues, targetKey);

    const completion = await client.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that fills in template placeholders. Always respond with valid JSON only, no additional text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: AI_CONFIG.temperature,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    const parsed = JSON.parse(content);
    const suggested = parsed.suggested_values || {};

    return {
      suggested_values: suggested,
      reasoning: `AI 填充 (${AI_CONFIG.model})`,
    };
  } catch (error) {
    console.error('AI fill error, falling back to rule-based:', error);

    // Fallback to rule-based on error
    const suggested = ruleBasedSuggest(template, userValues, targetKey);
    return {
      suggested_values: suggested,
      reasoning: `规则型填充（AI 调用失败: ${error instanceof Error ? error.message : 'Unknown error'}）`,
    };
  }
}

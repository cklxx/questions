import OpenAI from 'openai';
import { Placeholder, Template } from './types';

// Environment configuration
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '1.1'),
  presencePenalty: parseFloat(process.env.OPENAI_PRESENCE_PENALTY || '0.4'),
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
1. Return ONLY valid XML, no markdown fences. Root element: <response>
2. Inside <response>, include <suggested_values> with multiple <field key="...">value</field> entries
3. Also include a <reasoning> brief justification </reasoning>
4. Respect field types (string, number, boolean, enum)
5. For enum fields, choose from the provided options only
6. Follow constraints (min, max) for number fields
7. Use hints and examples as guidance; keep values concise; Chinese templates返回中文值
8. Prefer rare yet delightful word choices that still fit the context; avoid repetitive phrasing, inject vivid specificity, and weave at least one uncommon but apt term (e.g., luminescent, serendipitous, sylvan, effervescent, 飒然, 澄明)

Example format (do not add extra text):
<response>
  <suggested_values>
    <field key="audience">新入职 PM</field>
    <field key="style">类比驱动</field>
  </suggested_values>
  <reasoning>简要填写理由</reasoning>
</response>

Return the XML now:`.trim();

  return prompt;
}

function stripCodeFence(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```(xml)?\n?/gi, '').replace(/```$/, '').trim(),
  );
}

function parseXMLSuggestion(
  xmlRaw: string,
  template: Template,
): { suggested_values: Record<string, unknown>; reasoning: string } {
  const xml = stripCodeFence(xmlRaw).trim();
  const typeMap = new Map((template.placeholders || []).map((p) => [p.key, p.type]));

  const suggested: Record<string, unknown> = {};
  const fieldRegex = /<field\s+key="([^"]+)"\s*>([\s\S]*?)<\/field>/gi;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(xml)) !== null) {
    const key = match[1];
    let value: unknown = match[2].trim();
    const type = typeMap.get(key);
    if (type === 'number') {
      const num = Number(value);
      if (!Number.isNaN(num)) value = num;
    } else if (type === 'boolean') {
      const lower = String(value).toLowerCase();
      if (lower === 'true' || lower === 'false') {
        value = lower === 'true';
      }
    }
    suggested[key] = value;
  }

  if (Object.keys(suggested).length === 0) {
    throw new Error('未在 XML 中解析到字段');
  }

  const reasoningMatch = /<reasoning>([\s\S]*?)<\/reasoning>/i.exec(xml);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : `AI 填充 (${AI_CONFIG.model})`;

  return { suggested_values: suggested, reasoning };
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
            'You are a helpful assistant that fills in template placeholders. Always respond with valid XML only (no code fences, no extra prose), following the requested format.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: AI_CONFIG.temperature,
      presence_penalty: AI_CONFIG.presencePenalty,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    const parsed = parseXMLSuggestion(content, template);
    return {
      suggested_values: parsed.suggested_values,
      reasoning: parsed.reasoning,
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

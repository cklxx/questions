export interface Template {
    id: string;
    name: string;
    short_description: string;
    category_id: string;
    prompt_template: string;
    placeholders: Placeholder[];
    controls?: Control[];
    evaluation_rules?: EvaluationRules;
    tags?: string[];
    example_inputs?: ExampleInput[];
    updated_at?: string;
}

export interface Placeholder {
    key: string;
    label: string;
    type: 'string' | 'textarea' | 'number' | 'enum' | 'boolean';
    required: boolean;
    hint?: string;
    default?: unknown;
    ai_fill: boolean;
    enum_options?: string[];
    constraints?: {
        min?: number;
        max?: number;
    };
}

export interface Control {
    key: string;
    label: string;
    type: string;
    control_type: string;
}

export interface EvaluationRules {
    auto_checks?: string[];
    manual_checklist?: string[];
}

export interface ExampleInput {
    name: string;
    placeholder_values: Record<string, unknown>;
    notes?: string;
}

export interface Category {
    id: string;
    name: string;
    description: string;
}

export interface AIConfig {
    configured: boolean;
    baseUrl: string;
    model: string;
}

export interface RenderResponse {
    rendered_prompt: string;
    missing_required: string[];
}

export interface AIFillResponse {
    suggested_values: Record<string, unknown>;
    reasoning: string;
}

export type Language = 'zh' | 'en';

export interface LocaleDetection {
    language: Language;
    source: string;
    country?: string;
}

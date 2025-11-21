export type PlaceholderType = 'string' | 'textarea' | 'number' | 'enum' | 'boolean';

export interface Constraints {
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface Placeholder {
  key: string;
  label: string;
  type: PlaceholderType;
  required: boolean;
  hint: string;
  default?: unknown;
  ai_fill: boolean;
  enum_options?: string[];
  constraints?: Constraints;
}

export interface Control extends Placeholder {
  control_type?: 'length' | 'style' | 'audience' | 'structure' | 'safety' | 'other';
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

export interface Template {
  id: string;
  name: string;
  short_description: string;
  category_id: string;
  prompt_template: string;
  placeholders: Placeholder[];
  controls?: Control[];
  evaluation_rules: EvaluationRules;
  tags?: string[];
  example_inputs?: ExampleInput[];
  notes_for_author?: string;
  model_hint?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  templates?: Template[];
}

export interface TemplateLibrary {
  version: string;
  categories: Category[];
}

export interface TemplateStore {
  raw: TemplateLibrary;
  templatesById: Map<string, Template>;
}

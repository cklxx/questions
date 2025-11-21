import type { Template, Category, AIConfig, RenderResponse, AIFillResponse, Language, LocaleDetection } from '@/types';

const BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

const withLang = (url: string, language?: Language) => {
    if (!language) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}lang=${encodeURIComponent(language)}`;
};

export const api = {
    async getCategories(language?: Language): Promise<{ categories: Category[] }> {
        const res = await fetch(withLang(`${BASE_URL}/api/templates/categories`, language));
        return res.json();
    },

    async getTemplates(category?: string, language?: Language): Promise<{ templates: Template[] }> {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (language) params.set('lang', language);
        const query = params.toString();
        const res = await fetch(`${BASE_URL}/api/templates${query ? `?${query}` : ''}`);
        return res.json();
    },

    async getTemplate(id: string, language?: Language): Promise<Template> {
        const res = await fetch(withLang(`${BASE_URL}/api/templates/${id}`, language));
        return res.json();
    },

    async render(
        id: string,
        placeholderValues: Record<string, unknown>,
        language?: Language,
    ): Promise<RenderResponse> {
        const res = await fetch(withLang(`${BASE_URL}/api/templates/${id}/render`, language), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeholderValues }),
        });
        return res.json();
    },

    async aiFill(
        id: string,
        placeholderValues: Record<string, unknown>,
        targetKey?: string,
        language?: Language,
    ): Promise<AIFillResponse> {
        const res = await fetch(withLang(`${BASE_URL}/api/templates/${id}/ai-fill`, language), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeholderValues, target_key: targetKey }),
        });
        return res.json();
    },

    async getConfig(): Promise<AIConfig> {
        const res = await fetch(`${BASE_URL}/api/config`);
        return res.json();
    },

    async getLocale(): Promise<LocaleDetection> {
        const res = await fetch(`${BASE_URL}/api/locale`);
        return res.json();
    },
};

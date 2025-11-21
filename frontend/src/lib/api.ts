import type { Template, Category, AIConfig, RenderResponse, AIFillResponse } from '@/types';

const BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const api = {
    async getCategories(): Promise<{ categories: Category[] }> {
        const res = await fetch(`${BASE_URL}/api/templates/categories`);
        return res.json();
    },

    async getTemplates(category?: string): Promise<{ templates: Template[] }> {
        const query = category ? `?category=${encodeURIComponent(category)}` : '';
        const res = await fetch(`${BASE_URL}/api/templates${query}`);
        return res.json();
    },

    async getTemplate(id: string): Promise<Template> {
        const res = await fetch(`${BASE_URL}/api/templates/${id}`);
        return res.json();
    },

    async render(id: string, placeholderValues: Record<string, unknown>): Promise<RenderResponse> {
        const res = await fetch(`${BASE_URL}/api/templates/${id}/render`, {
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
    ): Promise<AIFillResponse> {
        const res = await fetch(`${BASE_URL}/api/templates/${id}/ai-fill`, {
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
};

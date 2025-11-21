import type { Language } from '@/types';

interface Translation {
    siteName: string;
    siteTitle: string;
    siteDescription: string;
    keywords: string;
    seoNote: string;
    headerTitle: string;
    stats: {
        categories: string;
        templates: string;
        current: string;
    };
    filtersLabel: string;
    clearLabel: string;
    searchPlaceholder: string;
    allLabel: string;
    fieldsLabel: string;
    aiNotConfigured: string;
    refreshLabel: string;
    loadingTemplates: string;
    copy: {
        empty: string;
        failed: string;
        filledPrompt: string;
        templateSkeleton: string;
        templateDefaults: string;
    };
    aiFill: {
        successFallback: string;
        failedPrefix: string;
        buttonLabel: string;
        badge: string;
        tooltip: string;
    };
    gemini: {
        missing: string;
        opened: string;
        copying: string;
        copyFailed: string;
    };
    placeholders: {
        select: string;
        waiting: string;
        missingPrefix: string;
        note: string;
    };
    sections: {
        preview: string;
        rules: string;
        checklist: string;
        tags: string;
        examples: string;
    };
    buttons: {
        reset: string;
        copy: string;
        gemini: string;
    };
    filterSections: {
        category: string;
        model: string;
        medium: string;
        tags: string;
    };
    card: {
        variable: string;
        defaults: string;
        variableTitle: string;
        defaultsTitle: string;
        examples: string;
        required: string;
        recent: string;
        updatedPrefix: string;
        datasetSynced: string;
    };
    previewActions: {
        template: string;
        filled: string;
        templateTitle: string;
        filledTitle: string;
    };
    mediumOptions: {
        text: string;
        artifact: string;
        image: string;
    };
    jsonLdLanguage: string;
    listTitle: string;
    dateLocale: string;
    languageLabel: string;
    languageToggle: {
        zh: string;
        en: string;
    };
}

export const translations: Record<Language, Translation> = {
    zh: {
        siteName: '问题模版平台',
        siteTitle: '问题模版平台 · 精选 AI Prompt 模版库',
        siteDescription: '精选跨场景的 Prompt 模版，内置评价规则与示例，一键渲染与复制，帮助团队快速交付高质量的 AI 产出。',
        keywords: 'Prompt 模版,AI 提示词,AI 生产力,模板库',
        seoNote: '本网站是专为 nano banana pro 的提示词模版',
        headerTitle: '精选模版',
        stats: {
            categories: '类',
            templates: '模版',
            current: '当前',
        },
        filtersLabel: '筛选',
        clearLabel: '清空',
        searchPlaceholder: '搜索模版名称 / 标签',
        allLabel: '全部',
        fieldsLabel: '字段',
        aiNotConfigured: 'AI 未配置',
        refreshLabel: '刷新',
        loadingTemplates: '正在加载模版...',
        copy: {
            empty: '⚠️ 没有可复制的内容',
            failed: '❌ 复制失败',
            filledPrompt: '📋 已复制（含当前/默认值）',
            templateSkeleton: '📋 已复制模板（含变量）',
            templateDefaults: '📋 已复制默认填充值',
        },
        aiFill: {
            successFallback: 'AI 填充完成',
            failedPrefix: 'AI 填充失败',
            buttonLabel: 'AI 补全',
            badge: '已补全',
            tooltip: 'AI 自动填充',
        },
        gemini: {
            missing: '⚠️ 请先填写模板生成 Prompt',
            opened: '🚀 已打开 Gemini',
            copying: '📋 已复制 Prompt，正在打开 Gemini',
            copyFailed: '⚠️ 复制失败，但已打开 Gemini',
        },
        placeholders: {
            select: '请选择...',
            waiting: '等待输入...',
            missingPrefix: '缺少必填字段：',
            note: '备注：',
        },
        sections: {
            preview: 'Prompt 预览',
            rules: '规则',
            checklist: '检查',
            tags: '标签',
            examples: '示例',
        },
        buttons: {
            reset: '重置',
            copy: '复制',
            gemini: 'Gemini',
        },
        filterSections: {
            category: '垂类',
            model: '模型',
            medium: '媒介',
            tags: '任务 / 标签',
        },
        card: {
            variable: '变量',
            defaults: '默认',
            variableTitle: '复制模板（含变量）',
            defaultsTitle: '复制模板（已填默认值）',
            examples: '示例',
            required: '必填',
            recent: '近期更新',
            updatedPrefix: '更新',
            datasetSynced: '数据集同步',
        },
        previewActions: {
            template: '模板',
            filled: '已填',
            templateTitle: '复制模板（含变量）',
            filledTitle: '复制填充值 Prompt',
        },
        mediumOptions: {
            text: '文本',
            artifact: '产物 / 代码',
            image: '图像',
        },
        jsonLdLanguage: 'zh-CN',
        listTitle: 'Prompt 模版列表',
        dateLocale: 'zh-CN',
        languageLabel: '语言',
        languageToggle: {
            zh: '中文',
            en: '英文',
        },
    },
    en: {
        siteName: 'Prompt Template Hub',
        siteTitle: 'Prompt Template Hub · Curated AI Prompt Library',
        siteDescription: 'Curated prompt templates with built-in scoring rules and examples—render, copy, and ship high-quality AI outputs fast.',
        keywords: 'Prompt templates, AI prompts, productivity, template library',
        seoNote: 'Prompt templates tailored for nano banana pro (本网站是专为 nano banana pro 的提示词模版)',
        headerTitle: 'Curated Templates',
        stats: {
            categories: 'categories',
            templates: 'templates',
            current: 'current',
        },
        filtersLabel: 'Filters',
        clearLabel: 'Clear',
        searchPlaceholder: 'Search template name / tags',
        allLabel: 'All',
        fieldsLabel: 'fields',
        aiNotConfigured: 'AI not configured',
        refreshLabel: 'Refresh',
        loadingTemplates: 'Loading templates...',
        copy: {
            empty: '⚠️ Nothing to copy yet',
            failed: '❌ Copy failed',
            filledPrompt: '📋 Copied with current/default values',
            templateSkeleton: '📋 Copied template (with placeholders)',
            templateDefaults: '📋 Copied defaults',
        },
        aiFill: {
            successFallback: 'AI fill complete',
            failedPrefix: 'AI fill failed',
            buttonLabel: 'AI Fill',
            badge: 'Filled',
            tooltip: 'AI autofill',
        },
        gemini: {
            missing: '⚠️ Please generate a prompt first',
            opened: '🚀 Gemini opened',
            copying: '📋 Copied prompt and opening Gemini',
            copyFailed: '⚠️ Copy failed, opening Gemini anyway',
        },
        placeholders: {
            select: 'Please select...',
            waiting: 'Waiting for input...',
            missingPrefix: 'Missing required fields: ',
            note: 'Notes:',
        },
        sections: {
            preview: 'Prompt Preview',
            rules: 'Rules',
            checklist: 'Checklist',
            tags: 'Tags',
            examples: 'Examples',
        },
        buttons: {
            reset: 'Reset',
            copy: 'Copy',
            gemini: 'Gemini',
        },
        filterSections: {
            category: 'Categories',
            model: 'Models',
            medium: 'Medium',
            tags: 'Tasks / Tags',
        },
        card: {
            variable: 'Skeleton',
            defaults: 'Defaults',
            variableTitle: 'Copy template (with placeholders)',
            defaultsTitle: 'Copy template (with defaults)',
            examples: 'Examples',
            required: 'Required',
            recent: 'Recently updated',
            updatedPrefix: 'Updated',
            datasetSynced: 'Synced from dataset',
        },
        previewActions: {
            template: 'Template',
            filled: 'Filled',
            templateTitle: 'Copy template (with placeholders)',
            filledTitle: 'Copy prompt with current values',
        },
        mediumOptions: {
            text: 'Text',
            artifact: 'Artifact / Code',
            image: 'Image',
        },
        jsonLdLanguage: 'en-US',
        listTitle: 'Prompt template list',
        dateLocale: 'en-US',
        languageLabel: 'Language',
        languageToggle: {
            zh: 'Chinese',
            en: 'English',
        },
    },
};

export const getTranslations = (language: Language) => translations[language] ?? translations.zh;

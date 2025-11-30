import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Layout,
    Search,
    Sparkles,
    Copy,
    Check,
    ChevronRight,
    Image as ImageIcon,
    Settings2,
    FileText,
    Terminal,
    RefreshCw,
    Tag,
    Layers,
    Clock3,
    Filter,
} from 'lucide-react';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import type { Template, Category, AIConfig, Language } from '@/types';
import { getTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const parseTemplateIdFromLocation = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const pathMatch = url.pathname.match(/\/templates\/([^/]+)/);
    return (pathMatch && pathMatch[1]) || url.searchParams.get('template') || '';
};

const ensureMeta = (opts: { name?: string; property?: string; content: string }) => {
    if (typeof document === 'undefined') return;
    const selector = opts.name ? `meta[name="${opts.name}"]` : `meta[property="${opts.property}"]`;
    let node = document.querySelector<HTMLMetaElement>(selector);
    if (!node) {
        node = document.createElement('meta');
        if (opts.name) node.setAttribute('name', opts.name);
        if (opts.property) node.setAttribute('property', opts.property);
        document.head.appendChild(node);
    }
    node.setAttribute('content', opts.content);
};

const ensureCanonical = (href: string) => {
    if (typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
    }
    link.href = href;
};

const setJsonLd = (id: string, data: unknown | null) => {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (!data) {
        if (existing) existing.remove();
        return;
    }
    const script = existing || document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    if (!existing) document.head.appendChild(script);
};

const deriveTemplateMeta = (tpl: Template) => {
    const medium =
        tpl.category_id === 'text2image'
            ? 'image'
            : tpl.category_id === 'text2artifact'
              ? 'artifact'
              : 'text';
    const model = medium === 'image' ? 'midjourney-sd' : 'gpt-claude';

    return { medium, model };
};

const renderTemplateLocally = (tpl: Template, placeholderValues?: Record<string, unknown>) => {
    let rendered = tpl.prompt_template || '';
    (tpl.placeholders || []).forEach((p) => {
        const incomingVal = placeholderValues?.[p.key];
        const val = incomingVal !== undefined ? incomingVal : p.default;
        const filled = val !== undefined && val !== null && val !== '';
        const pattern = new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'g');
        rendered = rendered.replace(pattern, filled ? String(val) : `{{${p.key}}}`);
    });
    return rendered;
};

function App() {
    const [language, setLanguage] = useState<Language>('zh');
    const userSelectedLanguage = useRef(false);
    const t = useMemo(() => getTranslations(language), [language]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [allTemplateCount, setAllTemplateCount] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [search, setSearch] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(() => parseTemplateIdFromLocation());
    const [templateDetail, setTemplateDetail] = useState<Template | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [rendered, setRendered] = useState('');
    const [missing, setMissing] = useState<string[]>([]);
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
    const [aiFilledKeys, setAiFilledKeys] = useState<string[]>([]);
    const [isAIFilling, setIsAIFilling] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [selectedMediums, setSelectedMediums] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [activeRecommendation, setActiveRecommendation] = useState<string | null>(null);
    const siteUrl = useMemo(
        () => (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, ''),
        [],
    );
    const applyLanguage = (lang: Language, markUserChoice = false) => {
        if (markUserChoice) {
            userSelectedLanguage.current = true;
        }
        setLanguage(lang);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('language', lang);
        }
    };

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('language') : null;
        if (stored === 'zh' || stored === 'en') {
            applyLanguage(stored as Language);
            return;
        }

        api.getLocale()
            .then((res) => {
                if (userSelectedLanguage.current) return;
                const lang: Language = res?.language === 'en' ? 'en' : 'zh';
                applyLanguage(lang);
            })
            .catch(() => {
                if (userSelectedLanguage.current) return;
                const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
                const lang: Language = nav.includes('zh') ? 'zh' : 'en';
                applyLanguage(lang);
            });
    }, []);
    const toggleSelection = (value: string, setter: (updater: (prev: string[]) => string[]) => void) =>
        setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    const modelOptions = [
        { value: 'gpt-claude', label: 'GPT / Claude' },
        { value: 'midjourney-sd', label: 'Midjourney / SD' },
    ];
    const mediumOptions = useMemo(
        () => [
            { value: 'text', label: t.mediumOptions.text },
            { value: 'artifact', label: t.mediumOptions.artifact },
            { value: 'image', label: t.mediumOptions.image },
        ],
        [t.mediumOptions.artifact, t.mediumOptions.image, t.mediumOptions.text],
    );
    const tagOptions = useMemo(() => {
        const counts = new Map<string, number>();
        templates.forEach((tpl) => {
            (tpl.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 12)
            .map(([tag]) => tag);
    }, [templates]);
    const recommendedCombos = useMemo(
        () => [
            {
                id: 'text-llm',
                label: t.recommendations.textLLM,
                models: ['gpt-claude'],
                mediums: ['text'],
                category: 'text2text',
                tags: [],
            },
            {
                id: 'image-mj',
                label: t.recommendations.imageMJ,
                models: ['midjourney-sd'],
                mediums: ['image'],
                category: 'text2image',
                tags: ['风格迁移', '海报'].filter((tag) => tagOptions.includes(tag)),
            },
            {
                id: 'artifact-code',
                label: t.recommendations.artifact,
                models: ['gpt-claude'],
                mediums: ['artifact'],
                category: 'text2artifact',
                tags: [],
            },
        ],
        [tagOptions, t.recommendations.artifact, t.recommendations.imageMJ, t.recommendations.textLLM],
    );
    const arrayEqual = useCallback((a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item)), []);
    const applyRecommendation = (id: string) => {
        const combo = recommendedCombos.find((item) => item.id === id);
        if (!combo) return;
        if (activeRecommendation === id) {
            setActiveRecommendation(null);
            return;
        }
        setSelectedModels(combo.models);
        setSelectedMediums(combo.mediums);
        setSelectedTags(combo.tags || []);
        setSelectedCategory(combo.category || '');
        setActiveRecommendation(id);
        trackEvent('filter:recommendation', {
            id,
            models: combo.models,
            mediums: combo.mediums,
            tags: combo.tags,
            category: combo.category,
        });
    };
    const clearFilters = () => {
        setSelectedModels([]);
        setSelectedMediums([]);
        setSelectedTags([]);
        setSelectedCategory('');
        setActiveRecommendation(null);
        setSearch('');
        trackEvent('filter:clear');
    };

    useEffect(() => {
        // Reset local state so lists/detail reload cleanly when switching language
        setCategories([]);
        setTemplates([]);
        setSelectedCategory('');
        setSelectedTemplateId('');
        setTemplateDetail(null);
        setValues({});
        setRendered('');
        setMissing([]);
        setAiFilledKeys([]);
    }, [language]);

    useEffect(() => {
        api.getConfig().then(setAiConfig);
    }, []);

    useEffect(() => {
        api.getCategories(language).then((data) => setCategories(data.categories || []));
    }, [language]);

    useEffect(() => {
        api.getTemplates(selectedCategory, language).then((data) => {
            setTemplates(data.templates || []);
            if (!selectedCategory) {
                setAllTemplateCount((data.templates || []).length);
            }
        });
    }, [language, selectedCategory]);

    useEffect(() => {
        setSelectedTags((prev) => prev.filter((tag) => tagOptions.includes(tag)));
    }, [tagOptions]);

    useEffect(() => {
        if (!activeRecommendation) return;
        const combo = recommendedCombos.find((item) => item.id === activeRecommendation);
        if (!combo) {
            setActiveRecommendation(null);
            return;
        }
        const comboCategory = combo.category || '';
        if (
            comboCategory !== selectedCategory ||
            !arrayEqual(combo.models, selectedModels) ||
            !arrayEqual(combo.mediums, selectedMediums) ||
            !arrayEqual(combo.tags || [], selectedTags)
        ) {
            setActiveRecommendation(null);
        }
    }, [
        activeRecommendation,
        arrayEqual,
        recommendedCombos,
        selectedCategory,
        selectedMediums,
        selectedModels,
        selectedTags,
    ]);

    useEffect(() => {
        if (!templates.length) return;
        const exists = selectedTemplateId && templates.some((tpl) => tpl.id === selectedTemplateId);
        if (!selectedTemplateId || !exists) {
            setSelectedTemplateId(templates[0].id);
        }
    }, [templates, selectedTemplateId]);

    useEffect(() => {
        if (!selectedTemplateId) return;
        if (templates.length > 0 && !templates.some((tpl) => tpl.id === selectedTemplateId)) return;

        api.getTemplate(selectedTemplateId, language).then((tpl) => {
            setTemplateDetail(tpl);
            const initial: Record<string, unknown> = {};
            (tpl.placeholders || []).forEach((p) => {
                initial[p.key] = p.default ?? '';
            });
            setValues(initial);
            setAiFilledKeys([]);
        });
    }, [language, selectedTemplateId, templates]);

    useEffect(() => {
        if (!selectedTemplateId) return;
        const basePath = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '');
        const templatePath = `${basePath}/templates/${selectedTemplateId}`;
        const nextUrl = `${window.location.origin}${templatePath}`;
        if (window.location.href !== nextUrl) {
            window.history.replaceState({}, '', nextUrl);
        }
    }, [selectedTemplateId]);

    useEffect(() => {
        if (templateDetail?.name) {
            document.title = `${templateDetail.name} - ${t.siteName}`;
        } else {
            document.title = t.siteTitle;
        }
    }, [t.siteName, t.siteTitle, templateDetail]);

    useEffect(() => {
        if (!templateDetail) return;
        api.render(templateDetail.id, values, language).then((res) => {
            setRendered(res.rendered_prompt || '');
            setMissing(res.missing_required || []);
        });
    }, [language, templateDetail, values]);

    useEffect(() => {
        const canonicalPath = templateDetail ? `/templates/${templateDetail.id}` : '/';
        const canonicalUrl = `${siteUrl}${canonicalPath}`;
        const baseDesc = templateDetail?.short_description || t.siteDescription;
        const desc = `${baseDesc} · ${t.seoNote}`;
        const keywords = templateDetail?.tags?.length
            ? `${templateDetail.tags.join(', ')}, ${t.seoNote}`
            : `${t.keywords}, ${t.seoNote}`;
        const metaTitle = templateDetail ? `${templateDetail.name} · ${t.siteName}` : t.siteTitle;

        ensureCanonical(canonicalUrl);
        ensureMeta({ name: 'description', content: desc });
        ensureMeta({ name: 'keywords', content: keywords });
        ensureMeta({ property: 'og:title', content: metaTitle });
        ensureMeta({ property: 'og:description', content: desc });
        ensureMeta({ property: 'og:url', content: canonicalUrl });
        ensureMeta({ name: 'twitter:title', content: metaTitle });
        ensureMeta({ name: 'twitter:description', content: desc });
        ensureMeta({ name: 'twitter:url', content: canonicalUrl });

        const templateLd = templateDetail
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'CreativeWork',
                  name: templateDetail.name,
                  description: desc,
                  inLanguage: t.jsonLdLanguage,
                  url: canonicalUrl,
                  genre: templateDetail.tags || [],
                  identifier: templateDetail.id,
                  isPartOf: {
                      '@type': 'WebApplication',
                      name: t.siteName,
                      url: `${siteUrl}/`,
                  },
              }
            : null;
        setJsonLd('ld-template', templateLd);
    }, [
        siteUrl,
        t.jsonLdLanguage,
        t.keywords,
        t.seoNote,
        t.siteDescription,
        t.siteName,
        t.siteTitle,
        templateDetail,
    ]);

    useEffect(() => {
        if (!templates.length) {
            setJsonLd('ld-itemlist', null);
            return;
        }
        const items = templates.slice(0, 50).map((tpl, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${siteUrl}/templates/${tpl.id}`,
            name: tpl.name,
            description: tpl.short_description,
            keywords: (tpl.tags || []).join(', '),
        }));
        setJsonLd('ld-itemlist', {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t.listTitle,
            numberOfItems: templates.length,
            itemListOrder: 'Descending',
            itemListElement: items,
        });
    }, [siteUrl, t.listTitle, templates]);

    const filteredTemplates = useMemo(() => {
        const term = search.trim().toLowerCase();
        return templates.filter((tpl) => {
            const meta = deriveTemplateMeta(tpl);
            if (selectedModels.length && !selectedModels.includes(meta.model)) return false;
            if (selectedMediums.length && !selectedMediums.includes(meta.medium)) return false;
            if (selectedTags.length && !selectedTags.every((t) => (tpl.tags || []).includes(t))) return false;
            if (!term) return true;
            return (
                tpl.name.toLowerCase().includes(term) ||
                (tpl.short_description || '').toLowerCase().includes(term) ||
                (tpl.tags || []).some((t) => t.toLowerCase().includes(term))
            );
        });
    }, [templates, search, selectedModels, selectedMediums, selectedTags]);

    const manualFillPrompt = useMemo(() => {
        if (!templateDetail) return '';
        const header =
            language === 'zh'
                ? `任务：为“${templateDetail.name}”模版补全内容并做适度优化。`
                : `Task: complete and lightly polish the "${templateDetail.name}" prompt template.`;
        const goal =
            language === 'zh'
                ? '目标：直接返回可用的完整提示词。'
                : 'Goal: return a ready-to-use prompt.';
        const desc = templateDetail.short_description
            ? language === 'zh'
                ? `模版描述：${templateDetail.short_description}`
                : `Template description: ${templateDetail.short_description}`
            : '';
        const fieldTitle = language === 'zh' ? '需要填的字段：' : 'Fields to fill:';
        const fieldLines = (templateDetail.placeholders || []).map((p) => {
            const required = p.required ? (language === 'zh' ? '（必填）' : ' (required)') : '';
            const hint = p.hint
                ? `${language === 'zh' ? '提示' : 'Hint'}：${p.hint}`
                : '';
            const existing = values[p.key];
            const hasExisting = existing !== undefined && existing !== null && existing !== '';
            const existingText = hasExisting
                ? `${language === 'zh' ? '已知' : 'Given'}：${existing}`
                : '';
            const parts = [`${p.label}${required}`];
            if (hint) parts.push(hint);
            if (existingText) parts.push(existingText);
            return `- ${parts.join(' · ')}`;
        });
        const closing =
            language === 'zh'
                ? '请按以上信息直接输出最终提示词。'
                : 'Use the details above and respond with the final prompt only.';
        return [header, goal, desc, fieldTitle, ...fieldLines, closing].filter(Boolean).join('\n');
    }, [language, templateDetail, values]);

    const handleAIFill = async (targetKey?: string) => {
        if (!templateDetail) return;
        setIsAIFilling(true);
        try {
            const res = await api.aiFill(templateDetail.id, values, targetKey, language);
            const incoming = res.suggested_values || {};
            const merged = { ...values };
            const filledKeys: string[] = [];
            Object.entries(incoming).forEach(([k, v]) => {
                if (targetKey) {
                    merged[k] = v;
                    filledKeys.push(k);
                } else if (merged[k] === undefined || merged[k] === null || merged[k] === '') {
                    merged[k] = v;
                    filledKeys.push(k);
                }
            });
            setValues(merged);
            setAiFilledKeys((prev) => [...new Set([...prev, ...filledKeys])]);
            setMessage(`✨ ${res.reasoning || t.aiFill.successFallback}`);
        } catch (error: any) {
            setMessage(`❌ ${t.aiFill.failedPrefix}: ${error.message} `);
        } finally {
            setIsAIFilling(false);
            setTimeout(() => setMessage(''), 3500);
        }
    };

    const copyText = async (text: string, successMessage: string) => {
        if (!text) {
            setMessage(t.copy.empty);
            setTimeout(() => setMessage(''), 2200);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setMessage(successMessage);
        } catch {
            setMessage(t.copy.failed);
        }
        setTimeout(() => setMessage(''), 2500);
    };

    const copyManualFillPrompt = () => {
        copyText(manualFillPrompt, t.aiFill.manualCopySuccess);
    };

    const copyFilledPrompt = async () => {
        if (!templateDetail) return;
        trackEvent('copy:filled', { templateId: templateDetail.id });
        const text = renderTemplateLocally(templateDetail, values);
        copyText(text, t.copy.filledPrompt);
    };

    const copyTemplate = async (tpl: Template, mode: 'skeleton' | 'prefilled', origin: 'list' | 'preview') => {
        const text = mode === 'skeleton' ? tpl.prompt_template || '' : renderTemplateLocally(tpl);
        const label = mode === 'skeleton' ? t.copy.templateSkeleton : t.copy.templateDefaults;
        trackEvent('copy:template', { mode, origin, templateId: tpl.id });
        copyText(text, label);
    };

    const isRecent = (updated?: string) => {
        if (!updated) return false;
        const updatedTime = new Date(updated).getTime();
        if (Number.isNaN(updatedTime)) return false;
        const diffDays = (Date.now() - updatedTime) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
    };

    const formatUpdated = (updated?: string) => {
        if (!updated) return '';
        const date = new Date(updated);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(t.dateLocale, { month: 'numeric', day: 'numeric' }).format(date);
    };

    const goToGemini = () => {
        if (!rendered) {
            setMessage(t.gemini.missing);
            setTimeout(() => setMessage(''), 2500);
            return;
        }
        const geminiLang = language === 'zh' ? 'zh-CN' : 'en';
        const geminiUrl = `https://gemini.google.com/app?hl=${geminiLang}&prompt=${encodeURIComponent(rendered)}`;
        try {
            navigator.clipboard
                .writeText(rendered)
                .then(() => setMessage(t.gemini.copying))
                .catch(() => setMessage(t.gemini.copyFailed))
                .finally(() => setTimeout(() => setMessage(''), 2500));
        } catch {
            setMessage(t.gemini.copyFailed);
            setTimeout(() => setMessage(''), 2500);
        }
        window.open(geminiUrl, '_blank');
    };

    if (!templateDetail) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2 bg-[#f6f7fb]">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                {t.loadingTemplates}
            </div>
        );
    }

    const visibleTemplates = filteredTemplates.length;
    const hasExamples = (templateDetail.example_inputs || []).length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f7f8fc] via-[#f2f4f8] to-[#f6f8fb] text-slate-900 font-sans selection:bg-primary/15">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-2xl bg-white shadow-[0_10px_30px_-22px_rgba(0,0,0,0.55)] border border-slate-100">
                            <Terminal className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold tracking-tight">{t.headerTitle}</div>
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 shadow-sm">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="font-medium text-slate-800">
                                {categories.length} {t.stats.categories}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-600">
                                {allTemplateCount || templates.length} {t.stats.templates}
                            </span>
                            <span className="text-slate-400">· {visibleTemplates} {t.stats.current}</span>
                        </div>
                        {aiConfig && (
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-sm ${
                                    aiConfig.configured
                                        ? 'bg-green-50 border-green-100 text-green-700'
                                        : 'bg-amber-50 border-amber-100 text-amber-700'
                                }`}
                            >
                                <div
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        aiConfig.configured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
                                    }`}
                                />
                                {aiConfig.configured ? aiConfig.model : t.aiNotConfigured}
                            </div>
                        )}
                        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 shadow-sm">
                            {(['zh', 'en'] as Language[]).map((lng) => (
                                <button
                                    key={lng}
                                    onClick={() => applyLanguage(lng, true)}
                                    className={`px-2 py-1 rounded-lg font-medium transition ${
                                        language === lng
                                            ? 'bg-primary/10 text-primary border border-primary/30'
                                            : 'text-slate-600 hover:text-primary border border-transparent'
                                    }`}
                                    aria-label={t.languageToggle[lng]}
                                    title={t.languageToggle[lng]}
                                >
                                    {t.languageToggle[lng]}
                                </button>
                            ))}
                        </div>
                        {message && (
                            <div
                                className="animate-in fade-in slide-in-from-top-2 px-4 py-1.5 bg-white shadow-lg border border-slate-200 rounded-2xl text-sm text-slate-700 flex items-center gap-2 w-full md:w-auto max-w-full md:max-w-[520px] break-words text-left"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                <span className="flex-1 leading-snug">{message}</span>
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => window.location.reload()}
                            size="sm"
                            className="rounded-full"
                            aria-label={t.refreshLabel}
                            title={t.refreshLabel}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-8 pt-6">
                <div className="grid gap-6 lg:grid-cols-[320px_1.1fr_0.95fr]">
                    {/* Sidebar */}
                    <aside className="flex flex-col gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-[0_20px_60px_-48px_rgba(0,0,0,0.55)]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t.searchPlaceholder}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary/60 focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-2 font-medium text-slate-700">
                                    <Filter className="w-4 h-4 text-primary" />
                                    {t.filtersLabel}
                                </div>
                                <button
                                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                                    onClick={clearFilters}
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    {t.clearLabel}
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{t.recommendations.title}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {recommendedCombos.map((combo) => (
                                            <button
                                                key={combo.id}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                                                    activeRecommendation === combo.id
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                                }`}
                                                onClick={() => applyRecommendation(combo.id)}
                                            >
                                                {combo.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{t.filterSections.category}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <button
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                selectedCategory === ''
                                                    ? 'bg-primary/10 border-primary/40 text-primary'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                            }`}
                                            onClick={() => setSelectedCategory('')}
                                        >
                                            {t.allLabel}
                                        </button>
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    selectedCategory === cat.id
                                                        ? 'bg-primary/10 border-primary/40 text-primary'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                                }`}
                                                onClick={() => setSelectedCategory(cat.id)}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{t.filterSections.model}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {modelOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    selectedModels.includes(opt.value)
                                                        ? 'bg-primary/10 border-primary/40 text-primary'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                                }`}
                                                onClick={() => toggleSelection(opt.value, setSelectedModels)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{t.filterSections.medium}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {mediumOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                    selectedMediums.includes(opt.value)
                                                        ? 'bg-primary/10 border-primary/40 text-primary'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                                }`}
                                                onClick={() => toggleSelection(opt.value, setSelectedMediums)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {tagOptions.length > 0 && (
                                    <div>
                                        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t.filterSections.tags}</div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {tagOptions.map((tag) => (
                                                <button
                                                    key={tag}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                                                        selectedTags.includes(tag)
                                                            ? 'bg-primary/10 border-primary/40 text-primary'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                                    }`}
                                                    onClick={() => toggleSelection(tag, setSelectedTags)}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 space-y-3 shadow-[0_20px_60px_-48px_rgba(0,0,0,0.4)] lg:h-[calc(100vh-220px)] lg:overflow-y-auto lg:scrollbar-thin lg:scrollbar-thumb-slate-200 lg:scrollbar-track-transparent">
                            {filteredTemplates.map((tpl) => {
                                const requiredCount = (tpl.placeholders || []).filter((p) => p.required).length;
                                const exampleCount = (tpl.example_inputs || []).length;
                                const meta = deriveTemplateMeta(tpl);
                                const modelLabel = meta.model === 'midjourney-sd' ? 'Midjourney / SD' : 'GPT / Claude';
                                const mediumLabel =
                                    meta.medium === 'image'
                                        ? t.mediumOptions.image
                                        : meta.medium === 'artifact'
                                          ? t.mediumOptions.artifact
                                          : t.mediumOptions.text;
                                const recent = isRecent(tpl.updated_at);
                                const updatedLabel = formatUpdated(tpl.updated_at);
                                const updatedText = updatedLabel ? `${t.card.updatedPrefix} ${updatedLabel}` : t.card.datasetSynced;

                                return (
                                    <div
                                        key={tpl.id}
                                        onClick={() => setSelectedTemplateId(tpl.id)}
                                        className={`group p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
                                            selectedTemplateId === tpl.id
                                                ? 'bg-primary/5 border-primary/30 shadow-[0_18px_60px_-40px_rgba(107,127,184,0.7)]'
                                                : 'bg-white border-slate-200 hover:border-primary/25 hover:shadow-[0_18px_60px_-50px_rgba(0,0,0,0.45)]'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wide text-slate-400 flex items-center gap-2">
                                                    <Layers className="w-3 h-3" />
                                                    {tpl.category_id}
                                                </p>
                                                <h3 className="font-semibold text-sm text-slate-900 mt-1">{tpl.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                    <Clock3 className="w-3.5 h-3.5" />
                                                    <span>
                                                        {(tpl.placeholders || []).length} {t.fieldsLabel}
                                                    </span>
                                                </div>
                                                <button
                                                    className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] text-slate-600 bg-white hover:border-primary/40 hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyTemplate(tpl, 'prefilled', 'list');
                                                    }}
                                                    title={t.card.defaultsTitle}
                                                >
                                                    {t.card.defaults}
                                                </button>
                                                {selectedTemplateId === tpl.id && <ChevronRight className="w-4 h-4 text-primary" />}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{tpl.short_description}</p>
                                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 mt-2">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                                                <Sparkles className="w-3 h-3 text-primary" />
                                                {modelLabel}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                                                <Layout className="w-3 h-3 text-primary" />
                                                {mediumLabel}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                                                <FileText className="w-3 h-3 text-primary" />
                                                {t.card.examples} {exampleCount}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                                                <Check className="w-3 h-3 text-primary" />
                                                {t.card.required} {requiredCount}
                                            </span>
                                            {tpl.updated_at && (
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${
                                                        recent
                                                            ? 'bg-green-50 border-green-200 text-green-700'
                                                            : 'bg-slate-100 border-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    <Clock3 className="w-3 h-3 text-primary" />
                                                    {recent ? t.card.recent : updatedText}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(tpl.tags || []).slice(0, 3).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-[10px] px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    {/* Template Form */}
                    <section className="flex flex-col gap-4">
                        <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-55px_rgba(0,0,0,0.35)]">
                            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-xs text-primary">
                                            {templateDetail.category_id}
                                        </span>
                                        <span className="px-2 py-1 rounded-md bg-slate-100 text-[11px] text-slate-500 border border-slate-200">
                                            {templateDetail.id}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-semibold text-slate-900 mt-2 leading-tight">{templateDetail.name}</h2>
                                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{templateDetail.short_description}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                        <Clock3 className="w-3.5 h-3.5 text-primary" />
                                        <span>
                                            {t.card.updatedPrefix} {formatUpdated(templateDetail.updated_at) || t.card.datasetSynced}
                                        </span>
                                        {isRecent(templateDetail.updated_at) && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700 border border-green-200">
                                                {t.card.recent}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {aiConfig && !aiConfig.configured && (
                                        <Button
                                            variant="secondary"
                                            onClick={copyManualFillPrompt}
                                            size="sm"
                                            className="h-9 rounded-full gap-2 border-dashed border-slate-300"
                                            aria-label={t.aiFill.manualCopyLabel}
                                            title={t.aiFill.manualCopyLabel}
                                        >
                                            <Copy className="w-4 h-4" />
                                            <span className="hidden sm:inline">{t.aiFill.manualCopyLabel}</span>
                                            <span className="sm:hidden">我是…</span>
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => handleAIFill()}
                                        disabled={isAIFilling || !aiConfig?.configured}
                                        isLoading={isAIFilling}
                                        size="sm"
                                        className="h-9 w-9 rounded-full !px-0"
                                        aria-label={t.aiFill.buttonLabel}
                                        title={t.aiFill.buttonLabel}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            setValues(
                                                (templateDetail.placeholders || []).reduce((acc, p) => {
                                                    acc[p.key] = p.default ?? '';
                                                    return acc;
                                                }, {} as Record<string, unknown>),
                                            )
                                        }
                                        className="h-9 w-9 rounded-full !px-0"
                                        aria-label={t.buttons.reset}
                                        title={t.buttons.reset}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="px-5 py-4 flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50/60">
                                {(templateDetail.tags || []).slice(0, 6).map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-white border border-slate-200 text-slate-600"
                                    >
                                        <Tag className="w-3 h-3 text-primary" />
                                        {tag}
                                    </span>
                                ))}
                                {(templateDetail.controls || []).map((ctrl) => (
                                    <span
                                        key={ctrl.key}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary/10 border border-primary/30 text-primary"
                                    >
                                        <Settings2 className="w-3 h-3" />
                                        {ctrl.label}
                                    </span>
                                ))}
                            </div>

                            <div className="px-5 py-5 space-y-4 lg:max-h-[70vh] lg:overflow-y-auto lg:scrollbar-thin lg:scrollbar-thumb-slate-200 lg:scrollbar-track-transparent">
                                {(templateDetail.placeholders || []).map((p) => {
                                    if (p.type === 'textarea') {
                                        return (
                                            <Input
                                                key={p.key}
                                                label={p.label + (p.required ? ' *' : '')}
                                                hint={p.hint}
                                                multiline
                                                value={(values[p.key] as string) ?? ''}
                                                onChange={(e) => setValues({ ...values, [p.key]: e.currentTarget.value })}
                                                onAIFill={p.ai_fill ? () => handleAIFill(p.key) : undefined}
                                                showAIButton={p.ai_fill}
                                                isAIFilled={aiFilledKeys.includes(p.key)}
                                                isAIFilling={isAIFilling}
                                                rows={4}
                                                filledLabel={t.aiFill.badge}
                                                aiFillTooltip={t.aiFill.tooltip}
                                                className="bg-white border-slate-200"
                                            />
                                        );
                                    }
                                    if (p.type === 'enum') {
                                        return (
                                            <div key={p.key} className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{p.label}</span>
                                                    {p.required && <span className="text-red-400">*</span>}
                                                    {p.hint && <span className="text-slate-500">· {p.hint}</span>}
                                                </div>
                                                <div className="relative">
                                                    <select
                                                        className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-primary/60 focus:ring-1 focus:ring-primary/30 outline-none appearance-none transition-all shadow-[0_10px_30px_-24px_rgba(0,0,0,0.45)]"
                                                        value={(values[p.key] as string) ?? ''}
                                                        onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                                                    >
                                                        <option value="">{t.placeholders.select}</option>
                                                        {(p.enum_options || []).map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <Input
                                            key={p.key}
                                            label={p.label + (p.required ? ' *' : '')}
                                            hint={p.hint}
                                            type={p.type === 'number' ? 'number' : 'text'}
                                            value={(values[p.key] as string | number) ?? ''}
                                            onChange={(e) =>
                                                setValues({
                                                    ...values,
                                                    [p.key]: p.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value,
                                                })
                                            }
                                            onAIFill={p.ai_fill ? () => handleAIFill(p.key) : undefined}
                                            showAIButton={p.ai_fill}
                                            isAIFilled={aiFilledKeys.includes(p.key)}
                                            isAIFilling={isAIFilling}
                                            filledLabel={t.aiFill.badge}
                                            aiFillTooltip={t.aiFill.tooltip}
                                            className="bg-white border-slate-200"
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {missing.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                {t.placeholders.missingPrefix}
                                {missing.join(', ')}
                            </div>
                        )}
                    </section>

                    {/* Preview & Rules */}
                    <section className="flex flex-col gap-4">
                        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-[0_24px_70px_-55px_rgba(0,0,0,0.3)]">
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <h3 className="font-semibold text-sm text-slate-800">{t.sections.preview}</h3>
                                </div>
                                <div className="flex gap-2">
                                    {templateDetail.category_id === 'text2image' && (
                                        <Button
                                            onClick={goToGemini}
                                            size="sm"
                                            className="h-9 w-9 rounded-full !px-0"
                                            aria-label={t.buttons.gemini}
                                            title={t.buttons.gemini}
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() => copyTemplate(templateDetail, 'skeleton', 'preview')}
                                        size="sm"
                                        className="h-9 rounded-full px-3 gap-1"
                                        aria-label={t.previewActions.templateTitle}
                                        title={t.previewActions.templateTitle}
                                    >
                                        <Copy className="w-4 h-4" />
                                        {t.previewActions.template}
                                    </Button>
                                    <Button
                                        onClick={copyFilledPrompt}
                                        size="sm"
                                        className="h-9 rounded-full px-3 gap-1"
                                        aria-label={t.previewActions.filledTitle}
                                        title={t.previewActions.filledTitle}
                                    >
                                        <Copy className="w-4 h-4" />
                                        {t.previewActions.filled}
                                    </Button>
                                </div>
                            </div>
                            <div className="p-5 bg-slate-50 lg:max-h-[55vh] lg:overflow-auto lg:scrollbar-thin lg:scrollbar-thumb-slate-200 lg:scrollbar-track-transparent">
                                <pre className="text-sm whitespace-pre-wrap font-mono text-slate-800 leading-relaxed">
                                    {rendered || <span className="text-slate-400 italic">{t.placeholders.waiting}</span>}
                                </pre>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-[0_24px_70px_-55px_rgba(0,0,0,0.3)]">
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                                <Layout className="w-4 h-4 text-primary" />
                                <h3 className="font-semibold text-sm text-slate-800">{t.sections.rules}</h3>
                            </div>
                            <div className="p-5 space-y-5 lg:max-h-[40vh] lg:overflow-y-auto lg:scrollbar-thin lg:scrollbar-thumb-slate-200 lg:scrollbar-track-transparent">
                                {(templateDetail.evaluation_rules?.manual_checklist || []).length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                            {t.sections.checklist}
                                        </div>
                                        <ul className="space-y-2">
                                            {(templateDetail.evaluation_rules?.manual_checklist || []).map((item, idx) => (
                                                <li key={idx} className="flex gap-3 text-sm text-slate-700 group">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                    <span className="leading-relaxed">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {(templateDetail.tags || []).length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                            {t.sections.tags}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(templateDetail.tags || []).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {hasExamples && (
                                    <div>
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                            {t.sections.examples}
                                        </div>
                                        <div className="space-y-3">
                                            {(templateDetail.example_inputs || []).slice(0, 2).map((ex) => (
                                                <div
                                                    key={ex.name}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                                                >
                                                    <div className="font-semibold text-slate-900">{ex.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {Object.entries(ex.placeholder_values || {})
                                                            .slice(0, 4)
                                                            .map(([k, v]) => `${k}: ${String(v)}`)
                                                            .join(' · ')}
                                                    </div>
                                                    {ex.notes && <div className="text-xs text-slate-500 mt-1">{t.placeholders.note}{ex.notes}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default App;

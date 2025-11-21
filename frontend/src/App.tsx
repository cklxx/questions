import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Template, Category, AIConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const parseTemplateIdFromLocation = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const pathMatch = url.pathname.match(/\/templates\/([^/]+)/);
    return (pathMatch && pathMatch[1]) || url.searchParams.get('template') || '';
};

const DEFAULT_DESCRIPTION =
    '精选跨场景的 Prompt 模版，内置评价规则与示例，一键渲染与复制，帮助团队快速交付高质量的 AI 产出。';

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

function App() {
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
    const siteUrl = useMemo(
        () => (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, ''),
        [],
    );

    useEffect(() => {
        api.getCategories().then((data) => setCategories(data.categories || []));
        api.getConfig().then(setAiConfig);
    }, []);

    useEffect(() => {
        api.getTemplates(selectedCategory).then((data) => {
            setTemplates(data.templates || []);
            if (!selectedCategory) {
                setAllTemplateCount((data.templates || []).length);
            }
        });
    }, [selectedCategory]);

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

        api.getTemplate(selectedTemplateId).then((tpl) => {
            setTemplateDetail(tpl);
            const initial: Record<string, unknown> = {};
            (tpl.placeholders || []).forEach((p) => {
                initial[p.key] = p.default ?? '';
            });
            setValues(initial);
        });
    }, [selectedTemplateId, templates]);

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
            document.title = `${templateDetail.name} - 问题模版平台`;
        } else {
            document.title = '问题模版平台 · 精选 AI Prompt 模版库';
        }
    }, [templateDetail]);

    useEffect(() => {
        if (!templateDetail) return;
        api.render(templateDetail.id, values).then((res) => {
            setRendered(res.rendered_prompt || '');
            setMissing(res.missing_required || []);
        });
    }, [templateDetail, values]);

    useEffect(() => {
        const canonicalPath = templateDetail ? `/templates/${templateDetail.id}` : '/';
        const canonicalUrl = `${siteUrl}${canonicalPath}`;
        const desc = templateDetail?.short_description || DEFAULT_DESCRIPTION;
        const keywords = templateDetail?.tags?.join(', ') || 'Prompt 模版,AI 提示词,AI 生产力,模板库';

        ensureCanonical(canonicalUrl);
        ensureMeta({ name: 'description', content: desc });
        ensureMeta({ name: 'keywords', content: keywords });
        ensureMeta({ property: 'og:title', content: templateDetail ? `${templateDetail.name} · Prompt 模版` : '问题模版平台 · 精选 AI Prompt 模版库' });
        ensureMeta({ property: 'og:description', content: desc });
        ensureMeta({ property: 'og:url', content: canonicalUrl });
        ensureMeta({ name: 'twitter:title', content: templateDetail ? `${templateDetail.name} · Prompt 模版` : '问题模版平台 · 精选 AI Prompt 模版库' });
        ensureMeta({ name: 'twitter:description', content: desc });
        ensureMeta({ name: 'twitter:url', content: canonicalUrl });

        const templateLd = templateDetail
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'CreativeWork',
                  name: templateDetail.name,
                  description: desc,
                  inLanguage: 'zh-CN',
                  url: canonicalUrl,
                  genre: templateDetail.tags || [],
                  identifier: templateDetail.id,
                  isPartOf: {
                      '@type': 'WebApplication',
                      name: '问题模版平台',
                      url: `${siteUrl}/`,
                  },
              }
            : null;
        setJsonLd('ld-template', templateLd);
    }, [templateDetail, siteUrl]);

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
            name: 'Prompt 模版列表',
            numberOfItems: templates.length,
            itemListOrder: 'Descending',
            itemListElement: items,
        });
    }, [templates, siteUrl]);

    const filteredTemplates = useMemo(() => {
        const term = search.trim().toLowerCase();
        return templates.filter((tpl) => {
            if (!term) return true;
            return (
                tpl.name.toLowerCase().includes(term) ||
                (tpl.short_description || '').toLowerCase().includes(term) ||
                (tpl.tags || []).some((t) => t.toLowerCase().includes(term))
            );
        });
    }, [templates, search]);

    const handleAIFill = async (targetKey?: string) => {
        if (!templateDetail) return;
        setIsAIFilling(true);
        try {
            const res = await api.aiFill(templateDetail.id, values, targetKey);
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
            setMessage(`✨ ${res.reasoning || 'AI 填充完成'} `);
        } catch (error: any) {
            setMessage(`❌ AI 填充失败: ${error.message} `);
        } finally {
            setIsAIFilling(false);
            setTimeout(() => setMessage(''), 3500);
        }
    };

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(rendered || '');
            setMessage('📋 已复制 Prompt');
        } catch {
            setMessage('❌ 复制失败');
        }
        setTimeout(() => setMessage(''), 2500);
    };

    const goToGemini = () => {
        if (!rendered) {
            setMessage('⚠️ 请先填写模板生成 Prompt');
            setTimeout(() => setMessage(''), 2500);
            return;
        }
        const geminiUrl = `https://gemini.google.com/app?hl=zh-CN&prompt=${encodeURIComponent(rendered)}`;
        window.open(geminiUrl, '_blank');
        setMessage('🚀 已打开 Gemini');
        setTimeout(() => setMessage(''), 2500);
    };

    if (!templateDetail) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2 bg-[#f6f7fb]">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                正在加载模版...
            </div>
        );
    }

    const visibleTemplates = filteredTemplates.length;
    const hasExamples = (templateDetail.example_inputs || []).length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f7f8fc] via-[#f2f4f8] to-[#f6f8fb] text-slate-900 font-sans selection:bg-primary/15">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-2xl bg-white shadow-[0_10px_30px_-22px_rgba(0,0,0,0.55)] border border-slate-100">
                            <Terminal className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold tracking-tight">精选模版</div>
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 shadow-sm">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="font-medium text-slate-800">{categories.length} 类</span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-600">{allTemplateCount || templates.length} 模版</span>
                            <span className="text-slate-400">· {visibleTemplates} 当前</span>
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
                                {aiConfig.configured ? aiConfig.model : 'AI 未配置'}
                            </div>
                        )}
                        {message && (
                            <div className="animate-in fade-in slide-in-from-top-2 px-4 py-1.5 bg-white shadow-lg border border-slate-200 rounded-full text-sm text-slate-700 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                {message}
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => window.location.reload()}
                            size="sm"
                            className="rounded-full"
                            aria-label="刷新"
                            title="刷新"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 pb-8 pt-6">
                <div className="grid gap-6 lg:grid-cols-[320px_1.1fr_0.95fr]">
                    {/* Sidebar */}
                    <aside className="flex flex-col gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-[0_20px_60px_-48px_rgba(0,0,0,0.55)]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="搜索模版名称 / 标签"
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary/60 focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                        selectedCategory === ''
                                            ? 'bg-primary/10 border-primary/40 text-primary'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary'
                                    }`}
                                    onClick={() => setSelectedCategory('')}
                                >
                                    全部
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

                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent space-y-3 shadow-[0_20px_60px_-48px_rgba(0,0,0,0.4)]">
                            {filteredTemplates.map((tpl) => (
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
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Clock3 className="w-3.5 h-3.5" />
                                            <span>{(tpl.placeholders || []).length} 字段</span>
                                            {selectedTemplateId === tpl.id && <ChevronRight className="w-4 h-4 text-primary" />}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{tpl.short_description}</p>
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
                            ))}
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
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleAIFill()}
                                        disabled={isAIFilling || !aiConfig?.configured}
                                        isLoading={isAIFilling}
                                        size="sm"
                                        className="h-9 w-9 rounded-full !px-0"
                                        aria-label="AI 补全"
                                        title="AI 补全"
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
                                        aria-label="重置"
                                        title="重置"
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

                            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
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
                                                        <option value="">请选择...</option>
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
                                            className="bg-white border-slate-200"
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {missing.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                缺少必填字段：{missing.join(', ')}
                            </div>
                        )}
                    </section>

                    {/* Preview & Rules */}
                    <section className="flex flex-col gap-4">
                        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-[0_24px_70px_-55px_rgba(0,0,0,0.3)]">
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <h3 className="font-semibold text-sm text-slate-800">Prompt 预览</h3>
                                </div>
                                <div className="flex gap-2">
                                    {templateDetail.category_id === 'text2image' && (
                                        <Button
                                            onClick={goToGemini}
                                            size="sm"
                                            className="h-9 w-9 rounded-full !px-0"
                                            aria-label="Gemini"
                                            title="Gemini"
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={copyPrompt}
                                        size="sm"
                                        className="h-9 w-9 rounded-full !px-0"
                                        aria-label="复制"
                                        title="复制"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-5 bg-slate-50 max-h-[55vh] overflow-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                <pre className="text-sm whitespace-pre-wrap font-mono text-slate-800 leading-relaxed">
                                    {rendered || <span className="text-slate-400 italic">等待输入...</span>}
                                </pre>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-[0_24px_70px_-55px_rgba(0,0,0,0.3)]">
                            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                                <Layout className="w-4 h-4 text-primary" />
                                <h3 className="font-semibold text-sm text-slate-800">规则</h3>
                            </div>
                            <div className="p-5 space-y-5 max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                {(templateDetail.evaluation_rules?.manual_checklist || []).length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">检查</div>
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
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">标签</div>
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
                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">示例</div>
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
                                                    {ex.notes && <div className="text-xs text-slate-500 mt-1">备注：{ex.notes}</div>}
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

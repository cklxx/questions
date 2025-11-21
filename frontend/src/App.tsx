import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { Template, Category, AIConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

function App() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [search, setSearch] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [templateDetail, setTemplateDetail] = useState<Template | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [rendered, setRendered] = useState('');
    const [missing, setMissing] = useState<string[]>([]);
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
    const [aiFilledKeys, setAiFilledKeys] = useState<string[]>([]);
    const [isAIFilling, setIsAIFilling] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        api.getCategories().then((data) => setCategories(data.categories || []));
        api.getConfig().then(setAiConfig);
    }, []);

    useEffect(() => {
        api.getTemplates(selectedCategory).then((data) => setTemplates(data.templates || []));
    }, [selectedCategory]);

    useEffect(() => {
        if (!selectedTemplateId && templates.length > 0) {
            setSelectedTemplateId(templates[0].id);
        }
    }, [templates, selectedTemplateId]);

    useEffect(() => {
        if (!selectedTemplateId) return;
        api.getTemplate(selectedTemplateId).then((tpl) => {
            setTemplateDetail(tpl);
            const initial: Record<string, unknown> = {};
            (tpl.placeholders || []).forEach((p) => {
                initial[p.key] = p.default ?? '';
            });
            setValues(initial);
        });
    }, [selectedTemplateId]);

    useEffect(() => {
        if (!templateDetail) return;
        api.render(templateDetail.id, values).then((res) => {
            setRendered(res.rendered_prompt || '');
            setMissing(res.missing_required || []);
        });
    }, [templateDetail, values]);

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
            setMessage(`✨ ${res.reasoning || 'AI 填充完成'}`);
        } catch (error: any) {
            setMessage(`❌ AI 填充失败: ${error.message}`);
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
        return <div className="p-6">加载中...</div>;
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold gradient-text">问题模版平台</h1>
                    <div className="flex items-center gap-3">
                        {aiConfig && (
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${aiConfig.configured
                                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                        : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                                    }`}
                            >
                                <div className="w-2 h-2 rounded-full bg-current" />
                                {aiConfig.configured ? `AI: ${aiConfig.model}` : 'AI 未配置'}
                            </div>
                        )}
                        {message && <span className="px-3 py-1.5 bg-slate-800 rounded-full text-sm">{message}</span>}
                        <Button variant="ghost" onClick={() => window.location.reload()}>
                            刷新
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="grid grid-cols-[320px_1fr] gap-4 p-6">
                {/* Sidebar */}
                <aside className="space-y-4">
                    <Card>
                        <div className="space-y-3">
                            <div className="text-sm text-slate-400">分类</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${selectedCategory === ''
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    onClick={() => setSelectedCategory('')}
                                >
                                    全部
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${selectedCategory === cat.id
                                                ? 'bg-primary text-white'
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                            }`}
                                        onClick={() => setSelectedCategory(cat.id)}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <input
                        type="text"
                        placeholder="搜索模版名称/标签..."
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="text-xs text-slate-500">共 {filteredTemplates.length} 个模版</div>

                    <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                        {filteredTemplates.map((tpl) => (
                            <Card
                                key={tpl.id}
                                isActive={selectedTemplateId === tpl.id}
                                onClick={() => setSelectedTemplateId(tpl.id)}
                            >
                                <div className="font-semibold">{tpl.name}</div>
                                <div className="text-sm text-slate-400 mt-1">{tpl.short_description}</div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(tpl.tags || []).slice(0, 3).map((tag) => (
                                        <span key={tag} className="text-xs px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                </aside>

                {/* Main Area */}
                <main className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-4">
                    {/* Template Form */}
                    <Card>
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="font-bold text-lg">{templateDetail.name}</h2>
                                    <p className="text-sm text-slate-400 mt-1">{templateDetail.short_description}</p>
                                </div>
                                <Button onClick={() => handleAIFill()} disabled={isAIFilling || !aiConfig?.configured} isLoading={isAIFilling}>
                                    ✨ 一键 AI 补全
                                </Button>
                            </div>

                            <div className="space-y-3">
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
                                                rows={3}
                                            />
                                        );
                                    }
                                    if (p.type === 'enum') {
                                        return (
                                            <div key={p.key} className="space-y-1.5">
                                                <label className="text-sm text-slate-400">{p.label + (p.required ? ' *' : '')}</label>
                                                <select
                                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                    value={(values[p.key] as string) ?? ''}
                                                    onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                                                >
                                                    <option value="">请选择</option>
                                                    {(p.enum_options || []).map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
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
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </Card>

                    {/* Prompt Preview */}
                    <Card>
                        <div className="space-y-4 h-full flex flex-col">
                            <div>
                                <h2 className="font-bold">Prompt 预览</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    {missing.length ? `缺少必填字段：${missing.join(', ')}` : '实时渲染，可直接复制'}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {templateDetail.category_id === 'text2image' && (
                                    <Button onClick={goToGemini} className="bg-gradient-to-r from-primary to-accent">
                                        🎨 Gemini 生图
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={copyPrompt}>
                                    📋 复制
                                </Button>
                            </div>

                            <pre className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto text-sm whitespace-pre-wrap font-mono">
                                {rendered || '尚未渲染 Prompt'}
                            </pre>
                        </div>
                    </Card>

                    {/* Rules */}
                    <Card>
                        <div className="space-y-4">
                            <h2 className="font-bold">规则 & 说明</h2>

                            {(templateDetail.evaluation_rules?.manual_checklist || []).length > 0 && (
                                <div>
                                    <div className="text-sm text-slate-400 mb-2">人工检查清单</div>
                                    <ul className="space-y-1 text-sm">
                                        {(templateDetail.evaluation_rules?.manual_checklist || []).map((item, idx) => (
                                            <li key={idx} className="flex gap-2">
                                                <span className="text-success">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(templateDetail.tags || []).length > 0 && (
                                <div>
                                    <div className="text-sm text-slate-400 mb-2">标签</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(templateDetail.tags || []).map((tag) => (
                                            <span key={tag} className="text-xs px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </main>
            </div>
        </div>
    );
}

export default App;

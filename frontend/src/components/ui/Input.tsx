import React, { InputHTMLAttributes } from 'react';
import { Wand2, RefreshCw, Sparkles } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
    multiline?: boolean;
    onAIFill?: () => void;
    isAIFilled?: boolean;
    isAIFilling?: boolean;
    showAIButton?: boolean;
    rows?: number;
}

export const Input: React.FC<InputProps> = ({
    label,
    hint,
    error,
    multiline = false,
    onAIFill,
    isAIFilled,
    isAIFilling,
    showAIButton,
    className = '',
    ...props
}) => {
    const baseStyles =
        'w-full px-3 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none transition-colors shadow-[0_10px_30px_-24px_rgba(0,0,0,0.45)]';

    const Component = multiline ? 'textarea' : 'input';

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-700">{label}</label>
                    {isAIFilled && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            已补全
                        </span>
                    )}
                </div>
            )}
            <div className="relative">
                <Component
                    className={`${baseStyles} ${isAIFilled ? 'ring-1 ring-green-500/30 border-green-200' : ''} ${className}`}
                    placeholder={hint}
                    {...(props as any)}
                />
                {showAIButton && onAIFill && (
                    <button
                        onClick={onAIFill}
                        disabled={isAIFilling}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all border ${
                            isAIFilled
                                ? 'text-green-600 bg-green-50 border-green-100 hover:bg-green-100'
                                : 'text-primary/80 hover:text-primary hover:bg-primary/10 border-transparent'
                        }`}
                        title="AI 自动填充"
                    >
                        {isAIFilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                )}
                {isAIFilled && <span className="absolute right-11 top-1/2 -translate-y-1/2 text-xs opacity-60">✨</span>}
            </div>
            {error && <span className="text-xs text-error">{error}</span>}
            {hint && <span className="text-xs text-slate-500">{hint}</span>}
        </div>
    );
};

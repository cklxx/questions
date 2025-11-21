import React, { InputHTMLAttributes } from 'react';

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
        'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors';

    const Component = multiline ? 'textarea' : 'input';

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-400">{label}</label>
                    {showAIButton && onAIFill && (
                        <button
                            type="button"
                            onClick={onAIFill}
                            disabled={isAIFilling}
                            className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            {isAIFilling ? (
                                <div className="w-3 h-3 border-2 border-slate-500 border-t-primary rounded-full animate-spin" />
                            ) : (
                                '✨'
                            )}
                            AI 填写
                        </button>
                    )}
                </div>
            )}
            <div className="relative">
                <Component
                    className={`${baseStyles} ${isAIFilled ? 'ring-1 ring-green-500/30' : ''} ${className}`}
                    placeholder={hint}
                    {...(props as any)}
                />
                {isAIFilled && <span className="absolute top-2 right-2 text-xs opacity-50">✨</span>}
            </div>
            {error && <span className="text-xs text-error">{error}</span>}
        </div>
    );
};

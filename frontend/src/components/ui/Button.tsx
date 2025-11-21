import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    isLoading,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles =
        'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 focus:ring-offset-[#f6f7fb] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm';

    const variants = {
        primary:
            'bg-primary text-white hover:bg-primary/90 shadow-[0_10px_30px_-18px_rgba(107,127,184,0.9)] focus:ring-primary/40',
        secondary:
            'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 focus:ring-primary/25',
        ghost: 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white/70 focus:ring-primary/20 border border-transparent',
        danger:
            'bg-error/10 text-error hover:bg-error/15 border border-error/20 focus:ring-error/30'
    };

    const sizes = {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-3 text-base'
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </button>
    );
};

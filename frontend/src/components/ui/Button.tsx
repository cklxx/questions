import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    isLoading = false,
    disabled,
    className = '',
    ...props
}) => {
    const baseStyles =
        'px-4 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';

    const variantStyles = {
        primary:
            'bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-primary text-white shadow-md hover:shadow-lg',
        secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
        ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700',
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {children}
        </button>
    );
};

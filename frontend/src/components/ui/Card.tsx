import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    isActive?: boolean;
    hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    onClick,
    isActive = false,
    hover = true,
}) => {
    const baseStyles = 'bg-slate-900 border rounded-xl p-4 transition-all duration-200';
    const interactiveStyles = onClick ? 'cursor-pointer' : '';
    const hoverStyles = hover && onClick ? 'hover:border-primary hover:shadow-lg hover:shadow-primary/10' : '';
    const activeStyles = isActive ? 'border-primary shadow-lg shadow-primary/20' : 'border-slate-800';

    return (
        <div
            className={`${baseStyles} ${interactiveStyles} ${hoverStyles} ${activeStyles} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

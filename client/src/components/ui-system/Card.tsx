import React from 'react';
import { COLORS, SPACING, SHADOWS } from './design-tokens';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  hover?: boolean;
  padding?: keyof typeof SPACING | 'none';
  border?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

/**
 * A simple card component with Apple-inspired styling
 */
export function Card({
  children,
  className = '',
  elevated = false,
  hover = false,
  padding = 6,
  border = true,
  gradient = false,
  onClick
}: CardProps) {
  const paddingClasses = padding === 'none' ? '' : `p-${padding}`;
  
  const baseClasses = [
    'rounded-2xl',
    'backdrop-blur-sm',
    border ? 'border border-zinc-800' : '',
    gradient ? `bg-gradient-to-br from-zinc-900/80 to-zinc-800/80` : 'bg-zinc-900/50',
    paddingClasses,
    elevated ? SHADOWS.md : '',
    hover ? 'transition-all hover:bg-zinc-800/60 hover:border-zinc-700' : '',
    onClick ? 'cursor-pointer' : '',
    className
  ].filter(Boolean).join(' ');
  
  if (onClick) {
    return (
      <div className={baseClasses} onClick={onClick}>
        {children}
      </div>
    );
  }
  
  return (
    <div className={baseClasses}>
      {children}
    </div>
  );
}

/**
 * Card Header
 */
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Card Title
 */
interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-xl font-semibold text-white mb-1 ${className}`}>
      {children}
    </h3>
  );
}

/**
 * Card Description
 */
interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-zinc-300 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Card Content
 */
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/**
 * Card Footer
 */
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-4 pt-4 border-t border-zinc-800 ${className}`}>
      {children}
    </div>
  );
}
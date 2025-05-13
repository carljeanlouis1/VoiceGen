import React from 'react';
import { Button as ShadcnButton } from '@/components/ui/button';
import { COLORS } from './design-tokens';

// Button variants
type ButtonVariant = 
  | 'primary'    // Gradient background button (main CTA)
  | 'secondary'  // Light background with dark text
  | 'outline'    // Transparent with outline
  | 'ghost'      // No background or border
  | 'danger'     // Red danger button
  | 'success'    // Green success button
  | 'text';      // Pure text button without padding

// Button sizes
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'pill';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
  asChild?: boolean;
}

/**
 * Enhanced button component with Apple-inspired styling
 */
export function EnhancedButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Mapping our variants to shadcn/ui variants
  const variantMap: Record<ButtonVariant, string> = {
    primary: 'bg-gradient-to-r from-[#0A84FF] to-[#30D158] hover:opacity-90 text-white border-0',
    secondary: 'bg-white text-black hover:bg-white/90 border-0',
    outline: 'bg-transparent border border-zinc-700 hover:border-zinc-500 text-white',
    ghost: 'bg-transparent hover:bg-white/10 text-white',
    danger: 'bg-[#FF453A] hover:bg-[#FF453A]/90 text-white border-0',
    success: 'bg-[#30D158] hover:bg-[#30D158]/90 text-white border-0',
    text: 'bg-transparent hover:bg-transparent hover:underline text-white p-0'
  };

  // Mapping our sizes to shadcn/ui sizes plus custom ones
  const sizeMap: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-10 px-4 py-2 text-sm rounded-lg',
    lg: 'h-12 px-6 py-3 text-base rounded-xl',
    icon: 'h-10 w-10 p-2 rounded-full',
    pill: 'h-10 px-6 rounded-full'
  };

  // Construct class names
  const buttonClasses = [
    variantMap[variant],
    sizeMap[size],
    fullWidth ? 'w-full' : '',
    disabled || isLoading ? 'opacity-50 cursor-not-allowed' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <ShadcnButton
      className={buttonClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </ShadcnButton>
  );
}

// Export a renamed component to avoid confusion
export const Button = EnhancedButton;
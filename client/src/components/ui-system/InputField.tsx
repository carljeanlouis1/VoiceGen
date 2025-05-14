import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLORS } from './design-tokens';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Enhanced input field with Apple-inspired styling
 */
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    // Generate id if not provided
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    
    return (
      <div className={`space-y-2 ${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <Label
            htmlFor={inputId}
            className="text-sm font-medium text-zinc-300"
          >
            {label}
          </Label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              {leftIcon}
            </div>
          )}
          
          <Input
            ref={ref}
            id={inputId}
            className={`
              bg-zinc-800/50 border-zinc-700 focus:border-[${COLORS.primary}] focus:ring-1 focus:ring-[${COLORS.primary}]/30
              text-white placeholder:text-zinc-500
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error ? 'border-[#FF453A]' : ''}
              rounded-xl h-11
              ${className}
            `}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(helperText || error) && (
          <p 
            className={`text-xs ${
              error ? 'text-[#FF453A]' : 'text-zinc-400'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
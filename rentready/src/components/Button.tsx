/** Shared Button component with accessibility */

import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'min-h-[44px] px-4',
        size === 'sm' && 'text-sm',
        size === 'lg' && 'text-lg px-6',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-dark',
        variant === 'secondary' && 'bg-surface text-ink border border-border hover:bg-gray-50',
        variant === 'ghost' && 'bg-transparent text-primary hover:bg-green-50',
        variant === 'danger' && 'bg-danger text-on-primary hover:bg-danger-dark',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

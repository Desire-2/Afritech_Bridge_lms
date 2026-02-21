import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Clock, Loader2, WifiOff } from 'lucide-react';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';
import {
  getPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
} from '@/lib/form-validation';

// ---------------------------------------------------------------------------
// FormField
// ---------------------------------------------------------------------------

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  /** Called when the field loses focus — use for real-time blur validation */
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  error?: string;
  /** Show green ring when field is touched and valid */
  valid?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode; // For select options
  as?: 'input' | 'textarea' | 'select';
  rows?: number;
  /** Show a character counter when maxLength is provided */
  maxLength?: number;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  valid,
  required = false,
  disabled = false,
  className,
  children,
  as = 'input',
  rows = 4,
  maxLength,
  hint,
}) => {
  const hasError = Boolean(error);
  const isValid = valid && !hasError;

  const inputClasses = cn(
    'w-full px-3 py-2 border rounded-md shadow-sm text-sm transition-colors',
    'focus:outline-none focus:ring-2',
    hasError
      ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:ring-red-400 focus:border-red-500'
      : isValid
      ? 'border-green-500 bg-white dark:bg-gray-800 focus:ring-green-400 focus:border-green-500'
      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500',
    disabled && 'opacity-50 cursor-not-allowed',
    // Add right padding so icon doesn't overlap text
    (hasError || isValid) && as !== 'textarea' && as !== 'select' ? 'pr-9' : '',
    className
  );

  const Component = as as React.ElementType;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
        {maxLength !== undefined && (
          <span
            className={cn(
              'text-xs tabular-nums',
              value.length > maxLength * 0.9
                ? value.length >= maxLength
                  ? 'text-red-500 font-semibold'
                  : 'text-orange-500'
                : 'text-gray-400 dark:text-gray-500'
            )}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      <div className="relative">
        <Component
          id={name}
          name={name}
          type={as === 'input' ? type : undefined}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          rows={as === 'textarea' ? rows : undefined}
          maxLength={maxLength}
          className={inputClasses}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={
            [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          {children}
        </Component>

        {/* Validation icon — only for non-select, non-textarea fields */}
        {as === 'input' && (hasError || isValid) && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {hasError ? (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {hint && !hasError && (
        <p id={`${name}-hint`} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}

      {hasError && (
        <p id={`${name}-error`} role="alert" className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PasswordStrengthBar
// ---------------------------------------------------------------------------

interface PasswordStrengthBarProps {
  password: string;
  className?: string;
}

export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({ password, className }) => {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  const color = getPasswordStrengthColor(strength);
  const label = getPasswordStrengthLabel(strength);
  const widthPercent = (strength / 4) * 100;

  return (
    <div className={cn('space-y-1', className)} aria-label={`Password strength: ${label}`}>
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Strength: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AutoSaveIndicator
// ---------------------------------------------------------------------------

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  className?: string;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ status, lastSaved, className }) => {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn('flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 transition-opacity', className)}
      aria-live="polite"
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" aria-hidden="true" />
          <span>Saving draft…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
          <span className="text-green-600 dark:text-green-400">Draft saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <WifiOff className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          <span className="text-red-500">Could not save draft</span>
        </>
      )}
      {status === 'idle' && lastSaved && (
        <>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Draft saved at {formatTime(lastSaved)}</span>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// DraftRestoreBanner
// ---------------------------------------------------------------------------

interface DraftRestoreBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
  message?: string;
  restoreLabel?: string;
  discardLabel?: string;
}

export const DraftRestoreBanner: React.FC<DraftRestoreBannerProps> = ({
  onRestore,
  onDiscard,
  className,
  message = 'You have an unsaved draft. Would you like to restore it?',
  restoreLabel = 'Restore',
  discardLabel = 'Discard',
}) => (
  <div
    className={cn(
      'flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3',
      className
    )}
    role="alert"
  >
    <p className="text-sm text-blue-800 dark:text-blue-200">
      {message}
    </p>
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={onRestore}
        className="rounded px-3 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        {restoreLabel}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded px-3 py-1 text-xs font-medium border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
      >
        {discardLabel}
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Form wrapper
// ---------------------------------------------------------------------------

interface FormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Form: React.FC<FormProps> = ({ onSubmit, children, className, disabled }) => {
  return (
    <form
      onSubmit={onSubmit}
      className={cn('space-y-4', className)}
      noValidate
    >
      <fieldset disabled={disabled} className="space-y-4">
        {children}
      </fieldset>
    </form>
  );
};

// ---------------------------------------------------------------------------
// SubmitButton
// ---------------------------------------------------------------------------

interface SubmitButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
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
      {children}
    </button>
  );
};

interface ErrorAlertProps {
  errors?: Record<string, string[]>;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ errors, className }) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  const generalErrors = errors.general || [];
  const fieldErrors = Object.entries(errors).filter(([key]) => key !== 'general');

  return (
    <div className={cn('bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4', className)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {generalErrors.length > 0 || fieldErrors.length > 1 ? 'There were errors with your submission' : 'There was an error with your submission'}
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            {generalErrors.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {generalErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            )}
            {fieldErrors.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {fieldErrors.map(([field, fieldErrorList]) => (
                  fieldErrorList.map((error, index) => (
                    <li key={`${field}-${index}`}>
                      <span className="font-medium capitalize">{field.replace('_', ' ')}:</span> {error}
                    </li>
                  ))
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SuccessAlertProps {
  message: string;
  className?: string;
}

export const SuccessAlert: React.FC<SuccessAlertProps> = ({ message, className }) => {
  return (
    <div className={cn('bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-md p-4', className)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};
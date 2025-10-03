import React from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode; // For select options
  as?: 'input' | 'textarea' | 'select';
  rows?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  className,
  children,
  as = 'input',
  rows = 4,
}) => {
  const inputClasses = cn(
    'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    error 
      ? 'border-red-500 bg-red-50 dark:bg-red-900/10' 
      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  const Component = as;

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <Component
        id={name}
        name={name}
        type={as === 'input' ? type : undefined}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={as === 'textarea' ? rows : undefined}
        className={inputClasses}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        {children}
      </Component>
      
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

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
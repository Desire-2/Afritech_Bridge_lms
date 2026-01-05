'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/atom-one-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '',
  variant = 'default'
}) => {
  const baseClasses = 'prose dark:prose-invert max-w-none';
  
  const variantClasses = {
    default: 'prose-lg',
    compact: 'prose-sm',
    card: 'prose-sm'
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // Custom heading styles
          h1: ({ node, className, children, ...props }) => (
            <h1 
              className={cn(
                "text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2",
                className
              )} 
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ node, className, children, ...props }) => (
            <h2 
              className={cn(
                "text-xl font-semibold mt-5 mb-3 text-gray-800 dark:text-gray-100",
                className
              )} 
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ node, className, children, ...props }) => (
            <h3 
              className={cn(
                "text-lg font-medium mt-4 mb-2 text-gray-700 dark:text-gray-200",
                className
              )} 
              {...props}
            >
              {children}
            </h3>
          ),
          
          // Custom paragraph styling
          p: ({ node, className, children, ...props }) => (
            <p 
              className={cn(
                "leading-relaxed text-gray-700 dark:text-gray-300 mb-3",
                className
              )} 
              {...props}
            >
              {children}
            </p>
          ),

          // Custom list styling
          ul: ({ node, className, children, ...props }) => (
            <ul 
              className={cn(
                "list-disc list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300",
                className
              )} 
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ node, className, children, ...props }) => (
            <ol 
              className={cn(
                "list-decimal list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300",
                className
              )} 
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ node, className, children, ...props }) => (
            <li 
              className={cn(
                "ml-4 text-gray-700 dark:text-gray-300",
                className
              )} 
              {...props}
            >
              {children}
            </li>
          ),

          // Custom blockquote styling
          blockquote: ({ node, className, children, ...props }) => (
            <blockquote 
              className={cn(
                "border-l-4 border-blue-500 pl-4 py-2 italic bg-blue-50 dark:bg-blue-900/20 rounded-r-lg my-4",
                className
              )} 
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Custom code styling
          code: ({ node, className, children, inline, ...props }) => (
            inline ? (
              <code 
                className={cn(
                  "px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100",
                  className
                )} 
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          ),

          // Custom pre/code block styling
          pre: ({ node, className, children, ...props }) => (
            <pre 
              className={cn(
                "bg-gray-900 rounded-lg p-4 overflow-x-auto my-4 border border-gray-600",
                className
              )} 
              {...props}
            >
              {children}
            </pre>
          ),

          // Custom table styling
          table: ({ node, className, children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table 
                className={cn(
                  "min-w-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden",
                  className
                )} 
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ node, className, children, ...props }) => (
            <thead 
              className={cn(
                "bg-gray-100 dark:bg-gray-700",
                className
              )} 
              {...props}
            >
              {children}
            </thead>
          ),
          th: ({ node, className, children, ...props }) => (
            <th 
              className={cn(
                "px-4 py-2 border-b border-gray-300 dark:border-gray-600 text-left font-medium text-gray-900 dark:text-gray-100",
                className
              )} 
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ node, className, children, ...props }) => (
            <td 
              className={cn(
                "px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
                className
              )} 
              {...props}
            >
              {children}
            </td>
          ),

          // Custom link styling
          a: ({ node, className, children, ...props }) => (
            <a 
              className={cn(
                "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors",
                className
              )} 
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          // Custom image styling
          img: ({ node, className, alt, ...props }) => (
            <img 
              className={cn(
                "max-w-full h-auto rounded-lg shadow-sm my-4 border border-gray-200 dark:border-gray-700",
                className
              )} 
              alt={alt}
              {...props}
            />
          ),

          // Custom horizontal rule styling
          hr: ({ node, className, ...props }) => (
            <hr 
              className={cn(
                "my-6 border-gray-300 dark:border-gray-600",
                className
              )} 
              {...props}
            />
          ),

          // Task list styling
          input: ({ node, className, type, ...props }) => (
            type === 'checkbox' ? (
              <input 
                className={cn(
                  "mr-2 rounded border-gray-300 dark:border-gray-600",
                  className
                )} 
                type={type}
                disabled
                {...props}
              />
            ) : (
              <input className={className} type={type} {...props} />
            )
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
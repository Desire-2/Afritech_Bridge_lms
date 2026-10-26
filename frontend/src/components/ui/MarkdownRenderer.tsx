'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  lessonRemarkPlugins,
  lessonRehypePlugins,
  lessonUrlTransform,
} from '@/lib/markdown';
import { MarkdownCode, MarkdownPre } from '@/components/ui/markdown-code';
import { cn, parseImageDimensions } from '@/lib/utils';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

/**
 * General-purpose markdown renderer used by assignment/instructor surfaces.
 *
 * Raw HTML in the source is parsed (rehype-raw) and then reduced to the
 * lesson sanitization allowlist before it can reach the DOM. See
 * `src/lib/markdown.ts` for the policy and plugin ordering.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  variant = 'default'
}) => {
  const baseClasses = 'prose prose-sm sm:prose-base dark:prose-invert max-w-none';

  const variantClasses = {
    default: '',
    compact: '!prose-sm',
    card: '!prose-sm'
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <ReactMarkdown
        remarkPlugins={lessonRemarkPlugins}
        rehypePlugins={lessonRehypePlugins}
        urlTransform={lessonUrlTransform}
        components={{
          h1: ({ node: _node, className, children, ...props }) => (
            <h1
              className={cn(
                "text-3xl sm:text-4xl font-bold mt-6 mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2",
                className
              )}
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ node: _node, className, children, ...props }) => (
            <h2
              className={cn(
                "text-2xl sm:text-3xl font-semibold mt-5 mb-3 text-gray-800 dark:text-gray-100",
                className
              )}
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ node: _node, className, children, ...props }) => (
            <h3
              className={cn(
                "text-xl sm:text-2xl font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200",
                className
              )}
              {...props}
            >
              {children}
            </h3>
          ),
          p: ({ node: _node, className, children, ...props }) => (
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
          ul: ({ node: _node, className, children, ...props }) => (
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
          ol: ({ node: _node, className, children, ...props }) => (
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
          li: ({ node: _node, className, children, ...props }) => (
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
          blockquote: ({ node: _node, className, children, ...props }) => (
            <blockquote
              className={cn(
                "border-l-4 border-blue-500 pl-4 pr-4 py-3 my-4 italic rounded-r-lg bg-blue-50 dark:bg-blue-900/20",
                className
              )}
              {...props}
            >
              {children}
            </blockquote>
          ),
          pre: MarkdownPre,
          code: MarkdownCode,
          table: ({ node: _node, className, children, ...props }) => (
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
          thead: ({ node: _node, className, children, ...props }) => (
            <thead
              className={cn("bg-gray-100 dark:bg-gray-700", className)}
              {...props}
            >
              {children}
            </thead>
          ),
          th: ({ node: _node, className, children, ...props }) => (
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
          td: ({ node: _node, className, children, ...props }) => (
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
          a: ({ node: _node, className, children, href, ...props }) => {
            const isInternal =
              typeof href === 'string' && (href.startsWith('#') || href.startsWith('/'));
            return (
              <a
                className={cn(
                  "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded",
                  className
                )}
                href={href}
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                {...props}
              >
                {children}
              </a>
            );
          },
          img: ({ node: _node, className, alt, src, ...props }) => {
            // react-markdown types `src` as `string | Blob`; only strings
            // reach the parser.
            const srcText = typeof src === 'string' ? src : '';
            const { src: cleanSrc, width, height } = parseImageDimensions(srcText);
            const style: React.CSSProperties = {};
            if (width) style.maxWidth = `${width}px`;
            if (height) style.height = 'auto';
            return (
              <img
                className={cn(
                  "rounded-lg shadow-sm my-4 border border-gray-200 dark:border-gray-700 max-w-full h-auto",
                  className
                )}
                src={cleanSrc}
                alt={alt || ''}
                width={width}
                height={height}
                loading="lazy"
                style={style}
                {...props}
              />
            );
          },
          hr: ({ node: _node, className, ...props }) => (
            <hr
              className={cn("my-6 border-gray-300 dark:border-gray-600", className)}
              {...props}
            />
          ),
          input: ({ node: _node, className, type, ...props }) => (
            type === 'checkbox' ? (
              <input
                className={cn("mr-2 rounded border-gray-300 dark:border-gray-600", className)}
                type={type}
                disabled
                readOnly
                {...props}
              />
            ) : null
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

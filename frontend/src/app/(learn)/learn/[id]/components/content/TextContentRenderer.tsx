"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  lessonRemarkPlugins,
  lessonRehypePlugins,
  lessonUrlTransform,
} from "@/lib/markdown";
import "highlight.js/styles/atom-one-dark.css";
import "katex/dist/katex.min.css";
import { parseImageDimensions } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { MarkdownCode, MarkdownPre } from "@/components/ui/markdown-code";
import "../markdown-styles.css";

interface FontSizeClasses {
  p: string; li: string; h1: string; h2: string; h3: string;
  h4: string; h5: string; h6: string;
}

const FONT_SIZES: Record<string, FontSizeClasses> = {
  "-1": {
    p: "text-gray-200 leading-relaxed mb-4 text-base sm:text-lg",
    li: "text-gray-200 leading-relaxed text-base sm:text-lg marker:text-blue-400",
    h1: "text-2xl sm:text-3xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-xl sm:text-2xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-lg sm:text-xl font-semibold text-white mb-4 mt-6",
    h4: "text-base sm:text-lg font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-base font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-sm font-semibold text-gray-400 mb-2 mt-3",
  },
  "0": {
    p: "text-gray-200 leading-relaxed mb-5 text-lg",
    li: "text-gray-200 leading-relaxed text-lg marker:text-blue-400",
    h1: "text-3xl sm:text-4xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-2xl sm:text-3xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-xl sm:text-2xl font-semibold text-white mb-4 mt-6",
    h4: "text-lg sm:text-xl font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-base sm:text-lg font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-sm sm:text-base font-semibold text-gray-400 mb-2 mt-3",
  },
  "1": {
    p: "text-gray-200 leading-relaxed mb-6 text-xl",
    li: "text-gray-200 leading-relaxed text-xl marker:text-blue-400",
    h1: "text-4xl sm:text-5xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-3xl sm:text-4xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-2xl sm:text-3xl font-semibold text-white mb-4 mt-6",
    h4: "text-xl sm:text-2xl font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-lg sm:text-xl font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-base sm:text-lg font-semibold text-gray-400 mb-2 mt-3",
  },
};

export interface TextContentRendererProps {
  content: string;
  showFontControls?: boolean;
}

/**
 * Lesson body renderer.
 *
 * Content is parsed with react-markdown v10 and any embedded raw HTML is
 * reduced to the shared sanitization allowlist (`src/lib/markdown.ts`)
 * before it reaches the DOM. Content is never rewritten by regex.
 */
export const TextContentRenderer: React.FC<TextContentRendererProps> = ({
  content, showFontControls = true,
}) => {
  const [fontSizeLevel, setFontSizeLevel] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lesson_font_size");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed >= -1 && parsed <= 1) setFontSizeLevel(parsed);
      }
    } catch {
      /* storage unavailable — keep default */
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("lesson_font_size", fontSizeLevel.toString()); } catch { /* ignore */ }
  }, [fontSizeLevel]);

  const fs = FONT_SIZES[String(fontSizeLevel)] || FONT_SIZES["0"];
  const source = useMemo(() => (typeof content === "string" ? content : ""), [content]);

  return (
    <div>
      {showFontControls && (
        <div className="flex items-center justify-end gap-1 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setFontSizeLevel((p) => Math.max(-1, p - 1))}
            disabled={fontSizeLevel <= -1} className="h-11 w-11 p-0 text-gray-400" aria-label="Decrease text size">
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-xs text-gray-400 w-16 text-center" aria-live="polite">
            {fontSizeLevel === -1 ? "Small" : fontSizeLevel === 0 ? "Normal" : "Large"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFontSizeLevel((p) => Math.min(1, p + 1))}
            disabled={fontSizeLevel >= 1} className="h-11 w-11 p-0 text-gray-400" aria-label="Increase text size">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Constrain the measure so body copy stays readable on wide screens. */}
      <div className="prose prose-invert lesson-prose max-w-[72ch]">
        <ReactMarkdown
          remarkPlugins={lessonRemarkPlugins}
          rehypePlugins={lessonRehypePlugins}
          urlTransform={lessonUrlTransform}
          components={{
            h1: ({ node: _n, className, children, ...p }) => (
              <h1 className={`${fs.h1} ${className || ""}`} {...p}>{children}</h1>
            ),
            h2: ({ node: _n, className, children, ...p }) => (
              <h2 className={`${fs.h2} ${className || ""}`} {...p}>{children}</h2>
            ),
            h3: ({ node: _n, className, children, ...p }) => (
              <h3 className={`${fs.h3} ${className || ""}`} {...p}>{children}</h3>
            ),
            h4: ({ node: _n, className, children, ...p }) => (
              <h4 className={`${fs.h4} ${className || ""}`} {...p}>{children}</h4>
            ),
            h5: ({ node: _n, className, children, ...p }) => (
              <h5 className={`${fs.h5} ${className || ""}`} {...p}>{children}</h5>
            ),
            h6: ({ node: _n, className, children, ...p }) => (
              <h6 className={`${fs.h6} ${className || ""}`} {...p}>{children}</h6>
            ),
            p: ({ node: _n, className, children, ...p }) => {
              const text = typeof children === "string" ? children.trim() : "";
              if (!text && !React.Children.toArray(children).some(React.isValidElement)) return null;
              return <p className={`${fs.p} ${className || ""}`} {...p}>{children}</p>;
            },
            ul: ({ node: _n, className, children, ...p }) => (
              <ul className={`list-disc list-outside space-y-2 mb-4 text-gray-200 ml-6 pl-2 ${className || ""}`} {...p}>{children}</ul>
            ),
            ol: ({ node: _n, className, children, ...p }) => (
              <ol className={`list-decimal list-outside space-y-2 mb-4 text-gray-200 ml-6 pl-2 ${className || ""}`} {...p}>{children}</ol>
            ),
            li: ({ node: _n, className, children, ...p }) => (
              <li className={`${fs.li} ${className || ""}`} {...p}>{children}</li>
            ),
            pre: MarkdownPre,
            code: MarkdownCode,
            blockquote: ({ node: _n, className, children, ...p }) => (
              <blockquote className={`border-l-4 border-blue-500 bg-blue-900/20 pl-4 pr-4 py-3 my-4 italic rounded-r-lg text-gray-300 ${className || ""}`} {...p}>{children}</blockquote>
            ),
            a: ({ node: _n, className, children, href, ...p }) => {
              const isInternal = typeof href === "string" && (href.startsWith("#") || href.startsWith("/"));
              return (
                <a
                  className={`text-blue-400 hover:text-blue-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${className || ""}`}
                  href={href}
                  target={isInternal ? undefined : "_blank"}
                  rel={isInternal ? undefined : "noopener noreferrer"}
                  {...p}
                >{children}</a>
              );
            },
            table: ({ node: _n, className, children, ...p }) => (
              <div className="overflow-x-auto my-4">
                <table className={`min-w-full border border-gray-700 rounded-lg overflow-hidden ${className || ""}`} {...p}>{children}</table>
              </div>
            ),
            thead: ({ node: _n, className, children, ...p }) => (
              <thead className={`bg-gray-800 ${className || ""}`} {...p}>{children}</thead>
            ),
            tbody: ({ node: _n, className, children, ...p }) => (
              <tbody className={`divide-y divide-gray-700 ${className || ""}`} {...p}>{children}</tbody>
            ),
            tr: ({ node: _n, className, children, ...p }) => (
              <tr className={`hover:bg-gray-800/50 ${className || ""}`} {...p}>{children}</tr>
            ),
            th: ({ node: _n, className, children, ...p }) => (
              <th className={`px-4 py-3 text-left text-sm font-semibold text-gray-200 border-b border-gray-700 ${className || ""}`} {...p}>{children}</th>
            ),
            td: ({ node: _n, className, children, ...p }) => (
              <td className={`px-4 py-3 text-sm text-gray-300 ${className || ""}`} {...p}>{children}</td>
            ),
            img: ({ node: _n, className, src, alt, ...p }) => {
              const parsed = parseImageDimensions(typeof src === "string" ? src : "");
              return (
                <img
                  className={`rounded-lg my-4 shadow-lg max-w-full h-auto ${className || ""}`}
                  src={parsed.src}
                  alt={alt || ""}
                  width={parsed.width}
                  height={parsed.height}
                  loading="lazy"
                  style={parsed.width ? { maxWidth: `${parsed.width}px`, height: "auto" } : { maxWidth: "100%", height: "auto" }}
                  {...p}
                />
              );
            },
            strong: ({ node: _n, className, children, ...p }) => (
              <strong className={`font-bold text-white ${className || ""}`} {...p}>{children}</strong>
            ),
            em: ({ node: _n, className, children, ...p }) => (
              <em className={`italic text-gray-200 ${className || ""}`} {...p}>{children}</em>
            ),
            hr: ({ node: _n, className, ...p }) => (
              <hr className={`my-8 border-gray-700 ${className || ""}`} {...p} />
            ),
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default TextContentRenderer;

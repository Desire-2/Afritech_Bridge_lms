"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";
import { parseImageDimensions } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import "../markdown-styles.css";

interface FontSizeClasses {
  p: string; li: string; h1: string; h2: string; h3: string;
  h4: string; h5: string; h6: string;
}

const FONT_SIZES: Record<string, FontSizeClasses> = {
  "-1": {
    p: "text-gray-200 leading-relaxed mb-4 text-base sm:text-lg",
    li: "text-gray-200 leading-relaxed text-base sm:text-lg marker:text-blue-400",
    h1: "text-3xl sm:text-4xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-2xl sm:text-3xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-xl sm:text-2xl font-semibold text-white mb-4 mt-6",
    h4: "text-lg sm:text-xl font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-base sm:text-lg font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-sm sm:text-base font-semibold text-gray-400 mb-2 mt-3",
  },
  "0": {
    p: "text-gray-200 leading-relaxed mb-5 text-lg sm:text-xl",
    li: "text-gray-200 leading-relaxed text-lg sm:text-xl marker:text-blue-400",
    h1: "text-4xl sm:text-5xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-3xl sm:text-4xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-2xl sm:text-3xl font-semibold text-white mb-4 mt-6",
    h4: "text-xl sm:text-2xl font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-lg sm:text-xl font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-base sm:text-lg font-semibold text-gray-400 mb-2 mt-3",
  },
  "1": {
    p: "text-gray-200 leading-relaxed mb-6 text-xl sm:text-2xl",
    li: "text-gray-200 leading-relaxed text-xl sm:text-2xl marker:text-blue-400",
    h1: "text-5xl sm:text-6xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3",
    h2: "text-4xl sm:text-5xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2",
    h3: "text-3xl sm:text-4xl font-semibold text-white mb-4 mt-6",
    h4: "text-2xl sm:text-3xl font-semibold text-gray-200 mb-3 mt-5",
    h5: "text-xl sm:text-2xl font-semibold text-gray-300 mb-2 mt-4",
    h6: "text-lg sm:text-xl font-semibold text-gray-400 mb-2 mt-3",
  },
};

function sanitizeMarkdown(content: string): string {
  if (!content) return "";
  return content
    .replace(/```([^`\n]{1,50})```/g, "`$1`")
    .replace(/```\s*```/g, "")
    .replace(/```[\w]*\s*\n\s*```/g, "")
    .replace(/```\n```/g, "```\n\n```")
    .replace(/(\n|^)(#{1,6}\s)/g, "\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n([A-Z])/g, "$1\n\n$2")
    .trim();
}

export interface TextContentRendererProps {
  content: string;
  showFontControls?: boolean;
}

export const TextContentRenderer: React.FC<TextContentRendererProps> = ({
  content, showFontControls = true,
}) => {
  const [fontSizeLevel, setFontSizeLevel] = useState(0);

  // Load saved preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lesson_font_size");
      if (saved !== null) {
        const p = parseInt(saved, 10);
        if (p >= -1 && p <= 1) setFontSizeLevel(p);
      }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem("lesson_font_size", fontSizeLevel.toString()); } catch {}
  }, [fontSizeLevel]);

  const fs = FONT_SIZES[String(fontSizeLevel)] || FONT_SIZES["0"];
  const cleanContent = useMemo(() => sanitizeMarkdown(content), [content]);

  return (
    <div>
      {showFontControls && (
        <div className="flex items-center justify-end gap-1 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setFontSizeLevel((p) => Math.max(-1, p - 1))}
            disabled={fontSizeLevel <= -1} className="h-8 w-8 p-0 text-gray-400" aria-label="Decrease font size">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500 w-16 text-center">
            {fontSizeLevel === -1 ? "Small" : fontSizeLevel === 0 ? "Normal" : "Large"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFontSizeLevel((p) => Math.min(1, p + 1))}
            disabled={fontSizeLevel >= 1} className="h-8 w-8 p-0 text-gray-400" aria-label="Increase font size">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={{
            h1: (p) => <h1 className={fs.h1} {...p} />,
            h2: (p) => <h2 className={fs.h2} {...p} />,
            h3: (p) => <h3 className={fs.h3} {...p} />,
            h4: (p) => <h4 className={fs.h4} {...p} />,
            h5: (p) => <h5 className={fs.h5} {...p} />,
            h6: (p) => <h6 className={fs.h6} {...p} />,
            p: ({ children, ...p }) => {
              const txt = String(children).trim();
              if (!txt) return null;
              return <p className={fs.p} {...p}>{children}</p>;
            },
            ul: (p) => <ul className="list-disc list-outside space-y-2 mb-4 text-gray-200 ml-6 pl-2" {...p} />,
            ol: (p) => <ol className="list-decimal list-outside space-y-2 mb-4 text-gray-200 ml-6 pl-2" {...p} />,
            li: (p) => <li className={fs.li} {...p} />,
            code: CodeBlock,
            blockquote: (p) => <blockquote className="border-l-4 border-blue-500 bg-blue-900/20 pl-4 py-2 my-4 italic text-gray-300" {...p} />,
            a: (p) => <a className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" {...p} />,
            table: (p) => <div className="overflow-x-auto my-4"><table className="min-w-full border border-gray-700 rounded-lg overflow-hidden" {...p} /></div>,
            thead: (p) => <thead className="bg-gray-800" {...p} />,
            tbody: (p) => <tbody className="divide-y divide-gray-700" {...p} />,
            tr: (p) => <tr className="hover:bg-gray-800/50" {...p} />,
            th: (p) => <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200 border-b border-gray-700" {...p} />,
            td: (p) => <td className="px-4 py-3 text-sm text-gray-300" {...p} />,
            img: ({ src, alt, ...p }) => {
              const parsed = parseImageDimensions(src || "");
              return <img className="rounded-lg my-4 shadow-lg" src={parsed.src} alt={alt || ""} width={parsed.width} height={parsed.height}
                style={parsed.width ? { maxWidth: `${parsed.width}px`, height: "auto" } : { maxWidth: "100%", height: "auto" }} {...p} />;
            },
            strong: (p) => <strong className="font-bold text-white" {...p} />,
            em: (p) => <em className="italic text-gray-200" {...p} />,
            hr: (p) => <hr className="my-8 border-gray-700" {...p} />,
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

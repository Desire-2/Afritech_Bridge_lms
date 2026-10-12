"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy } from "lucide-react";
import { languageFromClassName, toPlainText } from "@/lib/markdown";

const LANG_COLORS: Record<string, string> = {
  python: "bg-blue-500",
  javascript: "bg-yellow-500",
  js: "bg-yellow-500",
  typescript: "bg-blue-600",
  ts: "bg-blue-600",
  html: "bg-orange-500",
  css: "bg-blue-400",
  java: "bg-red-500",
  cpp: "bg-purple-500",
  c: "bg-purple-500",
  bash: "bg-green-500",
  sh: "bg-green-500",
  sql: "bg-orange-600",
  json: "bg-yellow-400",
};

export interface CodeBlockProps {
  /** Plain-text source of the code. Preferred over `children` for copying. */
  code?: string;
  /** Language identifier (without the `language-` prefix). */
  language?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Renders a highlighted code block with a copy control, or an inline code
 * chip. The clipboard always receives the original plain text — never the
 * serialized highlight markup.
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  className,
  children,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const derivedLanguage = language || languageFromClassName(className);
  const plainCode =
    typeof code === "string"
      ? code.replace(/\n$/, "")
      : toPlainText(children).replace(/\n$/, "");
  // Prefer highlighted React children for display; `plainCode` is copy-only.
  const displayContent = children !== undefined ? children : code;

  const shouldBeInline =
    !derivedLanguage && !plainCode.includes("\n") && plainCode.length < 80;

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const scheduleReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 2500);
  };

  const handleCopy = async () => {
    // Prefer the rendered DOM text: it is the exact visible source, including
    // indentation, and is immune to React node serialization issues.
    const text = preRef.current?.textContent ?? plainCode;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      scheduleReset();
      return;
    } catch {
      // Fall through to the legacy document.execCommand path.
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (!ok) throw new Error("copy command rejected");
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
    scheduleReset();
  };

  if (!shouldBeInline) {
    const lang = derivedLanguage;
    return (
      <div className="my-6 rounded-xl overflow-hidden border border-gray-700/50 shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-4 py-3 border-b border-gray-700/70 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 min-w-0">
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${LANG_COLORS[lang] || "bg-gray-500"}`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-gray-300 font-mono tracking-wide truncate">
              {lang ? lang.toUpperCase() : "CODE"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 min-w-[44px] px-3 text-xs text-gray-300 hover:text-white hover:bg-gray-700/50 focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={handleCopy}
            type="button"
            aria-label={copied ? "Code copied to clipboard" : "Copy code to clipboard"}
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1.5 text-green-400" aria-hidden="true" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Copy Code
              </>
            )}
          </Button>
        </div>
        <div className="relative">
          <pre
            ref={preRef}
            tabIndex={0}
            className="bg-[#0d1117] p-6 overflow-x-auto text-sm leading-relaxed font-mono focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            <code className={className} {...props}>
              {displayContent}
            </code>
          </pre>
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Code copied to clipboard" : copyFailed ? "Copy failed" : ""}
          </span>
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-gray-900/10"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <code
      className="inline code-inline whitespace-normal break-words bg-gray-800/80 text-blue-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-gray-700/50"
      {...props}
    >
      {displayContent}
    </code>
  );
};

export default CodeBlock;

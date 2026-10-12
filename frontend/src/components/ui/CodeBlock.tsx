"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}> = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeContent = String(children).replace(/\n$/, "");

  const shouldBeInline =
    inline || (!codeContent.includes("\n") && codeContent.length < 60 && !match);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = codeContent;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
      document.body.removeChild(textArea);
    }
  };

  const langColors: Record<string, string> = {
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

  if (!shouldBeInline) {
    const lang = match?.[1] || "";
    return (
      <div className="my-6 rounded-xl overflow-hidden border border-gray-700/50 shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="bg-gradient-to-r from-gray-800 to-gray-750 px-4 py-3 border-b border-gray-700/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div
                className={`h-3 w-3 rounded-full ${langColors[lang] || "bg-gray-500"}`}
              />
              <span className="text-sm font-semibold text-gray-300 font-mono tracking-wide">
                {lang ? lang.toUpperCase() : "CODE"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50"
            onClick={handleCopy}
            type="button"
          >
            {copied ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Code
              </>
            )}
          </Button>
        </div>
        <div className="relative">
          <pre className="bg-[#0d1117] p-6 overflow-x-auto text-sm leading-relaxed font-mono">
            <code className={className} {...props}>{children}</code>
          </pre>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-gray-900/10" />
        </div>
      </div>
    );
  }

  return (
    <code
      className="inline-flex items-center bg-gray-800/80 text-blue-300 px-2.5 py-0.5 rounded-md text-[0.88em] font-mono border border-gray-700/50 shadow-sm hover:bg-gray-700/80 transition-colors"
      {...props}
    >
      {children}
    </code>
  );
};

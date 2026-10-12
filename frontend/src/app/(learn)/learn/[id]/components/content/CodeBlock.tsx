"use client";

// Compatibility shim: the implementation moved to the shared UI layer so both
// the learning player and the global markdown renderer use one code block.
export { CodeBlock, default } from "@/components/ui/CodeBlock";
export type { CodeBlockProps } from "@/components/ui/CodeBlock";

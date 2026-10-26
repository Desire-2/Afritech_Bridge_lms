import React from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";

/**
 * Single source of truth for the lesson/markdown HTML sanitization policy.
 *
 * Every markdown surface that enables raw HTML (rehype-raw) MUST run the
 * plugins exported here in this order:
 *
 *   remarkGfm → remarkMath → remarkVetSingleDollarMath →
 *   rehypeRaw → rehypeSanitize(schema) → rehypeHighlight → rehypeKatex
 *
 * Sanitizing after rehype-raw and before rehype-highlight means untrusted
 * author HTML is reduced to the allowlist before any trusted classes are
 * added, so highlighting can never be used to smuggle markup past the
 * sanitizer. rehype-katex runs last because KaTeX's generated markup is
 * trusted output (KaTeX escapes the author's LaTeX source) and the sanitizer
 * would strip its spans/styles/MathML otherwise. Do not add a second,
 * divergent sanitizer for markdown.
 */

/** Allowed protocols. `data:` is intentionally excluded (XSS vector). */
const DEFAULT_PROTOCOLS = defaultSchema.protocols || {};

export const lessonSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "figure",
    "figcaption",
    "video",
    "audio",
    "track",
  ],
  attributes: {
    ...(defaultSchema.attributes || {}),
    // Global attributes safe on any allowed element.
    "*": [
      ...((defaultSchema.attributes as Record<string, unknown> | undefined)?.[
        "*"
      ] as string[] | undefined) || [],
      "alt",
      "title",
      "aria-label",
      "aria-describedby",
      "aria-hidden",
    ],
    // Keep fence language + highlight token classes only. Arbitrary class
    // names from author HTML are dropped so untrusted content cannot restyle
    // the player shell.
    code: [["className", /^language-[\w+#-]+$/, /^hljs\b/, /^hljs-/]],
    span: [["className", /^hljs\b/, /^hljs-/]],
    a: [
      ...((defaultSchema.attributes as Record<string, unknown>)?.a as string[]) || [],
      "target",
      "rel",
    ],
    img: [
      ...((defaultSchema.attributes as Record<string, unknown>)?.img as string[]) || [],
      "width",
      "height",
      "loading",
    ],
    // GFM task lists.
    input: [["disabled", true], ["type", "checkbox"], "checked"],
    // Captioned media.
    track: ["src", "kind", "srclang", "label", "default"],
    video: ["src", "poster", "controls", "preload", "width", "height"],
    audio: ["src", "controls", "preload"],
    source: ["src", "type"],
  },
  protocols: {
    ...DEFAULT_PROTOCOLS,
    src: [...(DEFAULT_PROTOCOLS.src || ["http", "https"])],
    href: [...(DEFAULT_PROTOCOLS.href || ["http", "https"])],
  },
} as const;

/**
 * react-markdown URL transform. Mirrors the sanitizer's protocol policy and
 * keeps the documented `parseImageDimensions` contract working for ordinary
 * http(s) images. Relative URLs and same-origin paths are preserved.
 */
export function lessonUrlTransform(url: string, key: string): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Allow relative / absolute-path URLs and fragments.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
  const allowed =
    key === "src"
      ? ["http", "https"]
      : ["http", "https", "mailto", "irc", "ircs", "xmpp"];
  return allowed.includes(scheme) ? trimmed : "";
}

/**
 * Minimal mdast node shape used by the dollar-guard walk below.
 * `inlineMath` nodes are produced by remark-math with `value` + `data.hName`
 * (`code.language-math.math-inline`); kept nodes are passed through untouched
 * so remark-rehype applies mdast-util-math's own hast mapping.
 */
type DollarNode = {
  type: string;
  value?: unknown;
  children?: DollarNode[];
};

/**
 * Unmistakable TeX cues: subscripts (`H_0`), superscripts (`mc^2`), control
 * sequences (`\alpha`), groups (`{n \choose k}`) and equations (`E=…`).
 * Deliberately conservative: a span without a cue stays literal `$…$`.
 */
const MATH_CUE_RE = /[_^\\{}=]/;

/**
 * remark-math's single-dollar parsing turns every `$…$` span into inline
 * math, which would mangle dollars that are not TeX: Excel absolute
 * references (`$A$1`, `$A$1:$A$5`), currency (`$5 or $10`). This transform
 * keeps a single-dollar span as math only when it carries a MATH_CUE_RE cue
 * and restores the rest to literal `$…$` text. Rejected spans become plain
 * text nodes after parsing, so they are never re-paired and the original
 * characters reach the DOM untouched. Block `$$…$$` math (a different node
 * type) is unaffected. Content audit: no lesson paragraph mixes an un-cued
 * `$…$` with a cued one, so rejected spans never need re-pairing; cue-free
 * math like `$x$` stays literal — authors can write `$$x$$` for that.
 */
function remarkVetSingleDollarMath() {
  return (tree: DollarNode) => {
    const walk = (node: DollarNode) => {
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type === "inlineMath") {
          const value = typeof child.value === "string" ? child.value : "";
          if (!MATH_CUE_RE.test(value)) {
            children[i] = { type: "text", value: `$${value}$` };
          }
          continue;
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

/**
 * Plugin tuples for react-markdown. Order matters — see file header.
 * Declared as `any[]` (not `as const`) because react-markdown's own
 * `PluggableList` type does not accept readonly heterogeneous tuples; the
 * order and composition are asserted by tests/markdown-sanitization.test.ts
 * and tests/markdown-math.test.ts.
 */
export const lessonRemarkPlugins: any[] = [
  remarkGfm,
  // Single-dollar spans are parsed, then vetted below so non-TeX dollars
  // (Excel refs, currency) stay literal while `$$…$$` blocks always render.
  [remarkMath, { singleDollarTextMath: true }] as any,
  remarkVetSingleDollarMath,
];

export const lessonRehypePlugins: any[] = [
  rehypeRaw,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [rehypeSanitize, lessonSanitizeSchema] as any,
  rehypeHighlight,
  rehypeKatex,
];

/** Combined list (remark first, then rehype) for non-react-markdown use. */
export const lessonMarkdownPlugins = [
  ...lessonRemarkPlugins,
  ...lessonRehypePlugins,
];

/**
 * Flatten React children (including rehype-highlight's token <span>s) into
 * the original plain-text source. Used for clipboard copy so highlighted
 * markup never reaches the clipboard.
 */
export function toPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode } | undefined;
    return toPlainText(props?.children);
  }
  return "";
}

/** Extract the language identifier from a `language-xxx` className. */
export function languageFromClassName(className?: string | null): string {
  if (!className) return "";
  return /language-([\w+#-]+)/.exec(className)?.[1] || "";
}

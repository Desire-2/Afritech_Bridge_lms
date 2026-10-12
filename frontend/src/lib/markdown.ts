import React from "react";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";

/**
 * Single source of truth for the lesson/markdown HTML sanitization policy.
 *
 * Every markdown surface that enables raw HTML (rehype-raw) MUST run the
 * plugins exported here in this order:
 *
 *   remarkGfm → rehypeRaw → rehypeSanitize(schema) → rehypeHighlight
 *
 * Sanitizing after rehype-raw and before rehype-highlight means untrusted
 * author HTML is reduced to the allowlist before any trusted classes are
 * added, so highlighting can never be used to smuggle markup past the
 * sanitizer. Do not add a second, divergent sanitizer for markdown.
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
 * Plugin tuples for react-markdown. Order matters — see file header.
 * Declared as `any[]` (not `as const`) because react-markdown's own
 * `PluggableList` type does not accept readonly heterogeneous tuples; the
 * order and composition are asserted by tests/markdown-sanitization.test.ts.
 */
export const lessonRemarkPlugins: any[] = [remarkGfm];

export const lessonRehypePlugins: any[] = [
  rehypeRaw,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [rehypeSanitize, lessonSanitizeSchema] as any,
  rehypeHighlight,
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

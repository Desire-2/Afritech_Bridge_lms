"use client";

import React from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { languageFromClassName, toPlainText } from "@/lib/markdown";

/**
 * Shared react-markdown v10 component overrides for code rendering.
 *
 * react-markdown v10 no longer passes an `inline` prop. Block code is
 * detected structurally: fenced blocks arrive as `<pre><code class="language-x">`,
 * inline code arrives as a bare `<code>` without a language class. Overriding
 * `pre` lets us unwrap the nested `code` element exactly once, which also
 * prevents the invalid `<pre><div>` nesting produced by rendering a block
 * component inside the intrinsic `pre`.
 */

type MarkdownComponentProps = {
  className?: string;
  children?: React.ReactNode;
  node?: unknown;
};

export const MarkdownPre: React.FC<MarkdownComponentProps> = ({
  children,
  className,
  node: _node,
  ...rest
}) => {
  const childArray = React.Children.toArray(children);
  const codeElement = childArray.find((child): child is React.ReactElement =>
    React.isValidElement(child)
  );

  if (codeElement) {
    const props = codeElement.props as {
      className?: string;
      children?: React.ReactNode;
    };
    const language = languageFromClassName(props.className || className);
    const plainText = toPlainText(props.children);
    // Display the original (highlighted) children; copy uses the flattened
    // plain text so the clipboard never receives highlight markup.
    return (
      <CodeBlock
        code={plainText}
        language={language}
        className={props.className || className}
      >
        {props.children}
      </CodeBlock>
    );
  }

  return (
    <pre
      className="my-6 rounded-xl overflow-x-auto border border-gray-700/50 bg-[#0d1117] p-6 text-sm leading-relaxed font-mono"
      {...rest}
    >
      {children}
    </pre>
  );
};

export const MarkdownCode: React.FC<MarkdownComponentProps> = ({
  className,
  children,
  node: _node,
  ...rest
}) => {
  const language = languageFromClassName(className);
  if (language) {
    // A fenced block that somehow escaped its `pre` wrapper.
    return (
      <CodeBlock code={toPlainText(children)} language={language} className={className}>
        {children}
      </CodeBlock>
    );
  }
  return (
    <code
      className={
        "inline whitespace-normal break-words rounded border border-gray-700/50 " +
        "bg-gray-800/80 px-1.5 py-0.5 font-mono text-[0.9em] text-blue-300"
      }
      {...rest}
    >
      {children}
    </code>
  );
};

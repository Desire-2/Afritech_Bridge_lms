"use client";

import React, { useRef, useEffect, useState } from 'react';

interface EnhancedMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  showPreview?: boolean;
  splitView?: boolean;
  onTogglePreview?: () => void;
  onToggleSplitView?: () => void;
}

export const EnhancedMarkdownEditor: React.FC<EnhancedMarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter your content here...',
  rows = 8,
  showPreview = false,
  splitView = false,
  onTogglePreview,
  onToggleSplitView
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Helper function to convert selected text into markdown table
  const convertToMarkdownTable = (text: string): string => {
    // Split text into lines
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      // Return default template if no lines
      return `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |`;
    }
    
    // Detect delimiter (comma, tab, or pipe)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    } else if (firstLine.includes(',')) {
      delimiter = ',';
    } else {
      // Single column - split by whitespace (2+ spaces)
      delimiter = /\s{2,}/;
    }
    
    // Parse all rows
    const rows = lines.map(line => {
      if (delimiter instanceof RegExp) {
        return line.split(delimiter).map(cell => cell.trim());
      }
      return line.split(delimiter).map(cell => cell.trim());
    });
    
    // Find max columns
    const maxCols = Math.max(...rows.map(row => row.length));
    
    // Ensure all rows have same column count
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });
    
    // Build markdown table
    const headerRow = normalizedRows[0];
    const dataRows = normalizedRows.slice(1);
    
    // Create header line
    const headerLine = '| ' + headerRow.join(' | ') + ' |';
    
    // Create separator line (with proper width for each column)
    const separatorCells = headerRow.map(header => {
      const minWidth = Math.max(header.length, 3);
      return '-'.repeat(minWidth);
    });
    const separatorLine = '|' + separatorCells.map(sep => sep.padEnd(sep.length + 2, '-')).join('|') + '|';
    
    // Create data lines
    const dataLines = dataRows.length > 0 
      ? dataRows.map(row => '| ' + row.join(' | ') + ' |')
      : ['| ' + headerRow.map(() => '').join(' | ') + ' |']; // At least one empty data row
    
    return [headerLine, separatorLine, ...dataLines].join('\n');
  };

  // Handle indentation for lists
  const handleIndentation = (outdent: boolean = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = localValue.split('\n');
    
    let currentPos = 0;
    let startLine = 0;
    let endLine = 0;
    
    // Find which lines are selected
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline
      if (currentPos <= start && start < currentPos + lineLength) {
        startLine = i;
      }
      if (currentPos <= end && end <= currentPos + lineLength) {
        endLine = i;
        break;
      }
      currentPos += lineLength;
    }
    
    // Apply indentation to selected lines
    for (let i = startLine; i <= endLine; i++) {
      if (outdent) {
        // Remove leading spaces or tab
        lines[i] = lines[i].replace(/^(\s{2}|\t)/, '');
      } else {
        // Add indentation
        lines[i] = '  ' + lines[i];
      }
    }
    
    const newContent = lines.join('\n');
    setLocalValue(newContent);
    onChange(newContent);
    
    // Restore selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    }, 0);
  };

  // Insert markdown syntax
  const insertMarkdown = (syntax: string, placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localValue.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    // Check if multi-line selection
    const isMultiLine = selectedText.includes('\n');
    const multiLineSyntaxes = ['ul', 'ol', 'h1', 'h2', 'h3', 'quote', 'task'];
    
    // Handle multi-line formatting
    if (isMultiLine && multiLineSyntaxes.includes(syntax)) {
      const lines = selectedText.split('\n');
      const formattedLines = lines.map((line, index) => {
        if (!line.trim()) return line;
        switch(syntax) {
          case 'ul': return `- ${line}`;
          case 'ol': return `${index + 1}. ${line}`;
          case 'h1': return `# ${line}`;
          case 'h2': return `## ${line}`;
          case 'h3': return `### ${line}`;
          case 'quote': return `> ${line}`;
          case 'task': return `- [ ] ${line}`;
          default: return line;
        }
      });
      
      const newText = formattedLines.join('\n');
      const newContent = 
        localValue.substring(0, start) +
        newText +
        localValue.substring(end);
      
      setLocalValue(newContent);
      onChange(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + newText.length);
      }, 0);
      
      return;
    }

    let newText = '';
    let cursorOffset = 0;

    // Handle different markdown syntaxes
    switch (syntax) {
      case 'bold':
        newText = `**${textToInsert}**`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'italic':
        newText = `*${textToInsert}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'code':
        newText = `\`${textToInsert}\``;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'codeblock':
        newText = `\`\`\`\n${textToInsert}\n\`\`\``;
        cursorOffset = selectedText ? newText.length : 4;
        break;
      case 'h1':
        newText = `# ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'h2':
        newText = `## ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 3;
        break;
      case 'h3':
        newText = `### ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 4;
        break;
      case 'ul':
        newText = `- ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'ol':
        newText = `1. ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 3;
        break;
      case 'quote':
        newText = `> ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'link':
        newText = `[${textToInsert || 'Link Text'}](https://example.com)`;
        cursorOffset = selectedText ? textToInsert.length + 3 : 10;
        break;
      case 'image':
        newText = `![${textToInsert || 'Alt Text'}](https://example.com/image.jpg)`;
        cursorOffset = selectedText ? textToInsert.length + 4 : 10;
        break;
      case 'table':
        // Smart table generation from selected text
        if (selectedText) {
          newText = convertToMarkdownTable(selectedText);
        } else {
          // Default 3x3 table template
          newText = `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |`;
        }
        cursorOffset = newText.length;
        break;
      case 'hr':
        newText = '\n---\n';
        cursorOffset = newText.length;
        break;
      case 'strikethrough':
        newText = `~~${textToInsert}~~`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'highlight':
        newText = `==${textToInsert}==`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'task':
        newText = `- [ ] ${textToInsert}`;
        cursorOffset = selectedText ? newText.length : 6;
        break;
      case 'superscript':
        newText = `<sup>${textToInsert}</sup>`;
        cursorOffset = selectedText ? newText.length : 5;
        break;
      case 'subscript':
        newText = `<sub>${textToInsert}</sub>`;
        cursorOffset = selectedText ? newText.length : 5;
        break;
      case 'kbd':
        newText = `<kbd>${textToInsert}</kbd>`;
        cursorOffset = selectedText ? newText.length : 5;
        break;
      case 'callout-note':
        newText = `> [!NOTE]\n> ${textToInsert || 'Your note here'}`;
        cursorOffset = newText.length;
        break;
      case 'callout-tip':
        newText = `> [!TIP]\n> ${textToInsert || 'Your tip here'}`;
        cursorOffset = newText.length;
        break;
      case 'callout-warning':
        newText = `> [!WARNING]\n> ${textToInsert || 'Your warning here'}`;
        cursorOffset = newText.length;
        break;
      case 'callout-important':
        newText = `> [!IMPORTANT]\n> ${textToInsert || 'Important information'}`;
        cursorOffset = newText.length;
        break;
      case 'details':
        newText = `<details>\n<summary>${textToInsert || 'Click to expand'}</summary>\n\nContent here...\n</details>`;
        cursorOffset = newText.length - 11;
        break;
      default:
        return;
    }

    const newContent = 
      localValue.substring(0, start) +
      newText +
      localValue.substring(end);

    setLocalValue(newContent);
    onChange(newContent);

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + cursorOffset;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if textarea is focused
      if (document.activeElement !== textareaRef.current) return;
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (!modifier) return;
      
      // Define keyboard shortcuts
      const shortcuts: Record<string, { handler: () => void; preventDefault?: boolean }> = {
        'b': { handler: () => insertMarkdown('bold'), preventDefault: true },
        'i': { handler: () => insertMarkdown('italic'), preventDefault: true },
        'k': { handler: () => insertMarkdown('link'), preventDefault: true },
        'e': { handler: () => insertMarkdown('code'), preventDefault: true },
        '1': { handler: () => insertMarkdown('h1'), preventDefault: true },
        '2': { handler: () => insertMarkdown('h2'), preventDefault: true },
        '3': { handler: () => insertMarkdown('h3'), preventDefault: true },
        '/': { handler: () => insertMarkdown('quote'), preventDefault: true },
      };
      
      // Handle Shift combinations
      if (e.shiftKey) {
        if (e.key === 'C') {
          e.preventDefault();
          insertMarkdown('codeblock');
          return;
        } else if (e.key === '8' || e.key === '*') {
          e.preventDefault();
          insertMarkdown('ul');
          return;
        } else if (e.key === '7' || e.key === '&') {
          e.preventDefault();
          insertMarkdown('ol');
          return;
        }
      }
      
      // Handle Tab for indentation in lists
      if (e.key === 'Tab' && !modifier) {
        e.preventDefault();
        handleIndentation(e.shiftKey);
        return;
      }
      
      const shortcut = shortcuts[e.key.toLowerCase()];
      if (shortcut) {
        if (shortcut.preventDefault) {
          e.preventDefault();
        }
        shortcut.handler();
      }
    };
    
    const textarea = textareaRef.current;
    textarea?.addEventListener('keydown', handleKeyDown as any);
    
    return () => textarea?.removeEventListener('keydown', handleKeyDown as any);
  }, [localValue]);

  // Simple markdown to HTML preview
  const renderMarkdownPreview = (markdown: string) => {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    
    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del class="line-through">$1</del>');
    
    // Highlight
    html = html.replace(/==(.*?)==/g, '<mark class="bg-yellow-200 dark:bg-yellow-700">$1</mark>');
    
    // Code inline
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-2" />');
    
    // Unordered lists
    html = html.replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside my-2">$1</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>');
    
    // Blockquote
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-2">$1</blockquote>');
    
    // Horizontal rule
    html = html.replace(/^---$/gim, '<hr class="my-4 border-slate-300 dark:border-slate-600" />');
    
    // Task lists
    html = html.replace(/^\- \[ \] (.*$)/gim, '<li class="ml-4"><input type="checkbox" disabled class="mr-2" />$1</li>');
    html = html.replace(/^\- \[x\] (.*$)/gim, '<li class="ml-4"><input type="checkbox" disabled checked class="mr-2" />$1</li>');
    
    // Callout boxes (GitHub-style)
    html = html.replace(/^> \[!NOTE\]\n> (.*$)/gim, '<div class="callout callout-note bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 my-4 rounded-r"><div class="callout-title font-semibold text-blue-800 dark:text-blue-300 mb-2">📝 Note</div><div class="callout-content text-blue-700 dark:text-blue-200">$1</div></div>');
    html = html.replace(/^> \[!TIP\]\n> (.*$)/gim, '<div class="callout callout-tip bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 my-4 rounded-r"><div class="callout-title font-semibold text-green-800 dark:text-green-300 mb-2">💡 Tip</div><div class="callout-content text-green-700 dark:text-green-200">$1</div></div>');
    html = html.replace(/^> \[!IMPORTANT\]\n> (.*$)/gim, '<div class="callout callout-important bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 my-4 rounded-r"><div class="callout-title font-semibold text-purple-800 dark:text-purple-300 mb-2">⚡ Important</div><div class="callout-content text-purple-700 dark:text-purple-200">$1</div></div>');
    html = html.replace(/^> \[!WARNING\]\n> (.*$)/gim, '<div class="callout callout-warning bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 my-4 rounded-r"><div class="callout-title font-semibold text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Warning</div><div class="callout-content text-yellow-700 dark:text-yellow-200">$1</div></div>');
    html = html.replace(/^> \[!CAUTION\]\n> (.*$)/gim, '<div class="callout callout-caution bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 my-4 rounded-r"><div class="callout-title font-semibold text-red-800 dark:text-red-300 mb-2">🚫 Caution</div><div class="callout-content text-red-700 dark:text-red-200">$1</div></div>');
    
    // Superscript and subscript
    html = html.replace(/<sup>(.*?)<\/sup>/g, '<sup class="text-xs align-super">$1</sup>');
    html = html.replace(/<sub>(.*?)<\/sub>/g, '<sub class="text-xs align-sub">$1</sub>');
    
    // Keyboard keys
    html = html.replace(/<kbd>(.*?)<\/kbd>/g, '<kbd class="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-400 rounded-md shadow-sm dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600">$1</kbd>');
    
    // Details/Summary (collapsible)
    html = html.replace(/<details>([\s\S]*?)<\/details>/gi, (match, content) => {
      return `<details class="my-4 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg">${content}</details>`;
    });
    html = html.replace(/<summary>(.*?)<\/summary>/gi, '<summary class="cursor-pointer font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400">$1</summary>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    
    return html;
  };

  // Toolbar Component
  const Toolbar = () => (
    <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600">
      <div className="flex flex-wrap gap-1">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('bold', 'Bold text')} title="Bold (Ctrl+B)" label="B" bold />
          <ToolbarButton onClick={() => insertMarkdown('italic', 'Italic text')} title="Italic (Ctrl+I)" label="I" italic />
          <ToolbarButton onClick={() => insertMarkdown('strikethrough', 'Strikethrough text')} title="Strikethrough" label="S" strikethrough />
          <ToolbarButton onClick={() => insertMarkdown('highlight', 'Highlighted text')} title="Highlight" label="H" highlight />
        </div>

        {/* Headings */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('h1', 'Heading 1')} title="Heading 1 (Ctrl+1)" label="H1" />
          <ToolbarButton onClick={() => insertMarkdown('h2', 'Heading 2')} title="Heading 2 (Ctrl+2)" label="H2" />
          <ToolbarButton onClick={() => insertMarkdown('h3', 'Heading 3')} title="Heading 3 (Ctrl+3)" label="H3" />
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('ul', 'List item')} title="Bullet List (Ctrl+Shift+8)" label="• List" />
          <ToolbarButton onClick={() => insertMarkdown('ol', 'List item')} title="Numbered List (Ctrl+Shift+7)" label="1. List" />
          <ToolbarButton onClick={() => insertMarkdown('task', 'Task item')} title="Task List" label="☑ Task" />
        </div>

        {/* Code */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('code', 'code')} title="Inline Code (Ctrl+E)" label="</>" mono />
          <ToolbarButton onClick={() => insertMarkdown('codeblock', 'code block')} title="Code Block (Ctrl+Shift+C)" label="{ }" mono />
        </div>

        {/* Links & Media */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('link')} title="Insert Link (Ctrl+K)" label="🔗" />
          <ToolbarButton onClick={() => insertMarkdown('image')} title="Insert Image" label="🖼️" />
        </div>

        {/* Callouts & Special */}
        <div className="flex gap-1 border-r border-slate-300 dark:border-slate-600 pr-2">
          <ToolbarButton onClick={() => insertMarkdown('callout-note')} title="Note Callout" label="📝" />
          <ToolbarButton onClick={() => insertMarkdown('callout-tip')} title="Tip Callout" label="💡" />
          <ToolbarButton onClick={() => insertMarkdown('callout-warning')} title="Warning Callout" label="⚠️" />
          <ToolbarButton onClick={() => insertMarkdown('callout-important')} title="Important Callout" label="⚡" />
          <ToolbarButton onClick={() => insertMarkdown('details')} title="Collapsible Section" label="▼" />
          <ToolbarButton onClick={() => insertMarkdown('kbd', 'Ctrl')} title="Keyboard Key" label="⌨️" />
        </div>

        {/* Other */}
        <div className="flex gap-1">
          <ToolbarButton onClick={() => insertMarkdown('quote', 'Quote text')} title="Quote (Ctrl+/)" label="❝" />
          <ToolbarButton onClick={() => insertMarkdown('table')} title="Insert Table" label="⊞" />
          <ToolbarButton onClick={() => insertMarkdown('hr')} title="Horizontal Rule" label="─" />
        </div>
      </div>
      
      {/* Help text */}
      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        💡 Tip: Use Tab/Shift+Tab to indent/outdent selected lines
      </div>
    </div>
  );

  // Toolbar Button Component
  interface ToolbarButtonProps {
    onClick: () => void;
    title: string;
    label: string;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    highlight?: boolean;
    mono?: boolean;
  }

  const ToolbarButton: React.FC<ToolbarButtonProps> = ({ 
    onClick, 
    title, 
    label, 
    bold, 
    italic, 
    strikethrough, 
    highlight, 
    mono 
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors group relative"
      title={title}
    >
      <span 
        className={`text-sm ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${strikethrough ? 'line-through' : ''} ${highlight ? 'bg-yellow-200 dark:bg-yellow-600 px-1' : ''} ${mono ? 'font-mono' : ''}`}
      >
        {label}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {title}
      </span>
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {localValue.length} characters
        </div>
        <div className="flex items-center gap-2">
          {onToggleSplitView && (
            <button
              type="button"
              onClick={onToggleSplitView}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              title="Split View (Edit + Preview)"
            >
              {splitView ? '📄 Single' : '🔀 Split'}
            </button>
          )}
          {onTogglePreview && (
            <button
              type="button"
              onClick={onTogglePreview}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {showPreview ? '✏️ Edit' : '👁️ Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!showPreview && <Toolbar />}

      {/* Editor/Preview */}
      {splitView ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Editor */}
          <div>
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                onChange(e.target.value);
              }}
              rows={rows}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white font-mono text-sm resize-y"
              placeholder={placeholder}
            />
          </div>
          {/* Preview */}
          <div 
            className="w-full min-h-[200px] p-4 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 prose dark:prose-invert max-w-none overflow-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(localValue) }}
          />
        </div>
      ) : showPreview ? (
        <div 
          className="w-full min-h-[200px] p-4 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 prose dark:prose-invert max-w-none overflow-auto"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(localValue) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }}
          rows={rows}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white font-mono text-sm resize-y"
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

export default EnhancedMarkdownEditor;

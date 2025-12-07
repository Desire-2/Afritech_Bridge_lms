# Lesson Creation Markdown Enhancement Analysis

## Current Implementation

### Location
`/frontend/src/components/instructor/course-creation/ModuleManagement.tsx`

### Current Features
1. **Basic Markdown Toolbar**
   - Text formatting: Bold, Italic, Strikethrough, Highlight
   - Headings: H1, H2, H3
   - Lists: Bullet, Numbered, Task
   - Code: Inline, Code blocks
   - Media: Links, Images
   - Others: Quotes, Tables, Horizontal Rules

2. **Preview System**
   - Toggle between Edit/Preview mode
   - Simple regex-based HTML conversion
   - Basic styling with Tailwind classes

3. **Editor**
   - Plain textarea with monospace font
   - Manual cursor positioning
   - No syntax highlighting

### Limitations
1. **No keyboard shortcuts** - Users must click toolbar buttons
2. **Basic preview** - Uses simple regex (can break with complex markdown)
3. **No syntax highlighting** in editor
4. **No multi-line operations** - Can't apply formatting to multiple lines
5. **No undo/redo stack** beyond browser default
6. **No drag-and-drop** for images
7. **No auto-complete** for markdown syntax
8. **No spellcheck** integration
9. **Limited table support** - Only inserts template
10. **No collapsible sections** or advanced markdown features

---

## Enhanced Proposal

### Phase 1: Keyboard Shortcuts & Text Selection Actions ⭐ PRIORITY

#### 1.1 Keyboard Shortcuts
```typescript
// Global shortcuts
Ctrl+B / Cmd+B    → Bold
Ctrl+I / Cmd+I    → Italic
Ctrl+K / Cmd+K    → Insert Link
Ctrl+Shift+C      → Code Block
Ctrl+/            → Comment/Blockquote
Ctrl+1/2/3        → Headings H1/H2/H3
Ctrl+Shift+8      → Bullet List
Ctrl+Shift+7      → Numbered List
Ctrl+Z / Cmd+Z    → Undo
Ctrl+Y / Cmd+Y    → Redo
Tab               → Indent (in lists)
Shift+Tab         → Outdent (in lists)
```

#### 1.2 Enhanced Text Selection Actions
```typescript
// Smart formatting based on selection
- Empty selection → Insert placeholder + format
- Text selected → Wrap with formatting
- Multi-line selection → Apply to each line (for lists/headings)
- Word double-click → Select word and format
- Line selection (triple-click) → Format entire line
```

#### 1.3 Context Menu (Right-Click)
- Format as Bold/Italic/Code
- Insert Link
- Search/Replace
- Copy as Markdown
- Paste as Plain Text

---

### Phase 2: Improved Markdown Rendering

#### 2.1 Use React-Markdown Library
Replace simple regex with proper markdown parser:
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';        // GitHub Flavored Markdown
import rehypeRaw from 'rehype-raw';         // HTML support
import rehypeHighlight from 'rehype-highlight'; // Code syntax highlighting
```

#### 2.2 Enhanced Preview Features
- ✅ Proper GFM support (tables, task lists, strikethrough)
- ✅ Syntax highlighting for code blocks
- ✅ Auto-link detection
- ✅ Emoji support
- ✅ Footnotes
- ✅ Math equations (KaTeX)
- ✅ Mermaid diagrams
- ✅ Callout/Alert boxes

---

### Phase 3: Advanced Editor Features

#### 3.1 Split-Screen Mode
```
[ Editor (50%) | Live Preview (50%) ]
```

#### 3.2 Editor Enhancements
- Line numbers
- Current line highlighting
- Bracket/parenthesis matching
- Auto-closing brackets
- Indent guides
- Minimap (for long content)

#### 3.3 Smart Auto-Complete
```
Type:           Get:
---             Insert horizontal rule
```py           Insert Python code block
```js           Insert JavaScript code block
[]              Insert checkbox [ ]
[[              Insert internal link
::              Insert callout/alert
```

#### 3.4 Drag & Drop Support
- Drag image files → Auto-upload + insert markdown
- Drag text files → Insert content
- Reorder list items via drag

---

### Phase 4: Advanced Markdown Extensions

#### 4.1 Callout Boxes (GitHub-style)
```markdown
> [!NOTE]
> Useful information

> [!TIP]
> Helpful advice

> [!IMPORTANT]
> Key information

> [!WARNING]
> Urgent info

> [!CAUTION]
> Negative potential consequences
```

#### 4.2 Collapsible Sections
```markdown
<details>
<summary>Click to expand</summary>

Hidden content here...
</details>
```

#### 4.3 Math Equations (KaTeX)
```markdown
Inline: $E = mc^2$

Block:
$$
\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

#### 4.4 Mermaid Diagrams
````markdown
```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```
````

#### 4.5 Enhanced Tables
- Table editor UI with visual grid
- Column alignment controls
- Add/remove rows/columns
- CSV import
- Sortable columns

---

## Implementation Plan

### Step 1: Keyboard Shortcuts (30 min)
1. Add `useEffect` hook to listen for keyboard events
2. Implement modifier key detection (Ctrl/Cmd)
3. Map shortcuts to existing `insertMarkdown()` functions
4. Add visual hints (tooltips showing shortcuts)

### Step 2: Enhanced Text Selection (45 min)
1. Improve `insertMarkdown()` to handle multi-line selections
2. Add line-based operations (triple-click detection)
3. Implement smart placeholder insertion
4. Add selection memory for undo/redo

### Step 3: React-Markdown Integration (1 hour)
1. Install dependencies:
   ```bash
   npm install react-markdown remark-gfm rehype-raw rehype-highlight
   npm install highlight.js
   ```
2. Replace `renderMarkdownPreview()` with ReactMarkdown component
3. Add syntax highlighting stylesheet
4. Configure plugins (GFM, raw HTML, code highlighting)

### Step 4: Advanced Features (2+ hours)
1. Add callout box parser
2. Integrate KaTeX for math
3. Add Mermaid diagram support
4. Implement split-screen toggle
5. Add drag-and-drop handlers

---

## Code Examples

### Enhanced Keyboard Shortcuts
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    
    if (!modifier) return;
    
    const shortcuts: Record<string, () => void> = {
      'b': () => { e.preventDefault(); insertMarkdown('bold'); },
      'i': () => { e.preventDefault(); insertMarkdown('italic'); },
      'k': () => { e.preventDefault(); insertMarkdown('link'); },
      '1': () => { e.preventDefault(); insertMarkdown('h1'); },
      '2': () => { e.preventDefault(); insertMarkdown('h2'); },
      '3': () => { e.preventDefault(); insertMarkdown('h3'); },
    };
    
    if (e.shiftKey && e.key === 'C') {
      e.preventDefault();
      insertMarkdown('codeblock');
    } else if (shortcuts[e.key.toLowerCase()]) {
      shortcuts[e.key.toLowerCase()]();
    }
  };
  
  const textarea = textareaRef.current;
  textarea?.addEventListener('keydown', handleKeyDown);
  
  return () => textarea?.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Multi-line Selection Support
```typescript
const insertMarkdown = (syntax: string, placeholder: string = '') => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = lessonForm.content_data.substring(start, end);
  
  // Check if multi-line selection
  const isMultiLine = selectedText.includes('\n');
  
  if (isMultiLine && ['ul', 'ol', 'h1', 'h2', 'h3', 'quote'].includes(syntax)) {
    // Apply to each line
    const lines = selectedText.split('\n');
    const formattedLines = lines.map(line => {
      if (!line.trim()) return line;
      switch(syntax) {
        case 'ul': return `- ${line}`;
        case 'ol': return `1. ${line}`;
        case 'h1': return `# ${line}`;
        case 'h2': return `## ${line}`;
        case 'h3': return `### ${line}`;
        case 'quote': return `> ${line}`;
        default: return line;
      }
    });
    
    const newText = formattedLines.join('\n');
    const newContent = 
      lessonForm.content_data.substring(0, start) +
      newText +
      lessonForm.content_data.substring(end);
    
    setLessonForm({ ...lessonForm, content_data: newContent });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + newText.length);
    }, 0);
    
    return;
  }
  
  // Continue with existing single-line logic...
};
```

### React-Markdown Preview
```tsx
{showMarkdownPreview && isTextContent ? (
  <div className="w-full min-h-[200px] p-4 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 prose dark:prose-invert max-w-none overflow-auto">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        // Custom renderers for callouts
        blockquote: ({node, children, ...props}) => {
          const text = String(children);
          if (text.startsWith('[!NOTE]')) {
            return (
              <div className="callout callout-note">
                <div className="callout-title">📝 Note</div>
                <div className="callout-content">{text.replace('[!NOTE]', '')}</div>
              </div>
            );
          }
          return <blockquote {...props}>{children}</blockquote>;
        },
        // Syntax highlighting for code
        code: ({node, inline, className, children, ...props}) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline ? (
            <pre className={className}>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {lessonForm.content_data}
    </ReactMarkdown>
  </div>
) : (
  // ... existing textarea
)}
```

### Toolbar Enhancement with Shortcuts Display
```tsx
<button 
  type="button" 
  onClick={() => insertMarkdown('bold', 'Bold text')} 
  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors group relative" 
  title="Bold"
>
  <span className="font-bold text-sm">B</span>
  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
    Bold (Ctrl+B)
  </span>
</button>
```

---

## Benefits

### For Instructors
1. ✅ **Faster content creation** - Keyboard shortcuts save time
2. ✅ **Professional formatting** - Rich markdown support
3. ✅ **Better preview** - See exactly what students will see
4. ✅ **Reduced errors** - Syntax highlighting catches mistakes
5. ✅ **More engaging content** - Callouts, diagrams, math equations

### For Students
1. ✅ **Better readability** - Proper rendering of complex markdown
2. ✅ **Interactive content** - Collapsible sections, diagrams
3. ✅ **Professional presentation** - GitHub-quality markdown
4. ✅ **Code examples** - Syntax highlighted code blocks
5. ✅ **Math/Science support** - LaTeX equations

---

## Testing Checklist

- [ ] Keyboard shortcuts work (Ctrl/Cmd variants)
- [ ] Multi-line selections format correctly
- [ ] Preview matches final rendering
- [ ] Code blocks have syntax highlighting
- [ ] Tables render properly
- [ ] Task lists are interactive (in preview)
- [ ] Links open in new tab
- [ ] Images load and display
- [ ] Callout boxes show correct icons/colors
- [ ] Math equations render (if implemented)
- [ ] Diagrams render (if implemented)
- [ ] Undo/redo works correctly
- [ ] Mobile-responsive
- [ ] Dark mode compatible
- [ ] Performance with large documents (5000+ lines)

---

## Dependencies Required

```json
{
  "dependencies": {
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "rehype-raw": "^7.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.9.0",
    "katex": "^0.16.9",              // Optional: for math
    "rehype-katex": "^7.0.0",        // Optional: for math
    "remark-math": "^6.0.0",         // Optional: for math
    "mermaid": "^10.6.1",            // Optional: for diagrams
    "rehype-mermaid": "^2.0.0"       // Optional: for diagrams
  }
}
```

---

## Migration Strategy

### Backward Compatibility
- Existing markdown content will work unchanged
- New features are opt-in (e.g., callouts, math)
- Simple regex preview kept as fallback
- Can toggle "Advanced Mode" vs "Simple Mode"

### Rollout Plan
1. **Week 1**: Add keyboard shortcuts + multi-line selection
2. **Week 2**: Integrate React-Markdown for better preview
3. **Week 3**: Add callout boxes + enhanced toolbar
4. **Week 4**: Optional: Math equations + diagrams
5. **Week 5**: User testing + bug fixes
6. **Week 6**: Documentation + instructor training

---

## Future Enhancements (Phase 5+)

1. **Templates** - Pre-built lesson structures
2. **Content Library** - Reusable markdown snippets
3. **AI Assistant** - Auto-format, grammar check, improve readability
4. **Collaborative Editing** - Real-time multi-user editing
5. **Version History** - Track changes over time
6. **Import/Export** - Support Notion, Google Docs, Word
7. **Mobile Editor** - Touch-optimized markdown editor
8. **Voice-to-Markdown** - Dictate content
9. **Accessibility** - Screen reader optimization
10. **Analytics** - Track which formatting students engage with most

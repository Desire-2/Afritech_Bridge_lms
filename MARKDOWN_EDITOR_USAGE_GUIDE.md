# Enhanced Markdown Editor - Usage Guide

## 📝 Overview

The Enhanced Markdown Editor provides a professional, feature-rich text editing experience for creating lesson content in the Afritec Bridge LMS. It includes keyboard shortcuts, advanced formatting options, live preview, and split-view mode.

---

## 🎯 Key Features

### ✅ Completed Features

1. **Keyboard Shortcuts** - Fast formatting with keyboard combinations
2. **Multi-line Selection** - Apply formatting to multiple lines at once
3. **Advanced Markdown Syntax** - Callouts, collapsible sections, keyboard keys
4. **Live Preview** - See formatted content in real-time
5. **Split View Mode** - Edit and preview simultaneously
6. **Enhanced Toolbar** - Visual buttons with tooltips showing shortcuts
7. **Indentation Support** - Tab/Shift+Tab for list indentation
8. **Character Counter** - Track content length
9. **Smart Text Selection** - Intelligent handling of selected vs empty text

---

## ⌨️ Keyboard Shortcuts

### Basic Formatting
| Shortcut | Action | Output |
|----------|--------|--------|
| `Ctrl+B` / `Cmd+B` | Bold | `**text**` |
| `Ctrl+I` / `Cmd+I` | Italic | `*text*` |
| `Ctrl+E` / `Cmd+E` | Inline Code | `` `code` `` |
| `Ctrl+K` / `Cmd+K` | Insert Link | `[text](url)` |
| `Ctrl+/` / `Cmd+/` | Quote | `> text` |

### Headings
| Shortcut | Action | Output |
|----------|--------|--------|
| `Ctrl+1` / `Cmd+1` | Heading 1 | `# text` |
| `Ctrl+2` / `Cmd+2` | Heading 2 | `## text` |
| `Ctrl+3` / `Cmd+3` | Heading 3 | `### text` |

### Lists
| Shortcut | Action | Output |
|----------|--------|--------|
| `Ctrl+Shift+8` / `Cmd+Shift+8` | Bullet List | `- item` |
| `Ctrl+Shift+7` / `Cmd+Shift+7` | Numbered List | `1. item` |
| `Tab` | Indent | Add 2 spaces |
| `Shift+Tab` | Outdent | Remove 2 spaces |

### Code Blocks
| Shortcut | Action | Output |
|----------|--------|--------|
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Code Block | ` ```code``` ` |

---

## 🎨 Toolbar Buttons

### Text Formatting Row
- **B** - Bold text (`**text**`)
- **I** - Italic text (`*text*`)
- **S** - Strikethrough (`~~text~~`)
- **H** - Highlight (`==text==`)

### Headings Row
- **H1** - Large heading
- **H2** - Medium heading
- **H3** - Small heading

### Lists Row
- **• List** - Bullet list
- **1. List** - Numbered list
- **☑ Task** - Checkbox list (`- [ ] task`)

### Code Row
- **</>** - Inline code
- **{ }** - Code block (with syntax highlighting)

### Links & Media Row
- **🔗** - Insert link
- **🖼️** - Insert image

### Callouts & Special Row
- **📝** - Note callout (blue)
- **💡** - Tip callout (green)
- **⚠️** - Warning callout (yellow)
- **⚡** - Important callout (purple)
- **▼** - Collapsible section
- **⌨️** - Keyboard key display

### Other Row
- **"** - Blockquote
- **⊞** - Smart table insertion (converts selected text to table!)
- **─** - Horizontal rule

> 💡 **New Feature**: The table button (⊞) now intelligently converts selected text into markdown tables!
> - Select CSV, TSV, or space-separated data
> - Click the table button
> - Instant formatted table!
> - See `SMART_TABLE_FEATURE_GUIDE.md` for details

---

## 🎭 Advanced Markdown Syntax

### Callout Boxes (GitHub-Style)

#### Note Callout
```markdown
> [!NOTE]
> This is helpful information
```
**Renders as:** Blue box with 📝 icon

#### Tip Callout
```markdown
> [!TIP]
> Pro tip for better results
```
**Renders as:** Green box with 💡 icon

#### Warning Callout
```markdown
> [!WARNING]
> Be careful with this!
```
**Renders as:** Yellow box with ⚠️ icon

#### Important Callout
```markdown
> [!IMPORTANT]
> Critical information here
```
**Renders as:** Purple box with ⚡ icon

#### Caution Callout
```markdown
> [!CAUTION]
> Dangerous action ahead
```
**Renders as:** Red box with 🚫 icon

---

### Collapsible Sections
```html
<details>
<summary>Click to expand</summary>

Hidden content that appears when clicked...

- Can include lists
- **Bold text**
- And other markdown!
</details>
```

---

### Keyboard Keys
```html
Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy
```
**Renders as:** Styled keyboard keys that look like actual keys

---

### Superscript & Subscript
```html
E = mc<sup>2</sup>
H<sub>2</sub>O
```
**Renders as:** E = mc² and H₂O

---

### Task Lists
```markdown
- [ ] Incomplete task
- [x] Completed task
```
**Renders as:** Interactive checkboxes (disabled in preview)

---

### Tables
```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

---

### Code Blocks with Language
````markdown
```python
def hello_world():
    print("Hello, World!")
```

```javascript
const greeting = () => {
  console.log("Hello, World!");
};
```
````

---

## 🔀 View Modes

### Edit Mode (Default)
- Full-width textarea
- Toolbar visible
- Keyboard shortcuts active
- Character counter shown

### Preview Mode
- Toggle with **👁️ Preview** button
- Renders markdown as HTML
- Shows exactly what students will see
- No toolbar (viewing only)

### Split View Mode
- Toggle with **🔀 Split** button
- Editor on left (50%)
- Live preview on right (50%)
- Real-time updates
- Perfect for writing documentation

---

## 💡 Usage Tips

### Multi-line Formatting
1. Select multiple lines of text
2. Press a formatting shortcut (e.g., `Ctrl+Shift+8` for bullet list)
3. Each line gets formatted automatically

**Example:**
```
Line 1
Line 2
Line 3
```
Select all and press `Ctrl+Shift+8` →
```markdown
- Line 1
- Line 2
- Line 3
```

---

### Indenting Lists
1. Place cursor on a list item
2. Press `Tab` to indent (move right)
3. Press `Shift+Tab` to outdent (move left)

**Example:**
```markdown
- Main item
  - Indented item
    - Doubly indented
```

---

### Quick Link Insertion
1. Select text you want to make a link
2. Press `Ctrl+K`
3. Text becomes `[Selected Text](https://example.com)`
4. Replace URL with actual link

---

### Empty vs Selected Text
- **Empty selection**: Inserts placeholder text
  - Bold → `**Bold text**` (with placeholder)
- **Text selected**: Wraps selection
  - Select "hello", press Ctrl+B → `**hello**`

---

## 🎓 Best Practices for Instructors

### 1. Structure Your Content
```markdown
# Lesson Title

## Introduction
Brief overview...

## Key Concepts
Important information...

## Practical Examples
Code or demonstrations...

## Summary
Quick recap...

## Next Steps
What to do next...
```

### 2. Use Callouts for Emphasis
```markdown
> [!TIP]
> Use callouts to highlight important information without overwhelming students

> [!WARNING]
> Point out common mistakes or pitfalls
```

### 3. Add Interactive Elements
```markdown
<details>
<summary>Practice Exercise</summary>

Try to solve this problem before checking the solution...

**Solution:**
...
</details>
```

### 4. Format Code Properly
````markdown
Here's how to use the function:

```python
# Add syntax highlighting for better readability
def calculate_average(numbers):
    return sum(numbers) / len(numbers)
```
````

### 5. Break Up Long Content
- Use headings to create sections
- Add horizontal rules (`---`) between major topics
- Include images or diagrams
- Use bullet points for easier scanning

---

## 🔧 Integration with ModuleManagement

The enhanced editor is already integrated into the ModuleManagement component for lesson creation. It activates automatically when:
- Content Type is "Text" or "Mixed"
- The lesson form is visible
- You're creating or editing a lesson

### Component Location
```
/frontend/src/components/instructor/course-creation/
├── ModuleManagement.tsx          # Main component (updated)
└── EnhancedMarkdownEditor.tsx    # Standalone editor (optional)
```

### Using as Standalone Component
```tsx
import { EnhancedMarkdownEditor } from './EnhancedMarkdownEditor';

<EnhancedMarkdownEditor
  value={content}
  onChange={setContent}
  placeholder="Enter your content..."
  rows={10}
  showPreview={showPreview}
  splitView={splitView}
  onTogglePreview={() => setShowPreview(!showPreview)}
  onToggleSplitView={() => setSplitView(!splitView)}
/>
```

---

## 🐛 Troubleshooting

### Keyboard Shortcuts Not Working
- **Issue**: Shortcuts don't trigger formatting
- **Fix**: Click inside the textarea first to focus it

### Preview Not Updating
- **Issue**: Changes don't appear in preview
- **Fix**: Toggle preview mode off and on again

### Toolbar Buttons Overlapping
- **Issue**: Buttons wrap awkwardly on small screens
- **Fix**: Use responsive design or hide some buttons on mobile

### Multi-line Formatting Not Working
- **Issue**: Only first line gets formatted
- **Fix**: Ensure you select entire lines (not just partial text)

---

## 🚀 Future Enhancements (Phase 2)

### Planned Features
1. **React-Markdown Integration** - Better parsing with `react-markdown`
2. **Syntax Highlighting** - Code blocks with `highlight.js`
3. **Math Equations** - LaTeX support with `KaTeX`
4. **Mermaid Diagrams** - Flowcharts and diagrams
5. **Drag & Drop** - Upload images by dragging
6. **Auto-save** - Prevent content loss
7. **Version History** - Track changes over time
8. **Templates** - Pre-built lesson structures
9. **AI Assistant** - Grammar and style suggestions
10. **Accessibility** - Screen reader optimization

---

## 📚 Resources

### Markdown Guides
- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [Markdown Cheatsheet](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)

### Callout Syntax
- [GitHub Alerts Documentation](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)

### HTML in Markdown
- [Details/Summary](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- [Kbd Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/kbd)

---

## 📞 Support

If you encounter issues or have suggestions for improvement:
1. Check this guide for solutions
2. Contact the development team
3. Submit a feature request
4. Report bugs through the issue tracker

---

## 📝 Version History

### Version 1.0 (Current)
- ✅ Keyboard shortcuts
- ✅ Enhanced toolbar
- ✅ Multi-line formatting
- ✅ Callout boxes
- ✅ Split view mode
- ✅ Live preview
- ✅ Indentation support

### Version 2.0 (Planned)
- ⏳ React-Markdown integration
- ⏳ Syntax highlighting
- ⏳ Math equations
- ⏳ Mermaid diagrams
- ⏳ Drag & drop uploads
- ⏳ Auto-save
- ⏳ Templates

---

**Happy Content Creating! ✨**

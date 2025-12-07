# Markdown Editor - Quick Reference Card 🚀

## ⌨️ Essential Keyboard Shortcuts

| Action | Windows/Linux | Mac | Output |
|--------|---------------|-----|--------|
| **Bold** | `Ctrl+B` | `⌘B` | `**text**` |
| **Italic** | `Ctrl+I` | `⌘I` | `*text*` |
| **Code** | `Ctrl+E` | `⌘E` | `` `code` `` |
| **Link** | `Ctrl+K` | `⌘K` | `[text](url)` |
| **Quote** | `Ctrl+/` | `⌘/` | `> text` |
| **H1** | `Ctrl+1` | `⌘1` | `# text` |
| **H2** | `Ctrl+2` | `⌘2` | `## text` |
| **H3** | `Ctrl+3` | `⌘3` | `### text` |
| **Bullet List** | `Ctrl+Shift+8` | `⌘⇧8` | `- item` |
| **Number List** | `Ctrl+Shift+7` | `⌘⇧7` | `1. item` |
| **Code Block** | `Ctrl+Shift+C` | `⌘⇧C` | ` ```code``` ` |
| **Indent** | `Tab` | `Tab` | Add spaces |
| **Outdent** | `Shift+Tab` | `⇧Tab` | Remove spaces |

---

## 🎨 Markdown Syntax Cheatsheet

### Text Formatting
```markdown
**bold text**
*italic text*
~~strikethrough~~
==highlighted==
`inline code`
```

### Headings
```markdown
# Heading 1 (Largest)
## Heading 2
### Heading 3
```

### Lists
```markdown
- Bullet item
- Another item
  - Nested item

1. Numbered item
2. Another item
   1. Nested number

- [ ] Task to do
- [x] Completed task
```

### Links & Images
```markdown
[Link Text](https://example.com)
![Image Alt Text](https://example.com/image.jpg)
```

### Code Blocks
````markdown
```python
def hello():
    print("Hello, World!")
```
````

### Tables
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```
**💡 Smart Feature**: Select CSV/TSV data and click ⊞ to auto-convert to table!

Example - Select this:
```
Name,Age,City
John,25,NYC
Jane,30,LA
```
Click ⊞ → Instant table! See `SMART_TABLE_FEATURE_GUIDE.md`

### Quotes
```markdown
> This is a blockquote
> It can span multiple lines
```

### Horizontal Line
```markdown
---
```

---

## 💎 Advanced Features

### Callout Boxes
```markdown
> [!NOTE]
> Helpful information

> [!TIP]
> Pro tip

> [!IMPORTANT]
> Critical info

> [!WARNING]
> Be careful

> [!CAUTION]
> Danger ahead
```

### Collapsible Content
```html
<details>
<summary>Click to expand</summary>
Hidden content here...
</details>
```

### Keyboard Keys
```html
Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy
```

### Super/Subscript
```html
x<sup>2</sup> + y<sup>2</sup> = z<sup>2</sup>
H<sub>2</sub>O
```

---

## 🎯 Quick Tips

### ✅ DO
- ✓ Use headings to structure content
- ✓ Add code blocks with language for syntax highlighting
- ✓ Use callouts for important information
- ✓ Break long content into sections
- ✓ Preview before publishing

### ❌ DON'T
- ✗ Overuse bold/italic (makes text hard to read)
- ✗ Skip headings (makes content hard to navigate)
- ✗ Forget to test links and images
- ✗ Use too many callouts (reduces impact)

---

## 🔀 View Modes

| Mode | Button | Use Case |
|------|--------|----------|
| **Edit** | Default | Writing content |
| **Preview** | 👁️ | See final result |
| **Split** | 🔀 | Write + preview simultaneously |

---

## 🚨 Common Issues & Quick Fixes

| Problem | Solution |
|---------|----------|
| Shortcuts not working | Click in the text area to focus |
| Preview not updating | Toggle preview off/on |
| List not indenting | Use Tab/Shift+Tab |
| Code not highlighting | Add language after ` ``` ` (e.g., ` ```python ` ) |
| Callout not showing | Ensure exact syntax: `> [!NOTE]` |

---

## 📋 Content Template

Copy this template for structured lessons:

```markdown
# Lesson Title

## Learning Objectives
After this lesson, you will be able to:
- Objective 1
- Objective 2
- Objective 3

## Introduction
Brief overview of the topic...

> [!NOTE]
> Important context or prerequisite knowledge

## Key Concepts

### Concept 1
Explanation...

```python
# Code example
code here
```

### Concept 2
Explanation...

## Practical Exercise

<details>
<summary>Practice Problem</summary>

Try this yourself before checking the solution...

**Solution:**
Step-by-step solution here...
</details>

## Summary
- Key point 1
- Key point 2
- Key point 3

> [!TIP]
> Pro tip for mastering this topic

## Next Steps
What students should do next...

---

## Additional Resources
- [Resource 1](https://example.com)
- [Resource 2](https://example.com)
```

---

## 📞 Need Help?

- **Full Guide**: See `MARKDOWN_EDITOR_USAGE_GUIDE.md`
- **Analysis Doc**: See `LESSON_MARKDOWN_ENHANCEMENT_ANALYSIS.md`
- **Support**: Contact development team

---

**Print this page and keep it handy while creating lessons! 📄**

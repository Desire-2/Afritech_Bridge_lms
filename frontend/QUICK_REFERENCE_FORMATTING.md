# Quick Reference: Content Formatting

## Code Formatting

### ✅ DO: Use Single Backticks for Keywords

```markdown
Use the `Sub` keyword to create a procedure.
The `Function` keyword returns a value.
Variables are declared with `Dim` in VBA.
```

**Renders as**: Use the `Sub` keyword to create a procedure.

---

### ❌ DON'T: Use Triple Backticks for Single Words

```markdown
Use the ```Sub``` keyword to create a procedure.
```

**Problem**: Renders as a full code block instead of inline text.

---

### ✅ DO: Use Triple Backticks for Code Blocks

````markdown
```python
def calculate_average(numbers):
    return sum(numbers) / len(numbers)
```
````

**Renders as a formatted code block with:**
- Syntax highlighting
- Copy button
- Language badge
- Professional styling

---

## Common Patterns

| Pattern | Use | Example |
|---------|-----|---------|
| \`code\` | Keywords, function names, short snippets | The \`print()\` function |
| \`\`\`language<br>code<br>\`\`\` | Multi-line code examples | See above |
| **text** | Bold emphasis | **Important concept** |
| *text* | Italic emphasis | *Note this detail* |
| [text](url) | Links | [Documentation](https://...) |
| > text | Quotes/callouts | > Remember this! |

---

## Spacing Rules

✅ **Correct**:
```markdown
This is a paragraph.

This is another paragraph.

## This is a heading
```

❌ **Incorrect**:
```markdown
This is a paragraph.
This is another paragraph.
##This is a heading
```

---

## Quick Tips

1. **Always** add space after `#` in headings
2. **Always** separate paragraphs with blank lines
3. **Use** single backticks for inline code
4. **Use** triple backticks for code blocks
5. **Specify** language for code blocks: \`\`\`python
6. **Preview** your content before publishing

---

**Need Help?** See full guidelines: `MARKDOWN_CONTENT_GUIDELINES.md`

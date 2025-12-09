# Code Block Display - Quick Reference Guide

## For Students

### How to Read Code Blocks

When you see a code block in a lesson, you'll notice:

1. **Language Badge** (top-left): Shows the programming language
   - Look for the colored dot next to the language name
   - Example: "● PYTHON" with a blue dot

2. **Copy Button** (top-right): Click to copy the entire code
   - Button changes to "✓ Copied!" when clicked
   - Code is copied to your clipboard
   - Ready to paste into your code editor

3. **Syntax Highlighting**: Different colors for different code parts
   - Keywords: Red (like `def`, `if`, `return`)
   - Strings: Light blue (like `"Hello, World!"`)
   - Functions: Purple (like `print()`, `calculate()`)
   - Comments: Gray and italic (like `# This is a comment`)
   - Numbers: Blue (like `42`, `3.14`)

### How to Copy Code

**Method 1: Use the Copy Button**
1. Find the code block you want
2. Click the "📋 Copy Code" button in the top-right corner
3. Look for the "✓ Copied!" confirmation
4. Paste the code into your editor (Ctrl+V or Cmd+V)

**Method 2: Manual Selection**
1. Click and drag to select the code
2. Right-click and choose "Copy"
3. Or use Ctrl+C (Windows/Linux) or Cmd+C (Mac)

### Understanding Inline Code

When you see code within a sentence, like `print("hello")`, it's styled differently:
- Darker background for contrast
- Blue color for visibility
- Rounded corners for modern look

## For Instructors

### How to Add Code Blocks in Lessons

When creating lesson content with the AI Assistant or manually, use markdown code fences:

**Basic Code Block:**
\`\`\`
Your code here
\`\`\`

**Code Block with Language:**
\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

### Supported Languages

The system automatically detects and styles these languages:

| Language | Markdown Tag | Color Indicator |
|----------|--------------|-----------------|
| Python | \`\`\`python | 🔵 Blue |
| JavaScript | \`\`\`javascript or \`\`\`js | 🟡 Yellow |
| TypeScript | \`\`\`typescript or \`\`\`ts | 🔵 Dark Blue |
| HTML | \`\`\`html | 🟠 Orange |
| CSS | \`\`\`css | 🔵 Light Blue |
| Java | \`\`\`java | 🔴 Red |
| C/C++ | \`\`\`c or \`\`\`cpp | 🟣 Purple |
| Bash/Shell | \`\`\`bash or \`\`\`sh | 🟢 Green |
| SQL | \`\`\`sql | 🟠 Dark Orange |
| JSON | \`\`\`json | 🟡 Yellow |
| Others | Any other tag | ⚪ Gray |

### Best Practices

**DO:**
✅ Always specify the language for code blocks
✅ Use consistent indentation in your code
✅ Add comments to explain complex code
✅ Keep code blocks focused and concise
✅ Test code before adding to lessons

**DON'T:**
❌ Use code blocks for non-code content
❌ Mix multiple languages in one block
❌ Add very long code without explanation
❌ Forget to test code examples
❌ Use inline code for multi-line examples

### Example Code Block

Here's how to create a well-formatted code block:

\`\`\`python
def calculate_average(numbers):
    """
    Calculate the average of a list of numbers.
    
    Args:
        numbers (list): A list of numeric values
        
    Returns:
        float: The average value
    """
    if not numbers:
        return 0
    
    total = sum(numbers)
    count = len(numbers)
    average = total / count
    
    return average

# Example usage
scores = [85, 90, 78, 92, 88]
avg_score = calculate_average(scores)
print(f"Average score: {avg_score:.2f}")
\`\`\`

### Inline Code Examples

Use inline code for:
- Variable names: "The `user_name` variable stores the username"
- Function calls: "Call `get_user()` to retrieve user data"
- Short code snippets: "Use `True` or `False` for boolean values"
- File names: "Edit the `config.py` file"
- Commands: "Run `python main.py` to start"

### Tips for Better Code Display

1. **Add Context**: Explain what the code does before showing it
2. **Break It Down**: For long code, split into smaller chunks
3. **Use Comments**: Add inline comments for clarity
4. **Show Output**: Include expected output or results
5. **Error Examples**: Show common mistakes and fixes

## Language-Specific Examples

### Python
\`\`\`python
# Data structures
my_list = [1, 2, 3]
my_dict = {"key": "value"}

# Functions
def greet(name):
    return f"Hello, {name}!"

# Classes
class Student:
    def __init__(self, name):
        self.name = name
\`\`\`

### JavaScript
\`\`\`javascript
// Variables
const greeting = "Hello";
let count = 0;

// Functions
function add(a, b) {
    return a + b;
}

// Arrow functions
const multiply = (a, b) => a * b;
\`\`\`

### TypeScript
\`\`\`typescript
// Type annotations
let username: string = "John";
let age: number = 25;

// Interface
interface User {
    id: number;
    name: string;
}

// Function with types
function getUser(id: number): User {
    return { id, name: "John" };
}
\`\`\`

### HTML
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Page</title>
</head>
<body>
    <h1>Welcome</h1>
    <p>Hello, World!</p>
</body>
</html>
\`\`\`

### CSS
\`\`\`css
/* Selectors */
.container {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* Responsive design */
@media (max-width: 768px) {
    .container {
        flex-direction: column;
    }
}
\`\`\`

### SQL
\`\`\`sql
-- Select query
SELECT id, name, email
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;

-- Join query
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;
\`\`\`

### Bash
\`\`\`bash
#!/bin/bash

# Variables
NAME="John"
echo "Hello, $NAME"

# Loop
for i in {1..5}; do
    echo "Number: $i"
done

# Conditional
if [ -f "file.txt" ]; then
    echo "File exists"
fi
\`\`\`

## Troubleshooting

### Issue: Code not displaying correctly
**Solution**: Make sure you're using proper markdown code fences (\`\`\`)

### Issue: No syntax highlighting
**Solution**: Add the language tag after the opening fence (\`\`\`python)

### Issue: Copy button not working
**Solution**: Ensure you're using a modern browser with clipboard API support

### Issue: Colors look different
**Solution**: This is normal - colors are optimized for dark theme

## Technical Details

### Syntax Highlighting Engine
- **Library**: highlight.js with rehype-highlight
- **Theme**: atom-one-dark (customized)
- **Render**: Client-side (no server processing)

### Supported Features
✅ 150+ programming languages
✅ Automatic language detection
✅ Copy to clipboard
✅ Responsive design
✅ Keyboard accessible
✅ Screen reader friendly

### Browser Requirements
- Chrome 63+ (recommended)
- Firefox 53+
- Safari 13.1+
- Edge 79+

## Keyboard Shortcuts

While in the learning interface:
- **Tab**: Navigate to copy button
- **Enter/Space**: Click copy button (when focused)
- **Ctrl/Cmd+C**: Copy selected text

## Accessibility

The code block component is designed to be accessible:
- Proper ARIA labels for buttons
- Keyboard navigation support
- High contrast colors for readability
- Screen reader compatible

## FAQ

**Q: Can I change the theme?**
A: Currently, the dark theme is the default. Future updates may include theme options.

**Q: Why do some languages show as "CODE" instead of the language name?**
A: This happens when the language tag is not recognized. Use standard tags like `python`, `javascript`, etc.

**Q: Can I add line numbers?**
A: Line numbers are not currently supported but may be added in future updates.

**Q: How do I report a display issue?**
A: Contact your system administrator or submit a bug report through the platform.

---

**Last Updated**: Current version
**Related Docs**: MARKDOWN_ENHANCEMENT_SUMMARY.md, AI_CONTENT_ASSISTANT.md

# Markdown Content Guidelines for Afritec Bridge LMS

## Overview

This document provides guidelines for creating properly formatted lesson content in the Afritec Bridge LMS. Following these guidelines ensures that your content displays correctly and provides the best learning experience.

## Code Formatting

### Inline Code (Single Words or Short Phrases)

✅ **CORRECT** - Use single backticks for inline code:
```markdown
To create a procedure in VBA, use the `Sub` keyword.
Unlike `Sub` procedures, `Function` procedures return a value.
```

**Result:** To create a procedure in VBA, use the `Sub` keyword.

---

❌ **INCORRECT** - Don't use triple backticks for single words:
```markdown
To create a procedure in VBA, use the ```Sub``` keyword.
Unlike ```Sub``` procedures, ```Function``` procedures return a value.
```

**Problem:** This renders single words as full code blocks with headers, which looks unprofessional.

### Code Blocks (Multi-line Code)

✅ **CORRECT** - Use triple backticks with language specification:
````markdown
```python
def calculate_grade(score):
    if score >= 90:
        return 'A'
    elif score >= 80:
        return 'B'
    else:
        return 'C'
```
````

✅ **CORRECT** - For language-specific syntax highlighting:
````markdown
```javascript
function greetStudent(name) {
    return `Hello, ${name}!`;
}
```
````

**Supported Languages:**
- `python`, `javascript`, `js`, `typescript`, `ts`
- `html`, `css`, `java`, `cpp`, `c`
- `bash`, `sh`, `sql`, `json`

---

❌ **INCORRECT** - Empty or whitespace-only code blocks:
````markdown
```
```
````

**Note:** The system automatically removes empty code blocks.

## Content Structure

### Headings

Use proper heading hierarchy:

```markdown
# Main Lesson Title (H1)

## Section Title (H2)

### Subsection (H3)

#### Topic (H4)

##### Subtopic (H5)

###### Detail (H6)
```

**Best Practices:**
- Always include a space after the `#` symbols
- Use H1 for lesson title only
- Use H2-H4 for main sections
- Maintain logical hierarchy

### Paragraphs

✅ **CORRECT** - Separate paragraphs with blank lines:
```markdown
This is the first paragraph explaining a concept.

This is the second paragraph with more details.

This is the third paragraph with examples.
```

❌ **INCORRECT** - Single line breaks:
```markdown
This is the first paragraph explaining a concept.
This is the second paragraph with more details.
This is the third paragraph with examples.
```

### Lists

✅ **CORRECT** - Unordered lists:
```markdown
Key concepts:
- Variables store data
- Functions perform operations
- Classes define objects
```

✅ **CORRECT** - Ordered lists:
```markdown
Steps to create a function:
1. Define the function name
2. Specify parameters
3. Write the function body
4. Return a value
```

✅ **CORRECT** - Nested lists:
```markdown
- Main topic
  - Subtopic 1
  - Subtopic 2
    - Detail A
    - Detail B
- Another main topic
```

### Emphasis and Formatting

```markdown
**Bold text** for emphasis
*Italic text* for subtle emphasis
***Bold and italic*** for strong emphasis

`inline code` for technical terms
```

### Links

```markdown
[Link text](https://example.com)
[Documentation](https://docs.example.com)
```

### Blockquotes

```markdown
> This is a note or important callout.
> It can span multiple lines.
```

### Horizontal Rules

```markdown
---
```

## Mixed Content Formatting

When creating mixed content lessons, use proper JSON structure:

```json
[
  {
    "type": "heading",
    "level": 2,
    "title": "Introduction to UDF Structure"
  },
  {
    "type": "text",
    "content": "Unlike `Sub` procedures, which are designed to perform a series of actions (e.g., formatting cells, opening files), `Function` procedures are specifically designed to accept input and return a value. This returned value can then be used in other parts of your code or directly in worksheet formulas."
  },
  {
    "type": "video",
    "url": "https://youtube.com/watch?v=example",
    "metadata": {
      "title": "Video Tutorial"
    }
  }
]
```

## Common Issues and Solutions

### Issue 1: Single Words Displayed as Code Blocks

**Problem:**
```markdown
Introduction to UDF Structure

Unlike

```
Sub
```

procedures, which are designed to...
```

**Solution:**
```markdown
Introduction to UDF Structure

Unlike `Sub` procedures, which are designed to perform actions, `Function` procedures are designed to return a value.
```

### Issue 2: Text Running Together

**Problem:**
```markdown
This is the first sentence.
This is the second sentence.
```

**Solution:**
```markdown
This is the first sentence.

This is the second sentence.
```

### Issue 3: Improper Code Block Formatting

**Problem:**
````markdown
```
function example
```
````

**Solution:**
````markdown
```javascript
function example() {
    return "Hello World";
}
```
````

## Automatic Corrections

The system automatically applies these corrections:

1. **Short code blocks → Inline code**: Code blocks with single lines under 60 characters and no language specification are converted to inline code
2. **Empty code blocks**: Removed automatically
3. **Multiple newlines**: Reduced to maximum of 2 consecutive newlines
4. **Heading spacing**: Proper spacing added before headings
5. **Empty paragraphs**: Hidden from display

## Best Practices

1. **Preview your content** before publishing
2. **Use inline code** for keywords, function names, and short snippets
3. **Use code blocks** for multi-line examples
4. **Add language tags** to code blocks for syntax highlighting
5. **Maintain consistent spacing** between sections
6. **Use proper heading hierarchy** for better navigation
7. **Test mixed content** to ensure videos and text display correctly
8. **Break long content** into logical sections

## Examples of Well-Formatted Content

### Example 1: Tutorial Content

````markdown
# Python Functions Tutorial

## Introduction

Functions are reusable blocks of code that perform specific tasks. In Python, you define a function using the `def` keyword.

## Basic Syntax

```python
def function_name(parameters):
    # Function body
    return result
```

## Example

Here's a simple function that calculates the area of a rectangle:

```python
def calculate_area(length, width):
    area = length * width
    return area

# Using the function
result = calculate_area(5, 3)
print(f"Area: {result}")  # Output: Area: 15
```

## Key Points

- Use `def` to define functions
- Parameters are optional
- Use `return` to send back a value
- Functions promote code reusability

## Practice Exercise

Create a function called `celsius_to_fahrenheit()` that converts temperatures.

---

**Next Lesson:** Advanced Function Concepts
````

### Example 2: Concept Explanation

```markdown
# Object-Oriented Programming Basics

## What is OOP?

Object-Oriented Programming (OOP) is a programming paradigm based on the concept of "objects". These objects contain:

- **Data** (attributes/properties)
- **Code** (methods/functions)

## Core Principles

1. **Encapsulation**: Bundling data and methods together
2. **Inheritance**: Creating new classes from existing ones
3. **Polymorphism**: Using a single interface for different types
4. **Abstraction**: Hiding complex implementation details

## Example: Creating a Class

```python
class Student:
    def __init__(self, name, grade):
        self.name = name
        self.grade = grade
    
    def display_info(self):
        print(f"{self.name}: Grade {self.grade}")

# Creating an object
student1 = Student("Alice", "A")
student1.display_info()
```

> **Note**: The `__init__` method is called when a new object is created.

## Summary

OOP helps organize code into logical, reusable components that mirror real-world entities.
```

## Technical Details

### Markdown Processing Pipeline

1. **Input**: Raw markdown content from backend
2. **Sanitization**: Automatic cleanup of formatting issues
3. **Parsing**: React-Markdown with GFM support
4. **Syntax Highlighting**: Highlight.js with VS Code theme
5. **Rendering**: Custom React components for each element

### Supported Features

- ✅ GitHub Flavored Markdown (GFM)
- ✅ Syntax highlighting for 50+ languages
- ✅ Tables
- ✅ Task lists
- ✅ Strikethrough
- ✅ Autolinks
- ✅ Raw HTML (sanitized)
- ✅ Emoji (via Unicode)

## Support

If you encounter formatting issues not covered here, please contact the technical support team with:
- The lesson ID
- Screenshots of the issue
- The original markdown content

---

**Last Updated:** March 2026  
**Version:** 2.0

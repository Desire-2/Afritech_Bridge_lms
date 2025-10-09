#!/usr/bin/env python3
"""
Add Final Advanced Modules to Complete the Web Development Course
JavaScript, Frameworks, and Deployment
"""

import requests
import json
import time

def add_final_modules():
    """Add JavaScript and advanced topics to complete the course"""
    
    base_url = "http://localhost:5001/api/v1"
    course_id = 7
    
    # Login
    login_data = {"identifier": "instructor@afritecbridge.com", "password": "Instructor@123"}
    response = requests.post(f"{base_url}/auth/login", json=login_data)
    token = response.json().get('access_token')
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    # Final comprehensive modules
    final_modules = [
        {
            "title": "Module 5: Advanced CSS & Layout",
            "description": "Master CSS Grid, Flexbox, animations, and responsive design techniques",
            "learning_objectives": "Create complex layouts with CSS Grid and Flexbox, implement animations, build responsive designs",
            "order": 5,
            "lessons": [
                {
                    "title": "CSS Box Model and Positioning",
                    "content_type": "text",
                    "description": "Understanding the CSS box model, margins, padding, and positioning",
                    "duration_minutes": 50,
                    "content_data": """
<h2>CSS Box Model and Positioning</h2>

<h3>The CSS Box Model</h3>
<p>Every HTML element is a rectangular box consisting of four parts:</p>
<ul>
    <li><strong>Content:</strong> The actual content (text, images, etc.)</li>
    <li><strong>Padding:</strong> Space between content and border</li>
    <li><strong>Border:</strong> A line around the padding and content</li>
    <li><strong>Margin:</strong> Space outside the border</li>
</ul>

<h3>Box Model Properties</h3>
<pre><code>/* Width and Height */
.box {
    width: 300px;
    height: 200px;
    max-width: 100%;
    min-height: 150px;
}

/* Padding (inside spacing) */
.padding-example {
    padding: 20px; /* All sides */
    padding: 20px 10px; /* Vertical horizontal */
    padding: 20px 10px 15px 5px; /* Top right bottom left */
}

/* Margin (outside spacing) */
.margin-example {
    margin: 20px auto; /* Top/bottom 20px, left/right auto (centering) */
    margin-top: 10px;
    margin-bottom: 15px;
}

/* Border */
.border-example {
    border: 2px solid #333;
    border-radius: 10px;
    border-top: 3px dashed red;
}</code></pre>

<h3>Box-Sizing Property</h3>
<pre><code>/* Default: content-box - width/height applies to content only */
.content-box {
    box-sizing: content-box;
    width: 300px;
    padding: 20px;
    border: 2px solid #333;
    /* Total width: 300 + 40 + 4 = 344px */
}

/* Recommended: border-box - width/height includes padding and border */
.border-box {
    box-sizing: border-box;
    width: 300px;
    padding: 20px;
    border: 2px solid #333;
    /* Total width: 300px */
}

/* Apply to all elements (common reset) */
* {
    box-sizing: border-box;
}</code></pre>

<h3>CSS Positioning</h3>

<h4>Static Positioning (Default):</h4>
<pre><code>.static {
    position: static; /* Normal document flow */
}</code></pre>

<h4>Relative Positioning:</h4>
<pre><code>.relative {
    position: relative;
    top: 20px;
    left: 30px;
    /* Moves relative to its normal position */
    /* Other elements are not affected */
}</code></pre>

<h4>Absolute Positioning:</h4>
<pre><code>.absolute {
    position: absolute;
    top: 50px;
    right: 20px;
    /* Positioned relative to nearest positioned ancestor */
    /* Removed from normal document flow */
}</code></pre>

<h4>Fixed Positioning:</h4>
<pre><code>.fixed {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    /* Positioned relative to viewport */
    /* Stays in place when scrolling */
}</code></pre>

<h4>Sticky Positioning:</h4>
<pre><code>.sticky {
    position: sticky;
    top: 20px;
    /* Sticks to position when scrolled past */
    /* Hybrid of relative and fixed */
}</code></pre>

<h3>Z-Index and Stacking Context</h3>
<pre><code>.layer-1 {
    position: relative;
    z-index: 1;
}

.layer-2 {
    position: absolute;
    z-index: 10; /* Higher values appear on top */
}

.modal {
    position: fixed;
    z-index: 1000; /* Very high for modals */
}</code></pre>

<h3>Display Property</h3>
<pre><code>/* Block elements - full width, new line */
.block {
    display: block;
}

/* Inline elements - only necessary width, same line */
.inline {
    display: inline;
}

/* Inline-block - inline but can have width/height */
.inline-block {
    display: inline-block;
    width: 100px;
    height: 50px;
}

/* Hide elements */
.hidden {
    display: none; /* Completely removed from layout */
}

.invisible {
    visibility: hidden; /* Hidden but space preserved */
}</code></pre>

<h3>Float and Clear</h3>
<pre><code>/* Float elements */
.float-left {
    float: left;
    width: 50%;
}

.float-right {
    float: right;
    width: 50%;
}

/* Clear floats */
.clear {
    clear: both;
}

/* Clearfix for containing floated children */
.clearfix::after {
    content: "";
    display: table;
    clear: both;
}</code></pre>

<h3>Practical Layout Example</h3>
<pre><code>/* Header */
.header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 60px;
    background: #333;
    z-index: 100;
}

/* Main content with top margin for fixed header */
.main {
    margin-top: 60px;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 20px;
}

/* Sidebar */
.sidebar {
    float: right;
    width: 300px;
    background: #f5f5f5;
    padding: 20px;
}

/* Content area */
.content {
    margin-right: 320px; /* Sidebar width + margin */
    background: white;
    padding: 20px;
}

/* Card component */
.card {
    position: relative;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: #007bff;
}</code></pre>
                    """,
                    "order": 1
                },
                {
                    "title": "Flexbox Layout",
                    "content_type": "text",
                    "description": "Master CSS Flexbox for flexible and responsive layouts",
                    "duration_minutes": 60,
                    "content_data": """
<h2>CSS Flexbox Layout</h2>

<h3>What is Flexbox?</h3>
<p>Flexbox (Flexible Box Layout) is a CSS layout method for arranging items in rows or columns. It provides an efficient way to lay out, distribute, and align items in a container.</p>

<h3>Flex Container (Parent) Properties</h3>

<h4>Creating a Flex Container:</h4>
<pre><code>.flex-container {
    display: flex; /* or inline-flex */
}</code></pre>

<h4>Flex Direction:</h4>
<pre><code>.container {
    display: flex;
    flex-direction: row; /* Default: left to right */
    /* flex-direction: row-reverse; Right to left */
    /* flex-direction: column; Top to bottom */
    /* flex-direction: column-reverse; Bottom to top */
}</code></pre>

<h4>Flex Wrap:</h4>
<pre><code>.container {
    display: flex;
    flex-wrap: nowrap; /* Default: items stay on one line */
    /* flex-wrap: wrap; Items wrap to new lines */
    /* flex-wrap: wrap-reverse; Items wrap in reverse order */
    
    /* Shorthand for direction and wrap */
    flex-flow: row wrap;
}</code></pre>

<h4>Justify Content (Main Axis Alignment):</h4>
<pre><code>.container {
    display: flex;
    justify-content: flex-start; /* Default: start of container */
    /* justify-content: flex-end; End of container */
    /* justify-content: center; Center of container */
    /* justify-content: space-between; Equal space between items */
    /* justify-content: space-around; Equal space around items */
    /* justify-content: space-evenly; Equal space everywhere */
}</code></pre>

<h4>Align Items (Cross Axis Alignment):</h4>
<pre><code>.container {
    display: flex;
    align-items: stretch; /* Default: stretch to fill container */
    /* align-items: flex-start; Start of cross axis */
    /* align-items: flex-end; End of cross axis */
    /* align-items: center; Center of cross axis */
    /* align-items: baseline; Align to text baseline */
}</code></pre>

<h4>Align Content (Multiple Lines):</h4>
<pre><code>.container {
    display: flex;
    flex-wrap: wrap;
    align-content: stretch; /* Default: stretch lines */
    /* align-content: flex-start; Pack lines to start */
    /* align-content: flex-end; Pack lines to end */
    /* align-content: center; Pack lines to center */
    /* align-content: space-between; Equal space between lines */
    /* align-content: space-around; Equal space around lines */
}</code></pre>

<h3>Flex Item (Child) Properties</h3>

<h4>Flex Grow:</h4>
<pre><code>.item {
    flex-grow: 0; /* Default: don't grow */
    /* flex-grow: 1; Grow to fill available space */
    /* flex-grow: 2; Grow twice as much as items with flex-grow: 1 */
}

/* Example: Three column layout */
.sidebar {
    flex-grow: 0; /* Fixed width */
    width: 200px;
}
.main-content {
    flex-grow: 1; /* Takes remaining space */
}
.other-sidebar {
    flex-grow: 0;
    width: 150px;
}</code></pre>

<h4>Flex Shrink:</h4>
<pre><code>.item {
    flex-shrink: 1; /* Default: can shrink */
    /* flex-shrink: 0; Don't shrink */
    /* flex-shrink: 2; Shrink twice as much */
}</code></pre>

<h4>Flex Basis:</h4>
<pre><code>.item {
    flex-basis: auto; /* Default: based on content */
    /* flex-basis: 200px; Start with 200px width */
    /* flex-basis: 25%; Start with 25% width */
    /* flex-basis: 0; Ignore content size */
}</code></pre>

<h4>Flex Shorthand:</h4>
<pre><code>.item {
    /* flex: grow shrink basis */
    flex: 0 1 auto; /* Default values */
    flex: 1; /* flex: 1 1 0 - grow and shrink equally */
    flex: 2; /* flex: 2 1 0 - grow twice as much */
    flex: 0 0 200px; /* Fixed 200px width */
    flex: 1 0 0; /* Grow but don't shrink */
}</code></pre>

<h4>Align Self:</h4>
<pre><code>.special-item {
    align-self: flex-end; /* Override container's align-items */
    /* align-self: center; */
    /* align-self: stretch; */
}</code></pre>

<h4>Order:</h4>
<pre><code>.item-1 { order: 2; }
.item-2 { order: 1; } /* Appears first */
.item-3 { order: 3; }</code></pre>

<h3>Common Flexbox Patterns</h3>

<h4>Navigation Bar:</h4>
<pre><code>.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    background: #333;
    color: white;
}

.nav-brand {
    font-size: 1.5em;
    font-weight: bold;
}

.nav-links {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
}

.nav-links li {
    margin-left: 20px;
}</code></pre>

<h4>Card Layout:</h4>
<pre><code>.card-container {
    display: flex;
    flex-wrap: wrap;
    gap: 20px; /* Modern browsers */
    margin: -10px; /* Fallback for older browsers */
}

.card {
    flex: 1 1 300px; /* Grow, shrink, minimum 300px */
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    margin: 10px; /* Fallback for gap */
}

/* Three column layout */
.card {
    flex: 1 1 calc(33.333% - 20px);
}</code></pre>

<h4>Centering Content:</h4>
<pre><code>/* Perfect centering */
.center-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}

/* Vertical center with horizontal spread */
.spread-center {
    display: flex;
    justify-content: space-between;
    align-items: center;
}</code></pre>

<h4>Media Object Pattern:</h4>
<pre><code>.media {
    display: flex;
    align-items: flex-start;
    margin-bottom: 20px;
}

.media-object {
    flex: 0 0 auto; /* Don't grow or shrink */
    margin-right: 15px;
}

.media-content {
    flex: 1; /* Take remaining space */
}

.media-content h3 {
    margin-top: 0;
}</code></pre>

<h4>Sticky Footer:</h4>
<pre><code>body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    margin: 0;
}

.header {
    flex: 0 0 auto; /* Fixed height */
}

.main {
    flex: 1 0 auto; /* Grow to fill space */
}

.footer {
    flex: 0 0 auto; /* Fixed height */
}</code></pre>

<h3>Responsive Flexbox</h3>
<pre><code>/* Mobile first approach */
.container {
    display: flex;
    flex-direction: column;
}

.item {
    flex: 1 1 100%; /* Full width on mobile */
}

/* Tablet and up */
@media (min-width: 768px) {
    .container {
        flex-direction: row;
        flex-wrap: wrap;
    }
    
    .item {
        flex: 1 1 50%; /* Two columns */
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .item {
        flex: 1 1 33.333%; /* Three columns */
    }
}</code></pre>

<h3>Flexbox vs Grid</h3>
<ul>
    <li><strong>Use Flexbox for:</strong> One-dimensional layouts (row OR column), component layout, alignment</li>
    <li><strong>Use Grid for:</strong> Two-dimensional layouts (rows AND columns), page layout, complex grids</li>
</ul>

<h3>Practice Exercise</h3>
<p>Create a responsive layout with:</p>
<ul>
    <li>Header with logo and navigation</li>
    <li>Main content area with sidebar</li>
    <li>Card grid that adapts to screen size</li>
    <li>Footer that sticks to bottom</li>
</ul>
                    """,
                    "order": 2
                }
            ]
        },
        {
            "title": "Module 6: JavaScript Fundamentals",
            "description": "Learn JavaScript programming language, DOM manipulation, and event handling",
            "learning_objectives": "Understand JavaScript syntax, manipulate DOM elements, handle events, work with APIs",
            "order": 6,
            "lessons": [
                {
                    "title": "JavaScript Basics and Syntax",
                    "content_type": "text",
                    "description": "Introduction to JavaScript programming language fundamentals",
                    "duration_minutes": 60,
                    "content_data": """
<h2>JavaScript Basics and Syntax</h2>

<h3>What is JavaScript?</h3>
<p>JavaScript is a high-level, interpreted programming language that enables dynamic and interactive web content. It's the programming language of the web, running in browsers and servers (Node.js).</p>

<h3>Adding JavaScript to HTML</h3>

<h4>1. Inline JavaScript:</h4>
<pre><code>&lt;button onclick="alert('Hello World!')"&gt;Click me&lt;/button&gt;</code></pre>

<h4>2. Internal JavaScript:</h4>
<pre><code>&lt;script&gt;
    console.log('Hello World!');
    document.getElementById('demo').innerHTML = 'Hello JavaScript!';
&lt;/script&gt;</code></pre>

<h4>3. External JavaScript (Recommended):</h4>
<pre><code>&lt;script src="script.js"&gt;&lt;/script&gt;</code></pre>

<h3>Variables and Data Types</h3>

<h4>Variable Declarations:</h4>
<pre><code>// Modern way (ES6+) - use let and const
let name = 'John';        // Can be reassigned
const age = 25;           // Cannot be reassigned
var city = 'New York';    // Old way, avoid in modern code

// Multiple declarations
let firstName = 'John', lastName = 'Doe', email = 'john@example.com';</code></pre>

<h4>Primitive Data Types:</h4>
<pre><code>// String
let message = 'Hello World';
let template = `Hello ${name}!`; // Template literal

// Number
let integer = 42;
let decimal = 3.14;
let negative = -10;

// Boolean
let isActive = true;
let isComplete = false;

// Undefined
let undefinedVar; // undefined

// Null
let emptyValue = null;

// Symbol (ES6)
let uniqueId = Symbol('id');

// BigInt (for large integers)
let bigNumber = 1234567890123456789012345678901234567890n;</code></pre>

<h4>Non-Primitive Data Types:</h4>
<pre><code>// Object
let person = {
    name: 'John',
    age: 30,
    city: 'New York'
};

// Array
let colors = ['red', 'green', 'blue'];
let numbers = [1, 2, 3, 4, 5];
let mixed = ['text', 42, true, null];

// Function
function greet(name) {
    return `Hello, ${name}!`;
}</code></pre>

<h3>Operators</h3>

<h4>Arithmetic Operators:</h4>
<pre><code>let a = 10;
let b = 3;

console.log(a + b);  // Addition: 13
console.log(a - b);  // Subtraction: 7
console.log(a * b);  // Multiplication: 30
console.log(a / b);  // Division: 3.333...
console.log(a % b);  // Modulus (remainder): 1
console.log(a ** b); // Exponentiation: 1000

// Increment and Decrement
let count = 5;
count++; // count = 6 (post-increment)
++count; // count = 7 (pre-increment)
count--; // count = 6 (post-decrement)
--count; // count = 5 (pre-decrement)</code></pre>

<h4>Assignment Operators:</h4>
<pre><code>let x = 10;
x += 5;  // x = x + 5 = 15
x -= 3;  // x = x - 3 = 12
x *= 2;  // x = x * 2 = 24
x /= 4;  // x = x / 4 = 6
x %= 4;  // x = x % 4 = 2</code></pre>

<h4>Comparison Operators:</h4>
<pre><code>let a = 5;
let b = '5';

console.log(a == b);   // true (loose equality)
console.log(a === b);  // false (strict equality)
console.log(a != b);   // false (loose inequality)
console.log(a !== b);  // true (strict inequality)
console.log(a > 3);    // true
console.log(a < 10);   // true
console.log(a >= 5);   // true
console.log(a <= 4);   // false</code></pre>

<h4>Logical Operators:</h4>
<pre><code>let isAdult = true;
let hasLicense = false;

console.log(isAdult && hasLicense); // AND: false
console.log(isAdult || hasLicense); // OR: true
console.log(!isAdult);              // NOT: false

// Short-circuit evaluation
let result = isAdult && 'Can vote';  // 'Can vote' if isAdult is true
let fallback = name || 'Anonymous';  // 'Anonymous' if name is falsy</code></pre>

<h3>Control Structures</h3>

<h4>Conditional Statements:</h4>
<pre><code>// if...else
let age = 18;

if (age >= 18) {
    console.log('You are an adult');
} else if (age >= 13) {
    console.log('You are a teenager');
} else {
    console.log('You are a child');
}

// Ternary operator
let status = age >= 18 ? 'adult' : 'minor';

// Switch statement
let day = 'Monday';

switch (day) {
    case 'Monday':
        console.log('Start of work week');
        break;
    case 'Friday':
        console.log('TGIF!');
        break;
    case 'Saturday':
    case 'Sunday':
        console.log('Weekend!');
        break;
    default:
        console.log('Regular day');
}</code></pre>

<h4>Loops:</h4>
<pre><code>// for loop
for (let i = 0; i < 5; i++) {
    console.log(`Count: ${i}`);
}

// while loop
let count = 0;
while (count < 3) {
    console.log(`While count: ${count}`);
    count++;
}

// do...while loop
let num = 0;
do {
    console.log(`Do-while: ${num}`);
    num++;
} while (num < 2);

// for...in (objects)
let person = {name: 'John', age: 30, city: 'NYC'};
for (let key in person) {
    console.log(`${key}: ${person[key]}`);
}

// for...of (arrays and iterables)
let colors = ['red', 'green', 'blue'];
for (let color of colors) {
    console.log(color);
}</code></pre>

<h3>Functions</h3>

<h4>Function Declaration:</h4>
<pre><code>function greet(name) {
    return `Hello, ${name}!`;
}

// Function with default parameters
function introduce(name, age = 25) {
    return `My name is ${name} and I'm ${age} years old.`;
}

// Function with rest parameters
function sum(...numbers) {
    return numbers.reduce((total, num) => total + num, 0);
}</code></pre>

<h4>Function Expression:</h4>
<pre><code>const multiply = function(a, b) {
    return a * b;
};

// Arrow function (ES6)
const add = (a, b) => a + b;

// Arrow function with block body
const calculate = (operation, a, b) => {
    if (operation === 'add') {
        return a + b;
    } else if (operation === 'multiply') {
        return a * b;
    }
    return 0;
};</code></pre>

<h3>Scope and Hoisting</h3>
<pre><code>// Global scope
let globalVar = 'I am global';

function outerFunction() {
    // Function scope
    let outerVar = 'I am outer';
    
    function innerFunction() {
        // Inner function scope
        let innerVar = 'I am inner';
        console.log(globalVar); // Accessible
        console.log(outerVar);  // Accessible
        console.log(innerVar);  // Accessible
    }
    
    innerFunction();
    // console.log(innerVar); // Error: not accessible
}

// Block scope (let and const)
if (true) {
    let blockVar = 'I am block scoped';
    var functionVar = 'I am function scoped';
}

// console.log(blockVar);    // Error: not accessible
console.log(functionVar);    // Accessible (hoisted)</code></pre>

<h3>Error Handling</h3>
<pre><code>try {
    let result = riskyOperation();
    console.log(result);
} catch (error) {
    console.error('An error occurred:', error.message);
} finally {
    console.log('This always runs');
}

// Throwing custom errors
function divide(a, b) {
    if (b === 0) {
        throw new Error('Division by zero is not allowed');
    }
    return a / b;
}</code></pre>

<h3>Modern JavaScript Features (ES6+)</h3>

<h4>Destructuring:</h4>
<pre><code>// Array destructuring
let [first, second, third] = ['red', 'green', 'blue'];

// Object destructuring
let person = {name: 'John', age: 30, city: 'NYC'};
let {name, age, city} = person;

// With default values
let {country = 'USA'} = person;</code></pre>

<h4>Template Literals:</h4>
<pre><code>let name = 'John';
let age = 30;

// Multi-line strings with variables
let message = `
    Hello, my name is ${name}.
    I am ${age} years old.
    Next year I'll be ${age + 1}.
`;</code></pre>

<h3>Practice Exercise</h3>
<p>Create a simple calculator that:</p>
<ul>
    <li>Takes two numbers and an operation</li>
    <li>Performs the calculation using functions</li>
    <li>Handles errors for invalid operations</li>
    <li>Uses modern JavaScript syntax</li>
</ul>
                    """,
                    "order": 1
                }
            ]
        }
    ]
    
    # Create the final modules
    for module_data in final_modules:
        print(f"\\n📁 Creating module: {module_data['title']}")
        
        module_payload = {
            "title": module_data["title"],
            "description": module_data["description"],
            "learning_objectives": module_data["learning_objectives"],
            "order": module_data["order"],
            "is_published": True
        }
        
        try:
            module_response = requests.post(
                f"{base_url}/instructor/courses/{course_id}/modules",
                headers=headers,
                json=module_payload,
                timeout=15
            )
            
            if module_response.status_code == 201:
                module = module_response.json()["module"]
                module_id = module["id"]
                print(f"  ✅ Module created successfully! ID: {module_id}")
                
                # Create lessons for this module
                for lesson_data in module_data["lessons"]:
                    print(f"    📄 Creating lesson: {lesson_data['title']}")
                    
                    lesson_payload = {
                        "title": lesson_data["title"],
                        "content_type": lesson_data["content_type"],
                        "content_data": lesson_data["content_data"],
                        "description": lesson_data["description"],
                        "duration_minutes": lesson_data["duration_minutes"],
                        "order": lesson_data["order"],
                        "is_published": True
                    }
                    
                    try:
                        lesson_response = requests.post(
                            f"{base_url}/instructor/courses/{course_id}/modules/{module_id}/lessons",
                            headers=headers,
                            json=lesson_payload,
                            timeout=15
                        )
                        
                        if lesson_response.status_code == 201:
                            lesson = lesson_response.json()["lesson"]
                            print(f"      ✅ Lesson created! ID: {lesson['id']}")
                        else:
                            print(f"      ❌ Failed to create lesson: {lesson_response.text}")
                            
                    except Exception as e:
                        print(f"      ❌ Lesson creation error: {e}")
                    
                    time.sleep(0.5)
                
            else:
                print(f"  ❌ Failed to create module: {module_response.text}")
                
        except Exception as e:
            print(f"  ❌ Module creation error: {e}")
        
        time.sleep(1)
    
    print(f"\\n🎉 Final modules creation completed!")

if __name__ == "__main__":
    add_final_modules()
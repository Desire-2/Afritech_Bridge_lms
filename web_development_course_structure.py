#!/usr/bin/env python3
"""
Comprehensive Web Development Course Structure
"""

import requests
import json
from datetime import datetime

class WebDevelopmentCourse:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        self.course_id = None
        
    def create_course(self):
        """Create the main course"""
        course_data = {
            "title": "Complete Web Development Bootcamp 2025",
            "description": """Master modern web development from scratch to deployment. This comprehensive course covers everything you need to become a full-stack web developer, including HTML5, CSS3, JavaScript ES6+, popular frameworks, backend development, databases, and deployment strategies. Perfect for beginners and those looking to upgrade their skills to current industry standards.""",
            "learning_objectives": """By the end of this course, students will be able to:
• Build responsive and interactive websites using HTML5, CSS3, and JavaScript
• Develop modern web applications using popular frameworks like React
• Create RESTful APIs and server-side applications
• Work with databases and implement CRUD operations
• Deploy web applications to production environments
• Follow web development best practices and industry standards
• Debug and troubleshoot web applications effectively
• Implement user authentication and security measures
• Optimize web applications for performance and SEO""",
            "target_audience": "Beginners with no programming experience, developers looking to learn web development, professionals seeking career change into tech, students preparing for web development careers",
            "estimated_duration": "16 weeks (120+ hours of content)",
            "is_published": False
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/instructor/courses",
                headers=self.headers,
                json=course_data,
                timeout=10
            )
            
            if response.status_code == 201:
                course = response.json()['course']
                self.course_id = course['id']
                print(f"✅ Course created successfully! ID: {self.course_id}")
                return self.course_id
            else:
                print(f"❌ Failed to create course: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error creating course: {e}")
            return None
    
    def get_course_structure(self):
        """Define the complete course structure"""
        return {
            "modules": [
                {
                    "title": "Module 1: Web Development Fundamentals",
                    "description": "Introduction to web development, setting up development environment, and understanding how the web works",
                    "learning_objectives": "Understand web development basics, set up development tools, learn about client-server architecture",
                    "order": 1,
                    "lessons": [
                        {
                            "title": "What is Web Development?",
                            "content_type": "text",
                            "description": "Overview of web development, career paths, and industry trends",
                            "duration_minutes": 30,
                            "content_data": """
<h2>Introduction to Web Development</h2>

<h3>What is Web Development?</h3>
<p>Web development is the process of creating websites and web applications that run on the internet or an intranet. It involves several aspects including web design, web content development, client-side/server-side scripting, and network security configuration.</p>

<h3>Types of Web Development</h3>
<ul>
    <li><strong>Frontend Development:</strong> The client-side development focusing on user interface and user experience</li>
    <li><strong>Backend Development:</strong> The server-side development handling data, authentication, and business logic</li>
    <li><strong>Full-Stack Development:</strong> Combination of both frontend and backend development</li>
</ul>

<h3>Career Opportunities</h3>
<p>Web development offers numerous career paths:</p>
<ul>
    <li>Frontend Developer</li>
    <li>Backend Developer</li>
    <li>Full-Stack Developer</li>
    <li>UI/UX Developer</li>
    <li>DevOps Engineer</li>
    <li>Web Designer</li>
</ul>

<h3>Industry Trends 2025</h3>
<ul>
    <li>Progressive Web Apps (PWAs)</li>
    <li>AI-powered development tools</li>
    <li>Low-code/No-code platforms</li>
    <li>Jamstack architecture</li>
    <li>WebAssembly</li>
    <li>Micro-frontends</li>
</ul>
                            """,
                            "order": 1
                        },
                        {
                            "title": "Setting Up Your Development Environment",
                            "content_type": "text",
                            "description": "Install and configure essential development tools",
                            "duration_minutes": 45,
                            "content_data": """
<h2>Development Environment Setup</h2>

<h3>Essential Tools</h3>

<h4>1. Code Editor - Visual Studio Code</h4>
<p>Download and install VS Code from <a href="https://code.visualstudio.com">https://code.visualstudio.com</a></p>

<h4>Essential VS Code Extensions:</h4>
<ul>
    <li>Live Server - Launch development local server with live reload</li>
    <li>Prettier - Code formatter</li>
    <li>Auto Rename Tag - Automatically rename paired HTML tags</li>
    <li>Bracket Pair Colorizer - Colorize matching brackets</li>
    <li>HTML CSS Support - CSS class and ID completion</li>
    <li>JavaScript (ES6) code snippets</li>
</ul>

<h4>2. Web Browsers</h4>
<ul>
    <li>Google Chrome (with Chrome DevTools)</li>
    <li>Firefox Developer Edition</li>
    <li>Safari (for Mac users)</li>
    <li>Microsoft Edge</li>
</ul>

<h4>3. Version Control - Git</h4>
<p>Install Git from <a href="https://git-scm.com">https://git-scm.com</a></p>
<pre><code># Verify installation
git --version

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"</code></pre>

<h4>4. Node.js and npm</h4>
<p>Download from <a href="https://nodejs.org">https://nodejs.org</a> (LTS version recommended)</p>
<pre><code># Verify installation
node --version
npm --version</code></pre>

<h3>Workspace Organization</h3>
<p>Create a dedicated folder structure for your projects:</p>
<pre><code>
web-development/
├── projects/
├── practice/
├── resources/
└── notes/
</code></pre>
                            """,
                            "order": 2
                        },
                        {
                            "title": "How the Web Works",
                            "content_type": "text",
                            "description": "Understanding client-server architecture, HTTP, and web protocols",
                            "duration_minutes": 40,
                            "content_data": """
<h2>How the Web Works</h2>

<h3>Client-Server Architecture</h3>
<p>The web operates on a client-server model:</p>
<ul>
    <li><strong>Client:</strong> Web browser that requests information</li>
    <li><strong>Server:</strong> Computer that stores and serves web content</li>
    <li><strong>Network:</strong> Internet infrastructure connecting clients and servers</li>
</ul>

<h3>HTTP Protocol</h3>
<p>HyperText Transfer Protocol (HTTP) is the foundation of data communication on the web.</p>

<h4>HTTP Methods:</h4>
<ul>
    <li><strong>GET:</strong> Retrieve data from server</li>
    <li><strong>POST:</strong> Send data to server</li>
    <li><strong>PUT:</strong> Update existing data</li>
    <li><strong>DELETE:</strong> Remove data</li>
</ul>

<h4>HTTP Status Codes:</h4>
<ul>
    <li><strong>200:</strong> OK - Request successful</li>
    <li><strong>404:</strong> Not Found - Resource doesn't exist</li>
    <li><strong>500:</strong> Internal Server Error</li>
    <li><strong>403:</strong> Forbidden - Access denied</li>
</ul>

<h3>Domain Names and DNS</h3>
<p>Domain Name System (DNS) translates human-readable domain names to IP addresses.</p>

<h3>URL Structure</h3>
<pre><code>https://www.example.com:443/path/to/resource?query=value#fragment

Protocol: https://
Subdomain: www
Domain: example.com
Port: :443
Path: /path/to/resource
Query: ?query=value
Fragment: #fragment</code></pre>

<h3>Web Technologies Stack</h3>
<ul>
    <li><strong>Frontend:</strong> HTML, CSS, JavaScript</li>
    <li><strong>Backend:</strong> Server languages (Python, JavaScript, PHP, etc.)</li>
    <li><strong>Database:</strong> Data storage (MySQL, PostgreSQL, MongoDB)</li>
    <li><strong>Web Server:</strong> Apache, Nginx, IIS</li>
</ul>
                            """,
                            "order": 3
                        }
                    ]
                },
                {
                    "title": "Module 2: HTML5 Fundamentals",
                    "description": "Master HTML5 structure, semantics, forms, and modern features",
                    "learning_objectives": "Create well-structured HTML documents, use semantic elements, build forms, and implement HTML5 features",
                    "order": 2,
                    "lessons": [
                        {
                            "title": "HTML Structure and Syntax",
                            "content_type": "text",
                            "description": "Learn basic HTML structure, tags, and syntax rules",
                            "duration_minutes": 50,
                            "content_data": """
<h2>HTML Structure and Syntax</h2>

<h3>What is HTML?</h3>
<p>HTML (HyperText Markup Language) is the standard markup language for creating web pages. It describes the structure and content of a webpage using elements and tags.</p>

<h3>Basic HTML Document Structure</h3>
<pre><code>&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Page Title&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;h1&gt;Main Heading&lt;/h1&gt;
    &lt;p&gt;This is a paragraph.&lt;/p&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>

<h3>HTML Elements and Tags</h3>
<ul>
    <li><strong>Element:</strong> Complete structure including opening tag, content, and closing tag</li>
    <li><strong>Tag:</strong> Keywords enclosed in angle brackets</li>
    <li><strong>Attribute:</strong> Additional information about an element</li>
</ul>

<h3>Common HTML Tags</h3>

<h4>Headings:</h4>
<pre><code>&lt;h1&gt;Main Heading&lt;/h1&gt;
&lt;h2&gt;Subheading&lt;/h2&gt;
&lt;h3&gt;Sub-subheading&lt;/h3&gt;
&lt;h4&gt;Minor Heading&lt;/h4&gt;
&lt;h5&gt;Smallest Heading&lt;/h5&gt;
&lt;h6&gt;Tiny Heading&lt;/h6&gt;</code></pre>

<h4>Text Elements:</h4>
<pre><code>&lt;p&gt;Paragraph text&lt;/p&gt;
&lt;strong&gt;Important text&lt;/strong&gt;
&lt;em&gt;Emphasized text&lt;/em&gt;
&lt;br&gt; &lt;!-- Line break --&gt;
&lt;hr&gt; &lt;!-- Horizontal rule --&gt;</code></pre>

<h4>Lists:</h4>
<pre><code>&lt;!-- Unordered List --&gt;
&lt;ul&gt;
    &lt;li&gt;Item 1&lt;/li&gt;
    &lt;li&gt;Item 2&lt;/li&gt;
&lt;/ul&gt;

&lt;!-- Ordered List --&gt;
&lt;ol&gt;
    &lt;li&gt;First item&lt;/li&gt;
    &lt;li&gt;Second item&lt;/li&gt;
&lt;/ol&gt;</code></pre>

<h4>Links and Images:</h4>
<pre><code>&lt;a href="https://example.com"&gt;Link text&lt;/a&gt;
&lt;img src="image.jpg" alt="Description" width="300" height="200"&gt;</code></pre>

<h3>HTML Attributes</h3>
<ul>
    <li><strong>id:</strong> Unique identifier for an element</li>
    <li><strong>class:</strong> CSS class name for styling</li>
    <li><strong>style:</strong> Inline CSS styles</li>
    <li><strong>title:</strong> Tooltip text</li>
    <li><strong>lang:</strong> Language of the element content</li>
</ul>

<h3>Practice Exercise</h3>
<p>Create a simple HTML page about yourself including:</p>
<ul>
    <li>Your name as the main heading</li>
    <li>A brief introduction paragraph</li>
    <li>A list of your hobbies</li>
    <li>A link to your favorite website</li>
</ul>
                            """,
                            "order": 1
                        },
                        {
                            "title": "Semantic HTML5 Elements",
                            "content_type": "text",
                            "description": "Understanding and using HTML5 semantic elements for better structure",
                            "duration_minutes": 45,
                            "content_data": """
<h2>Semantic HTML5 Elements</h2>

<h3>What are Semantic Elements?</h3>
<p>Semantic elements clearly describe their meaning in a human- and machine-readable way. They provide structure and meaning to web content, improving accessibility and SEO.</p>

<h3>HTML5 Semantic Elements</h3>

<h4>Page Structure Elements:</h4>
<pre><code>&lt;header&gt;
    &lt;nav&gt;
        &lt;ul&gt;
            &lt;li&gt;&lt;a href="#home"&gt;Home&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#about"&gt;About&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#contact"&gt;Contact&lt;/a&gt;&lt;/li&gt;
        &lt;/ul&gt;
    &lt;/nav&gt;
&lt;/header&gt;

&lt;main&gt;
    &lt;section&gt;
        &lt;h2&gt;Section Title&lt;/h2&gt;
        &lt;article&gt;
            &lt;h3&gt;Article Title&lt;/h3&gt;
            &lt;p&gt;Article content...&lt;/p&gt;
        &lt;/article&gt;
    &lt;/section&gt;
    
    &lt;aside&gt;
        &lt;h3&gt;Related Links&lt;/h3&gt;
        &lt;ul&gt;
            &lt;li&gt;&lt;a href="#"&gt;Link 1&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#"&gt;Link 2&lt;/a&gt;&lt;/li&gt;
        &lt;/ul&gt;
    &lt;/aside&gt;
&lt;/main&gt;

&lt;footer&gt;
    &lt;p&gt;&copy; 2025 Your Website. All rights reserved.&lt;/p&gt;
&lt;/footer&gt;</code></pre>

<h3>Element Descriptions</h3>

<h4>&lt;header&gt;</h4>
<p>Represents introductory content or navigational aids. Typically contains headings, logos, search forms, or navigation.</p>

<h4>&lt;nav&gt;</h4>
<p>Defines a section with navigation links. Use for main navigation menus, table of contents, or breadcrumbs.</p>

<h4>&lt;main&gt;</h4>
<p>Represents the main content of the document. Should be unique and exclude content that is repeated across documents.</p>

<h4>&lt;section&gt;</h4>
<p>Defines a section of a document with a thematic grouping of content, typically with a heading.</p>

<h4>&lt;article&gt;</h4>
<p>Represents a self-contained composition that can be independently distributed or reused (blog post, news article, forum post).</p>

<h4>&lt;aside&gt;</h4>
<p>Represents content that is tangentially related to the main content (sidebar, pull quotes, advertisements).</p>

<h4>&lt;footer&gt;</h4>
<p>Represents the footer for its nearest sectioning content or sectioning root element.</p>

<h3>Other Semantic Elements</h3>

<h4>Text-level Semantics:</h4>
<pre><code>&lt;mark&gt;Highlighted text&lt;/mark&gt;
&lt;time datetime="2025-01-01"&gt;January 1, 2025&lt;/time&gt;
&lt;address&gt;Contact information&lt;/address&gt;
&lt;blockquote cite="source"&gt;A quoted section&lt;/blockquote&gt;
&lt;cite&gt;Source title&lt;/cite&gt;
&lt;code&gt;Computer code&lt;/code&gt;
&lt;kbd&gt;Keyboard input&lt;/kbd&gt;
&lt;samp&gt;Sample output&lt;/samp&gt;</code></pre>

<h3>Benefits of Semantic HTML</h3>
<ul>
    <li><strong>Accessibility:</strong> Screen readers better understand content structure</li>
    <li><strong>SEO:</strong> Search engines better index and rank your content</li>
    <li><strong>Maintainability:</strong> Code is more readable and easier to maintain</li>
    <li><strong>Styling:</strong> CSS can target semantic elements more effectively</li>
</ul>

<h3>Practice Exercise</h3>
<p>Convert a non-semantic HTML page to use proper HTML5 semantic elements. Focus on:</p>
<ul>
    <li>Replacing &lt;div&gt; elements with appropriate semantic elements</li>
    <li>Adding proper heading hierarchy</li>
    <li>Structuring content logically</li>
</ul>
                            """,
                            "order": 2
                        },
                        {
                            "title": "HTML Forms and Input Types",
                            "content_type": "text",
                            "description": "Creating interactive forms with various input types and validation",
                            "duration_minutes": 60,
                            "content_data": """
<h2>HTML Forms and Input Types</h2>

<h3>Form Basics</h3>
<p>HTML forms allow users to input data that can be sent to a server for processing. Forms are essential for user interaction on websites.</p>

<h3>Basic Form Structure</h3>
<pre><code>&lt;form action="/submit" method="POST"&gt;
    &lt;label for="username"&gt;Username:&lt;/label&gt;
    &lt;input type="text" id="username" name="username" required&gt;
    
    &lt;label for="email"&gt;Email:&lt;/label&gt;
    &lt;input type="email" id="email" name="email" required&gt;
    
    &lt;button type="submit"&gt;Submit&lt;/button&gt;
&lt;/form&gt;</code></pre>

<h3>Form Attributes</h3>
<ul>
    <li><strong>action:</strong> URL where form data is sent</li>
    <li><strong>method:</strong> HTTP method (GET or POST)</li>
    <li><strong>enctype:</strong> Encoding type for form data</li>
    <li><strong>target:</strong> Where to display the response</li>
</ul>

<h3>Input Types</h3>

<h4>Text Inputs:</h4>
<pre><code>&lt;input type="text" placeholder="Enter text"&gt;
&lt;input type="password" placeholder="Enter password"&gt;
&lt;input type="email" placeholder="Enter email"&gt;
&lt;input type="url" placeholder="Enter URL"&gt;
&lt;input type="tel" placeholder="Enter phone number"&gt;
&lt;input type="search" placeholder="Search..."&gt;</code></pre>

<h4>Number and Date Inputs:</h4>
<pre><code>&lt;input type="number" min="1" max="100" step="1"&gt;
&lt;input type="range" min="0" max="100" value="50"&gt;
&lt;input type="date"&gt;
&lt;input type="time"&gt;
&lt;input type="datetime-local"&gt;
&lt;input type="month"&gt;
&lt;input type="week"&gt;</code></pre>

<h4>Selection Inputs:</h4>
<pre><code>&lt;input type="checkbox" id="subscribe" name="subscribe"&gt;
&lt;label for="subscribe"&gt;Subscribe to newsletter&lt;/label&gt;

&lt;input type="radio" id="male" name="gender" value="male"&gt;
&lt;label for="male"&gt;Male&lt;/label&gt;
&lt;input type="radio" id="female" name="gender" value="female"&gt;
&lt;label for="female"&gt;Female&lt;/label&gt;</code></pre>

<h4>File and Color Inputs:</h4>
<pre><code>&lt;input type="file" accept=".jpg,.png,.pdf"&gt;
&lt;input type="color" value="#ff0000"&gt;</code></pre>

<h3>Textarea and Select Elements</h3>

<h4>Textarea:</h4>
<pre><code>&lt;textarea name="message" rows="4" cols="50" placeholder="Enter your message"&gt;&lt;/textarea&gt;</code></pre>

<h4>Select Dropdown:</h4>
<pre><code>&lt;select name="country"&gt;
    &lt;option value=""&gt;Select a country&lt;/option&gt;
    &lt;option value="us"&gt;United States&lt;/option&gt;
    &lt;option value="uk"&gt;United Kingdom&lt;/option&gt;
    &lt;option value="ca"&gt;Canada&lt;/option&gt;
&lt;/select&gt;</code></pre>

<h4>Multiple Select:</h4>
<pre><code>&lt;select name="skills" multiple&gt;
    &lt;option value="html"&gt;HTML&lt;/option&gt;
    &lt;option value="css"&gt;CSS&lt;/option&gt;
    &lt;option value="js"&gt;JavaScript&lt;/option&gt;
&lt;/select&gt;</code></pre>

<h3>Form Validation</h3>

<h4>HTML5 Validation Attributes:</h4>
<pre><code>&lt;input type="text" required&gt;
&lt;input type="email" required&gt;
&lt;input type="text" minlength="3" maxlength="20"&gt;
&lt;input type="number" min="18" max="100"&gt;
&lt;input type="text" pattern="[A-Za-z]{3,}" title="Only letters, minimum 3 characters"&gt;</code></pre>

<h3>Fieldset and Legend</h3>
<pre><code>&lt;fieldset&gt;
    &lt;legend&gt;Personal Information&lt;/legend&gt;
    &lt;label for="firstName"&gt;First Name:&lt;/label&gt;
    &lt;input type="text" id="firstName" name="firstName"&gt;
    
    &lt;label for="lastName"&gt;Last Name:&lt;/label&gt;
    &lt;input type="text" id="lastName" name="lastName"&gt;
&lt;/fieldset&gt;</code></pre>

<h3>Complete Form Example</h3>
<pre><code>&lt;form action="/register" method="POST"&gt;
    &lt;fieldset&gt;
        &lt;legend&gt;User Registration&lt;/legend&gt;
        
        &lt;label for="username"&gt;Username:&lt;/label&gt;
        &lt;input type="text" id="username" name="username" required minlength="3"&gt;
        
        &lt;label for="email"&gt;Email:&lt;/label&gt;
        &lt;input type="email" id="email" name="email" required&gt;
        
        &lt;label for="password"&gt;Password:&lt;/label&gt;
        &lt;input type="password" id="password" name="password" required minlength="8"&gt;
        
        &lt;label for="age"&gt;Age:&lt;/label&gt;
        &lt;input type="number" id="age" name="age" min="13" max="120"&gt;
        
        &lt;label for="bio"&gt;Bio:&lt;/label&gt;
        &lt;textarea id="bio" name="bio" rows="4" cols="50"&gt;&lt;/textarea&gt;
        
        &lt;input type="checkbox" id="terms" name="terms" required&gt;
        &lt;label for="terms"&gt;I agree to the terms and conditions&lt;/label&gt;
        
        &lt;button type="submit"&gt;Register&lt;/button&gt;
        &lt;button type="reset"&gt;Reset&lt;/button&gt;
    &lt;/fieldset&gt;
&lt;/form&gt;</code></pre>

<h3>Practice Exercise</h3>
<p>Create a contact form with:</p>
<ul>
    <li>Name (required)</li>
    <li>Email (required, email validation)</li>
    <li>Phone number</li>
    <li>Subject dropdown</li>
    <li>Message textarea</li>
    <li>Submit and reset buttons</li>
</ul>
                            """,
                            "order": 3
                        }
                    ]
                },
                {
                    "title": "Module 3: CSS3 Styling and Layout",
                    "description": "Master CSS styling, layout techniques, responsive design, and modern CSS features",
                    "learning_objectives": "Style web pages effectively, create responsive layouts, use CSS Grid and Flexbox, implement animations",
                    "order": 3,
                    "lessons": [
                        {
                            "title": "CSS Fundamentals and Selectors",
                            "content_type": "text",
                            "description": "Learn CSS syntax, selectors, properties, and values",
                            "duration_minutes": 55,
                            "content_data": """
<h2>CSS Fundamentals and Selectors</h2>

<h3>What is CSS?</h3>
<p>CSS (Cascading Style Sheets) is used to control the presentation and layout of HTML documents. It separates content from design, making websites more maintainable and flexible.</p>

<h3>CSS Syntax</h3>
<pre><code>selector {
    property: value;
    property: value;
}</code></pre>

<h3>Adding CSS to HTML</h3>

<h4>1. Inline CSS:</h4>
<pre><code>&lt;p style="color: blue; font-size: 16px;"&gt;Styled text&lt;/p&gt;</code></pre>

<h4>2. Internal CSS:</h4>
<pre><code>&lt;head&gt;
    &lt;style&gt;
        p {
            color: blue;
            font-size: 16px;
        }
    &lt;/style&gt;
&lt;/head&gt;</code></pre>

<h4>3. External CSS (Recommended):</h4>
<pre><code>&lt;head&gt;
    &lt;link rel="stylesheet" href="styles.css"&gt;
&lt;/head&gt;</code></pre>

<h3>CSS Selectors</h3>

<h4>Basic Selectors:</h4>
<pre><code>/* Element selector */
p { color: black; }

/* Class selector */
.highlight { background-color: yellow; }

/* ID selector */
#header { font-size: 24px; }

/* Universal selector */
* { margin: 0; padding: 0; }</code></pre>

<h4>Attribute Selectors:</h4>
<pre><code>/* Attribute exists */
[title] { cursor: help; }

/* Attribute equals value */
[type="email"] { border: 2px solid green; }

/* Attribute starts with value */
[href^="https"] { color: green; }

/* Attribute ends with value */
[href$=".pdf"] { color: red; }

/* Attribute contains value */
[class*="btn"] { padding: 10px; }</code></pre>

<h4>Pseudo-classes:</h4>
<pre><code>/* Link states */
a:link { color: blue; }
a:visited { color: purple; }
a:hover { color: red; }
a:active { color: orange; }

/* Form states */
input:focus { outline: 2px solid blue; }
input:disabled { opacity: 0.5; }
input:checked { background-color: green; }

/* Structural pseudo-classes */
li:first-child { font-weight: bold; }
li:last-child { margin-bottom: 0; }
li:nth-child(odd) { background-color: #f0f0f0; }
li:nth-child(2n) { background-color: #e0e0e0; }</code></pre>

<h4>Pseudo-elements:</h4>
<pre><code>/* Before and after */
p::before { content: "★ "; }
p::after { content: " ★"; }

/* First line and letter */
p::first-line { font-weight: bold; }
p::first-letter { font-size: 2em; }</code></pre>

<h4>Combinators:</h4>
<pre><code>/* Descendant selector */
div p { color: blue; }

/* Child selector */
div > p { color: red; }

/* Adjacent sibling */
h1 + p { margin-top: 0; }

/* General sibling */
h1 ~ p { color: gray; }</code></pre>

<h3>CSS Specificity</h3>
<p>Specificity determines which CSS rule applies when multiple rules target the same element:</p>
<ol>
    <li>Inline styles (1000)</li>
    <li>IDs (100)</li>
    <li>Classes, attributes, pseudo-classes (10)</li>
    <li>Elements and pseudo-elements (1)</li>
</ol>

<h3>Common CSS Properties</h3>

<h4>Text Properties:</h4>
<pre><code>.text-styling {
    color: #333;
    font-family: 'Arial', sans-serif;
    font-size: 16px;
    font-weight: bold;
    font-style: italic;
    text-align: center;
    text-decoration: underline;
    line-height: 1.5;
    letter-spacing: 1px;
    word-spacing: 2px;
    text-transform: uppercase;
}</code></pre>

<h4>Background Properties:</h4>
<pre><code>.background-styling {
    background-color: #f0f0f0;
    background-image: url('image.jpg');
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    /* Shorthand */
    background: #f0f0f0 url('image.jpg') no-repeat center/cover;
}</code></pre>

<h4>Border Properties:</h4>
<pre><code>.border-styling {
    border-width: 2px;
    border-style: solid;
    border-color: #333;
    /* Shorthand */
    border: 2px solid #333;
    border-radius: 10px;
}</code></pre>

<h3>Practice Exercise</h3>
<p>Style a simple webpage with:</p>
<ul>
    <li>Different heading styles</li>
    <li>Paragraph styling with various selectors</li>
    <li>Button hover effects</li>
    <li>List styling with pseudo-classes</li>
</ul>
                            """,
                            "order": 1
                        },
                        {
                            "title": "Box Model and Positioning",
                            "content_type": "text", 
                            "description": "Understanding the CSS box model, margins, padding, and positioning",
                            "duration_minutes": 50,
                            "content_data": """
<h2>Box Model and Positioning</h2>

<h3>The CSS Box Model</h3>
<p>Every HTML element is essentially a rectangular box consisting of four parts:</p>
<ul>
    <li><strong>Content:</strong> The actual content (text, images, etc.)</li>
    <li><strong>Padding:</strong> Space between content and border</li>
    <li><strong>Border:</strong> A line around the padding and content</li>
    <li><strong>Margin:</strong> Space outside the border</li>
</ul>

<h3>Box Model Properties</h3>

<h4>Width and Height:</h4>
<pre><code>.box {
    width: 300px;
    height: 200px;
    max-width: 100%;
    min-height: 150px;
}</code></pre>

<h4>Padding:</h4>
<pre><code>/* All sides */
.padding-all { padding: 20px; }

/* Vertical and horizontal */
.padding-vh { padding: 20px 10px; }

/* Top, horizontal, bottom */
.padding-thb { padding: 20px 10px 15px; }

/* Individual sides */
.padding-individual {
    padding-top: 20px;
    padding-right: 10px;
    padding-bottom: 15px;
    padding-left: 5px;
    /* Shorthand: top right bottom left */
    padding: 20px 10px 15px 5px;
}</code></pre>

<h4>Margin:</h4>
<pre><code>/* Same syntax as padding */
.margin-example {
    margin: 20px 10px;
    /* Centering horizontally */
    margin: 0 auto;
}</code></pre>

<h4>Border:</h4>
<pre><code>.border-example {
    border: 2px solid #333;
    border-radius: 10px;
    /* Individual borders */
    border-top: 3px solid red;
    border-right: 1px dashed blue;
}</code></pre>

<h3>Box-Sizing Property</h3>
<pre><code>/* Default: content-box */
.content-box {
    box-sizing: content-box;
    width: 300px;
    padding: 20px;
    border: 2px solid #333;
    /* Total width: 300 + 40 + 4 = 344px */
}

/* Recommended: border-box */
.border-box {
    box-sizing: border-box;
    width: 300px;
    padding: 20px;
    border: 2px solid #333;
    /* Total width: 300px (includes padding and border) */
}

/* Apply to all elements */
* {
    box-sizing: border-box;
}</code></pre>

<h3>CSS Positioning</h3>

<h4>Static Positioning (Default):</h4>
<pre><code>.static {
    position: static; /* Default behavior */
}</code></pre>

<h4>Relative Positioning:</h4>
<pre><code>.relative {
    position: relative;
    top: 20px;
    left: 30px;
    /* Moves relative to its normal position */
}</code></pre>

<h4>Absolute Positioning:</h4>
<pre><code>.absolute {
    position: absolute;
    top: 50px;
    right: 20px;
    /* Positioned relative to nearest positioned ancestor */
}</code></pre>

<h4>Fixed Positioning:</h4>
<pre><code>.fixed {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    /* Positioned relative to viewport */
}</code></pre>

<h4>Sticky Positioning:</h4>
<pre><code>.sticky {
    position: sticky;
    top: 20px;
    /* Sticks to top when scrolled past */
}</code></pre>

<h3>Z-Index</h3>
<pre><code>.overlay {
    position: absolute;
    z-index: 10; /* Higher values appear on top */
}

.background {
    position: absolute;
    z-index: 1;
}</code></pre>

<h3>Display Property</h3>

<h4>Common Display Values:</h4>
<pre><code>/* Block elements */
.block {
    display: block;
    /* Takes full width, starts on new line */
}

/* Inline elements */
.inline {
    display: inline;
    /* Only takes necessary width, no line break */
}

/* Inline-block elements */
.inline-block {
    display: inline-block;
    /* Inline but can have width/height */
}

/* Hide elements */
.hidden {
    display: none; /* Completely removes from layout */
}

.invisible {
    visibility: hidden; /* Hides but keeps space */
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

/* Clearfix for containers */
.clearfix::after {
    content: "";
    display: table;
    clear: both;
}</code></pre>

<h3>Practical Example</h3>
<pre><code>/* Card component */
.card {
    position: relative;
    width: 300px;
    margin: 20px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    box-sizing: border-box;
}

.card-header {
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
}

.card-title {
    margin: 0;
    font-size: 1.2em;
    color: #333;
}

.card-content {
    margin-bottom: 15px;
    line-height: 1.5;
}

.card-footer {
    text-align: right;
}</code></pre>

<h3>Practice Exercise</h3>
<p>Create a layout with:</p>
<ul>
    <li>A fixed header at the top</li>
    <li>A sidebar with relative positioning</li>
    <li>A main content area using proper box model</li>
    <li>Cards with hover effects using positioning</li>
</ul>
                            """,
                            "order": 2
                        }
                    ]
                }
            ]
        }

def main():
    # Configuration
    base_url = "http://localhost:5001/api/v1"
    
    # Login credentials
    login_data = {
        "identifier": "instructor@afritecbridge.com",
        "password": "Instructor@123"
    }
    
    print("🚀 Starting Web Development Course Creation...")
    
    # Login and get token
    try:
        print("1. Logging in...")
        response = requests.post(f"{base_url}/auth/login", json=login_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return
            
        token_data = response.json()
        token = token_data.get('access_token')
        user = token_data.get('user')
        print(f"✅ Login successful! User: {user.get('username')}, Role: {user.get('role')}")
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Create course instance
    course_creator = WebDevelopmentCourse(base_url, token)
    
    # Create the main course
    print("\\n2. Creating main course...")
    course_id = course_creator.create_course()
    
    if not course_id:
        print("❌ Failed to create course. Exiting.")
        return
    
    print(f"\\n✅ Course creation completed successfully!")
    print(f"Course ID: {course_id}")
    print(f"Course Title: Complete Web Development Bootcamp 2025")
    
    # Get course structure for reference
    structure = course_creator.get_course_structure()
    print(f"\\n📚 Course Structure:")
    print(f"Total Modules: {len(structure['modules'])}")
    
    for i, module in enumerate(structure['modules'], 1):
        print(f"  Module {i}: {module['title']} ({len(module['lessons'])} lessons)")

if __name__ == "__main__":
    main()
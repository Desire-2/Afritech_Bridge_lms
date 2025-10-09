#!/usr/bin/env python3
"""
Complete Web Development Course Implementation
This script creates all modules and lessons for the comprehensive web development course
"""

import requests
import json
import time

def create_modules_and_lessons():
    """Create all modules and lessons for the course"""
    
    base_url = "http://localhost:5001/api/v1"
    course_id = 7  # The course we just created
    
    # Login to get token
    login_data = {
        "identifier": "instructor@afritecbridge.com", 
        "password": "Instructor@123"
    }
    
    print("🔐 Logging in...")
    try:
        response = requests.post(f"{base_url}/auth/login", json=login_data, timeout=10)
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return
        
        token = response.json().get('access_token')
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        print("✅ Login successful!")
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Extended course structure with more modules
    course_structure = {
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

<h3>Salary Expectations</h3>
<p>Web development offers competitive salaries:</p>
<ul>
    <li><strong>Entry Level:</strong> $50,000 - $70,000</li>
    <li><strong>Mid Level:</strong> $70,000 - $100,000</li>
    <li><strong>Senior Level:</strong> $100,000 - $150,000+</li>
    <li><strong>Lead/Architect:</strong> $150,000 - $200,000+</li>
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
    <li><strong>Live Server</strong> - Launch development local server with live reload</li>
    <li><strong>Prettier</strong> - Code formatter</li>
    <li><strong>Auto Rename Tag</strong> - Automatically rename paired HTML tags</li>
    <li><strong>Bracket Pair Colorizer</strong> - Colorize matching brackets</li>
    <li><strong>HTML CSS Support</strong> - CSS class and ID completion</li>
    <li><strong>JavaScript (ES6) code snippets</strong></li>
    <li><strong>GitLens</strong> - Enhanced Git capabilities</li>
    <li><strong>REST Client</strong> - Test APIs directly in VS Code</li>
</ul>

<h4>2. Web Browsers</h4>
<ul>
    <li><strong>Google Chrome</strong> (with Chrome DevTools)</li>
    <li><strong>Firefox Developer Edition</strong></li>
    <li><strong>Safari</strong> (for Mac users)</li>
    <li><strong>Microsoft Edge</strong></li>
</ul>

<h4>3. Version Control - Git</h4>
<p>Install Git from <a href="https://git-scm.com">https://git-scm.com</a></p>
<pre><code># Verify installation
git --version

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Set default branch name
git config --global init.defaultBranch main</code></pre>

<h4>4. Node.js and npm</h4>
<p>Download from <a href="https://nodejs.org">https://nodejs.org</a> (LTS version recommended)</p>
<pre><code># Verify installation
node --version
npm --version

# Update npm to latest version
npm install -g npm@latest</code></pre>

<h4>5. Package Managers</h4>
<pre><code># Install Yarn (alternative to npm)
npm install -g yarn

# Install pnpm (fast, disk space efficient)
npm install -g pnpm</code></pre>

<h3>Workspace Organization</h3>
<p>Create a dedicated folder structure for your projects:</p>
<pre><code>
web-development/
├── projects/
│   ├── personal/
│   ├── portfolio/
│   └── practice/
├── templates/
├── resources/
│   ├── images/
│   ├── fonts/
│   └── icons/
└── notes/
    ├── html/
    ├── css/
    └── javascript/
</code></pre>

<h3>Browser Developer Tools</h3>
<h4>Chrome DevTools Features:</h4>
<ul>
    <li><strong>Elements Tab:</strong> Inspect and modify HTML/CSS</li>
    <li><strong>Console Tab:</strong> JavaScript debugging and testing</li>
    <li><strong>Sources Tab:</strong> Debug JavaScript code</li>
    <li><strong>Network Tab:</strong> Monitor network requests</li>
    <li><strong>Performance Tab:</strong> Analyze page performance</li>
    <li><strong>Application Tab:</strong> Manage storage and service workers</li>
</ul>

<h3>Online Development Tools</h3>
<ul>
    <li><strong>CodePen:</strong> Online HTML/CSS/JS editor</li>
    <li><strong>JSFiddle:</strong> Test and share code snippets</li>
    <li><strong>Repl.it:</strong> Online IDE for multiple languages</li>
    <li><strong>Glitch:</strong> Create and share web apps</li>
</ul>
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
    <li><strong>Client:</strong> Web browser that requests information (Chrome, Firefox, Safari)</li>
    <li><strong>Server:</strong> Computer that stores and serves web content</li>
    <li><strong>Network:</strong> Internet infrastructure connecting clients and servers</li>
</ul>

<h3>Web Request Flow</h3>
<ol>
    <li>User enters URL in browser</li>
    <li>Browser performs DNS lookup to find server IP</li>
    <li>Browser establishes connection to server</li>
    <li>Browser sends HTTP request</li>
    <li>Server processes request and sends response</li>
    <li>Browser receives and renders content</li>
</ol>

<h3>HTTP Protocol</h3>
<p>HyperText Transfer Protocol (HTTP) is the foundation of data communication on the web.</p>

<h4>HTTP Methods:</h4>
<ul>
    <li><strong>GET:</strong> Retrieve data from server (reading)</li>
    <li><strong>POST:</strong> Send data to server (creating)</li>
    <li><strong>PUT:</strong> Update existing data (updating)</li>
    <li><strong>DELETE:</strong> Remove data (deleting)</li>
    <li><strong>PATCH:</strong> Partial update</li>
    <li><strong>HEAD:</strong> Get headers only</li>
    <li><strong>OPTIONS:</strong> Get allowed methods</li>
</ul>

<h4>HTTP Status Codes:</h4>
<ul>
    <li><strong>1xx:</strong> Informational responses</li>
    <li><strong>2xx:</strong> Success (200 OK, 201 Created)</li>
    <li><strong>3xx:</strong> Redirection (301 Moved, 304 Not Modified)</li>
    <li><strong>4xx:</strong> Client errors (400 Bad Request, 404 Not Found, 403 Forbidden)</li>
    <li><strong>5xx:</strong> Server errors (500 Internal Server Error, 503 Service Unavailable)</li>
</ul>

<h4>HTTP Headers:</h4>
<pre><code># Request Headers
Accept: text/html,application/xhtml+xml
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Authorization: Bearer token123
Content-Type: application/json

# Response Headers
Content-Type: text/html; charset=UTF-8
Cache-Control: max-age=3600
Set-Cookie: sessionid=abc123
Content-Length: 1234</code></pre>

<h3>Domain Names and DNS</h3>
<p>Domain Name System (DNS) translates human-readable domain names to IP addresses.</p>
<ul>
    <li><strong>Top-Level Domain (TLD):</strong> .com, .org, .net, .edu</li>
    <li><strong>Second-Level Domain:</strong> google in google.com</li>
    <li><strong>Subdomain:</strong> www, mail, blog</li>
</ul>

<h3>URL Structure</h3>
<pre><code>https://www.example.com:443/path/to/resource?query=value&page=2#section

Protocol: https://        (HTTP Secure)
Subdomain: www            (World Wide Web)
Domain: example.com       (Website name)
Port: :443               (HTTPS default port)
Path: /path/to/resource  (Specific page/resource)
Query: ?query=value      (Parameters)
Fragment: #section       (Page section)</code></pre>

<h3>Web Technologies Stack</h3>

<h4>Frontend Technologies:</h4>
<ul>
    <li><strong>HTML:</strong> Structure and content</li>
    <li><strong>CSS:</strong> Styling and layout</li>
    <li><strong>JavaScript:</strong> Interactivity and behavior</li>
    <li><strong>Frameworks:</strong> React, Vue, Angular</li>
</ul>

<h4>Backend Technologies:</h4>
<ul>
    <li><strong>Server Languages:</strong> Python, JavaScript (Node.js), PHP, Java, C#</li>
    <li><strong>Frameworks:</strong> Django, Express, Laravel, Spring</li>
    <li><strong>Databases:</strong> MySQL, PostgreSQL, MongoDB</li>
    <li><strong>Web Servers:</strong> Apache, Nginx, IIS</li>
</ul>

<h3>Modern Web Architecture</h3>

<h4>Single Page Applications (SPAs):</h4>
<ul>
    <li>Load once, update content dynamically</li>
    <li>Better user experience</li>
    <li>Uses AJAX/Fetch for data loading</li>
</ul>

<h4>Progressive Web Apps (PWAs):</h4>
<ul>
    <li>Web apps with native app features</li>
    <li>Offline functionality</li>
    <li>Push notifications</li>
    <li>Installable</li>
</ul>

<h4>Jamstack Architecture:</h4>
<ul>
    <li><strong>JavaScript:</strong> Dynamic functionality</li>
    <li><strong>APIs:</strong> Backend services</li>
    <li><strong>Markup:</strong> Pre-built static content</li>
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

<h3>HTML Document Structure</h3>
<pre><code>&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;meta name="description" content="Page description for SEO"&gt;
    &lt;meta name="keywords" content="keyword1, keyword2, keyword3"&gt;
    &lt;meta name="author" content="Your Name"&gt;
    &lt;title&gt;Page Title - Shows in Browser Tab&lt;/title&gt;
    &lt;link rel="stylesheet" href="styles.css"&gt;
    &lt;link rel="icon" href="favicon.ico" type="image/x-icon"&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;header&gt;
        &lt;h1&gt;Main Heading&lt;/h1&gt;
        &lt;nav&gt;Navigation&lt;/nav&gt;
    &lt;/header&gt;
    
    &lt;main&gt;
        &lt;section&gt;
            &lt;h2&gt;Section Title&lt;/h2&gt;
            &lt;p&gt;This is a paragraph.&lt;/p&gt;
        &lt;/section&gt;
    &lt;/main&gt;
    
    &lt;footer&gt;
        &lt;p&gt;&copy; 2025 Your Website&lt;/p&gt;
    &lt;/footer&gt;
    
    &lt;script src="script.js"&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>

<h3>HTML Elements and Tags</h3>
<ul>
    <li><strong>Element:</strong> Complete structure including opening tag, content, and closing tag</li>
    <li><strong>Tag:</strong> Keywords enclosed in angle brackets (&lt;tag&gt;)</li>
    <li><strong>Attribute:</strong> Additional information about an element (id, class, src)</li>
    <li><strong>Content:</strong> Text or other elements between opening and closing tags</li>
</ul>

<h3>Text Elements</h3>

<h4>Headings (Hierarchy):</h4>
<pre><code>&lt;h1&gt;Main Page Title (Only one per page)&lt;/h1&gt;
&lt;h2&gt;Major Section&lt;/h2&gt;
&lt;h3&gt;Subsection&lt;/h3&gt;
&lt;h4&gt;Sub-subsection&lt;/h4&gt;
&lt;h5&gt;Minor Heading&lt;/h5&gt;
&lt;h6&gt;Smallest Heading&lt;/h6&gt;</code></pre>

<h4>Paragraphs and Text Formatting:</h4>
<pre><code>&lt;p&gt;Regular paragraph text.&lt;/p&gt;
&lt;p&gt;Paragraph with &lt;strong&gt;important text&lt;/strong&gt; and &lt;em&gt;emphasized text&lt;/em&gt;.&lt;/p&gt;
&lt;p&gt;Text with &lt;mark&gt;highlighted&lt;/mark&gt; content.&lt;/p&gt;
&lt;p&gt;&lt;small&gt;Small print text&lt;/small&gt;&lt;/p&gt;
&lt;p&gt;&lt;del&gt;Deleted text&lt;/del&gt; and &lt;ins&gt;inserted text&lt;/ins&gt;&lt;/p&gt;
&lt;p&gt;Chemical formula: H&lt;sub&gt;2&lt;/sub&gt;O&lt;/p&gt;
&lt;p&gt;Mathematical expression: E=mc&lt;sup&gt;2&lt;/sup&gt;&lt;/p&gt;</code></pre>

<h4>Line Breaks and Horizontal Rules:</h4>
<pre><code>&lt;p&gt;First line&lt;br&gt;Second line&lt;/p&gt;
&lt;hr&gt; &lt;!-- Horizontal divider line --&gt;</code></pre>

<h3>Lists</h3>

<h4>Unordered Lists:</h4>
<pre><code>&lt;ul&gt;
    &lt;li&gt;First item&lt;/li&gt;
    &lt;li&gt;Second item&lt;/li&gt;
    &lt;li&gt;Third item with nested list:
        &lt;ul&gt;
            &lt;li&gt;Nested item 1&lt;/li&gt;
            &lt;li&gt;Nested item 2&lt;/li&gt;
        &lt;/ul&gt;
    &lt;/li&gt;
&lt;/ul&gt;</code></pre>

<h4>Ordered Lists:</h4>
<pre><code>&lt;ol&gt;
    &lt;li&gt;First step&lt;/li&gt;
    &lt;li&gt;Second step&lt;/li&gt;
    &lt;li&gt;Third step&lt;/li&gt;
&lt;/ol&gt;

&lt;!-- Ordered list with custom start --&gt;
&lt;ol start="5"&gt;
    &lt;li&gt;Item five&lt;/li&gt;
    &lt;li&gt;Item six&lt;/li&gt;
&lt;/ol&gt;</code></pre>

<h4>Description Lists:</h4>
<pre><code>&lt;dl&gt;
    &lt;dt&gt;HTML&lt;/dt&gt;
    &lt;dd&gt;HyperText Markup Language&lt;/dd&gt;
    
    &lt;dt&gt;CSS&lt;/dt&gt;
    &lt;dd&gt;Cascading Style Sheets&lt;/dd&gt;
    
    &lt;dt&gt;JavaScript&lt;/dt&gt;
    &lt;dd&gt;Programming language for web interactivity&lt;/dd&gt;
&lt;/dl&gt;</code></pre>

<h3>Links and Navigation</h3>

<h4>Basic Links:</h4>
<pre><code>&lt;!-- External link --&gt;
&lt;a href="https://www.google.com"&gt;Visit Google&lt;/a&gt;

&lt;!-- Internal link --&gt;
&lt;a href="about.html"&gt;About Us&lt;/a&gt;

&lt;!-- Link with target --&gt;
&lt;a href="https://www.example.com" target="_blank" rel="noopener"&gt;Open in New Tab&lt;/a&gt;

&lt;!-- Email link --&gt;
&lt;a href="mailto:contact@example.com"&gt;Send Email&lt;/a&gt;

&lt;!-- Phone link --&gt;
&lt;a href="tel:+1234567890"&gt;Call Us&lt;/a&gt;</code></pre>

<h4>Anchor Links (Same Page):</h4>
<pre><code>&lt;a href="#section1"&gt;Go to Section 1&lt;/a&gt;

&lt;!-- Target section --&gt;
&lt;section id="section1"&gt;
    &lt;h2&gt;Section 1&lt;/h2&gt;
    &lt;p&gt;Content here...&lt;/p&gt;
&lt;/section&gt;</code></pre>

<h3>Images and Media</h3>

<h4>Images:</h4>
<pre><code>&lt;!-- Basic image --&gt;
&lt;img src="image.jpg" alt="Description for accessibility"&gt;

&lt;!-- Image with size --&gt;
&lt;img src="photo.jpg" alt="Profile photo" width="300" height="200"&gt;

&lt;!-- Responsive image --&gt;
&lt;img src="image.jpg" alt="Description" style="max-width: 100%; height: auto;"&gt;

&lt;!-- Image with figure caption --&gt;
&lt;figure&gt;
    &lt;img src="chart.png" alt="Sales chart"&gt;
    &lt;figcaption&gt;Sales data for Q4 2025&lt;/figcaption&gt;
&lt;/figure&gt;</code></pre>

<h3>HTML Attributes</h3>

<h4>Global Attributes:</h4>
<pre><code>&lt;!-- ID (unique identifier) --&gt;
&lt;div id="header"&gt;Content&lt;/div&gt;

&lt;!-- Class (for CSS styling) --&gt;
&lt;p class="highlight important"&gt;Text&lt;/p&gt;

&lt;!-- Style (inline CSS) --&gt;
&lt;span style="color: red; font-weight: bold;"&gt;Red text&lt;/span&gt;

&lt;!-- Title (tooltip) --&gt;
&lt;abbr title="HyperText Markup Language"&gt;HTML&lt;/abbr&gt;

&lt;!-- Data attributes (custom data) --&gt;
&lt;div data-user-id="123" data-role="admin"&gt;User info&lt;/div&gt;</code></pre>

<h3>Comments</h3>
<pre><code>&lt;!-- This is an HTML comment --&gt;
&lt;!-- 
    Multi-line comment
    for longer explanations
--&gt;</code></pre>

<h3>Practice Exercise</h3>
<p>Create a personal webpage including:</p>
<ul>
    <li>Proper HTML5 document structure</li>
    <li>Your name as the main heading</li>
    <li>A brief introduction paragraph</li>
    <li>An ordered list of your education</li>
    <li>An unordered list of your skills</li>
    <li>A link to your favorite website</li>
    <li>A photo of yourself (or placeholder)</li>
    <li>Contact information using appropriate links</li>
</ul>
                        """,
                        "order": 1
                    }
                ]
            }
        ]
    }
    
    success_count = 0
    total_modules = len(course_structure["modules"])
    
    # Create modules and lessons
    for module_data in course_structure["modules"]:
        print(f"\\n📁 Creating module: {module_data['title']}")
        
        # Create module
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
                lesson_count = 0
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
                            print(f"      ✅ Lesson created successfully! ID: {lesson['id']}")
                            lesson_count += 1
                        else:
                            print(f"      ❌ Failed to create lesson: {lesson_response.text}")
                            
                    except Exception as e:
                        print(f"      ❌ Lesson creation error: {e}")
                    
                    # Small delay to avoid overwhelming the server
                    time.sleep(0.5)
                
                print(f"  📊 Module completed: {lesson_count}/{len(module_data['lessons'])} lessons created")
                success_count += 1
                
            else:
                print(f"  ❌ Failed to create module: {module_response.text}")
                
        except Exception as e:
            print(f"  ❌ Module creation error: {e}")
        
        # Delay between modules
        time.sleep(1)
    
    print(f"\\n🎉 Course implementation completed!")
    print(f"📊 Modules created: {success_count}/{total_modules}")
    print(f"🔗 Course ID: {course_id}")
    
    # Get final course details
    try:
        course_response = requests.get(
            f"{base_url}/instructor/courses/{course_id}",
            headers=headers,
            timeout=10
        )
        
        if course_response.status_code == 200:
            course_data = course_response.json()
            print(f"\\n📚 Final Course Summary:")
            print(f"Title: {course_data.get('title')}")
            print(f"Modules: {len(course_data.get('modules', []))}")
            
            total_lessons = sum(len(module.get('lessons', [])) for module in course_data.get('modules', []))
            print(f"Total Lessons: {total_lessons}")
            
    except Exception as e:
        print(f"Error getting final course details: {e}")

if __name__ == "__main__":
    create_modules_and_lessons()
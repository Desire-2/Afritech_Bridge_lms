#!/usr/bin/env python3
"""
Complete Remaining Modules for Web Development Course
Add CSS, JavaScript, Frameworks, and Advanced Topics
"""

import requests
import json
import time

def create_remaining_modules():
    """Create the remaining modules for a comprehensive web development course"""
    
    base_url = "http://localhost:5001/api/v1"
    course_id = 7  # The course we created
    
    # Login to get token
    login_data = {
        "identifier": "instructor@afritecbridge.com", 
        "password": "Instructor@123"
    }
    
    print("🔐 Logging in...")
    try:
        response = requests.post(f"{base_url}/auth/login", json=login_data, timeout=10)
        token = response.json().get('access_token')
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        print("✅ Login successful!")
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Additional comprehensive modules
    remaining_modules = [
        {
            "title": "Module 3: Advanced HTML5 & Forms",
            "description": "Advanced HTML5 features, accessibility, forms, and semantic markup",
            "learning_objectives": "Master HTML5 semantic elements, create accessible forms, use advanced HTML5 features",
            "order": 3,
            "lessons": [
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
    &lt;h1&gt;Website Title&lt;/h1&gt;
    &lt;nav&gt;
        &lt;ul&gt;
            &lt;li&gt;&lt;a href="#home"&gt;Home&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#about"&gt;About&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#services"&gt;Services&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#contact"&gt;Contact&lt;/a&gt;&lt;/li&gt;
        &lt;/ul&gt;
    &lt;/nav&gt;
&lt;/header&gt;

&lt;main&gt;
    &lt;section id="hero"&gt;
        &lt;h2&gt;Welcome to Our Site&lt;/h2&gt;
        &lt;p&gt;Hero section content...&lt;/p&gt;
    &lt;/section&gt;
    
    &lt;section id="articles"&gt;
        &lt;h2&gt;Latest Articles&lt;/h2&gt;
        &lt;article&gt;
            &lt;header&gt;
                &lt;h3&gt;Article Title&lt;/h3&gt;
                &lt;p&gt;Published on &lt;time datetime="2025-01-15"&gt;January 15, 2025&lt;/time&gt;&lt;/p&gt;
            &lt;/header&gt;
            &lt;p&gt;Article content...&lt;/p&gt;
            &lt;footer&gt;
                &lt;p&gt;Tags: &lt;a href="#webdev"&gt;Web Development&lt;/a&gt;&lt;/p&gt;
            &lt;/footer&gt;
        &lt;/article&gt;
    &lt;/section&gt;
    
    &lt;aside&gt;
        &lt;h3&gt;Related Links&lt;/h3&gt;
        &lt;ul&gt;
            &lt;li&gt;&lt;a href="#"&gt;Resource 1&lt;/a&gt;&lt;/li&gt;
            &lt;li&gt;&lt;a href="#"&gt;Resource 2&lt;/a&gt;&lt;/li&gt;
        &lt;/ul&gt;
    &lt;/aside&gt;
&lt;/main&gt;

&lt;footer&gt;
    &lt;p&gt;&copy; 2025 Your Website. All rights reserved.&lt;/p&gt;
    &lt;address&gt;
        Contact us at &lt;a href="mailto:info@example.com"&gt;info@example.com&lt;/a&gt;
    &lt;/address&gt;
&lt;/footer&gt;</code></pre>

<h3>Element Descriptions</h3>

<h4>&lt;header&gt;</h4>
<p>Represents introductory content or navigational aids. Can be used for page header or section headers.</p>

<h4>&lt;nav&gt;</h4>
<p>Defines navigation links. Use for main navigation, breadcrumbs, or pagination.</p>

<h4>&lt;main&gt;</h4>
<p>Represents the main content of the document. Should be unique per page.</p>

<h4>&lt;section&gt;</h4>
<p>Defines a thematic grouping of content, typically with a heading.</p>

<h4>&lt;article&gt;</h4>
<p>Self-contained content that can be distributed independently (blog post, news article).</p>

<h4>&lt;aside&gt;</h4>
<p>Content tangentially related to the main content (sidebar, call-out boxes).</p>

<h4>&lt;footer&gt;</h4>
<p>Footer for its nearest sectioning content or the page.</p>

<h3>Text-level Semantic Elements</h3>
<pre><code>&lt;!-- Time and dates --&gt;
&lt;time datetime="2025-01-15T10:30:00"&gt;January 15, 2025 at 10:30 AM&lt;/time&gt;

&lt;!-- Highlighted text --&gt;
&lt;mark&gt;Important highlighted text&lt;/mark&gt;

&lt;!-- Contact information --&gt;
&lt;address&gt;
    Written by &lt;a href="mailto:author@example.com"&gt;Author Name&lt;/a&gt;&lt;br&gt;
    Visit us at: 123 Main St, City, State
&lt;/address&gt;

&lt;!-- Quotes and citations --&gt;
&lt;blockquote cite="https://source.com"&gt;
    &lt;p&gt;This is a longer quote from an external source.&lt;/p&gt;
&lt;/blockquote&gt;
&lt;cite&gt;Source Title&lt;/cite&gt;

&lt;!-- Code and technical content --&gt;
&lt;code&gt;console.log('Hello World');&lt;/code&gt;
&lt;kbd&gt;Ctrl+C&lt;/kbd&gt;
&lt;samp&gt;Program output&lt;/samp&gt;
&lt;var&gt;variable_name&lt;/var&gt;

&lt;!-- Abbreviations --&gt;
&lt;abbr title="HyperText Markup Language"&gt;HTML&lt;/abbr&gt;

&lt;!-- Definitions --&gt;
&lt;dfn&gt;Web Development&lt;/dfn&gt; is the process of creating websites.</code></pre>

<h3>Benefits of Semantic HTML</h3>
<ul>
    <li><strong>Accessibility:</strong> Screen readers understand content structure</li>
    <li><strong>SEO:</strong> Search engines better index your content</li>
    <li><strong>Maintainability:</strong> Code is more readable and self-documenting</li>
    <li><strong>CSS Targeting:</strong> Style semantic elements instead of generic divs</li>
    <li><strong>Future-proof:</strong> Less likely to break with technology changes</li>
</ul>

<h3>Accessibility Best Practices</h3>
<ul>
    <li>Use heading hierarchy properly (h1, h2, h3...)</li>
    <li>Provide alt text for images</li>
    <li>Use semantic elements instead of divs when appropriate</li>
    <li>Include labels for form elements</li>
    <li>Ensure sufficient color contrast</li>
    <li>Make content keyboard navigable</li>
</ul>
                    """,
                    "order": 1
                },
                {
                    "title": "HTML Forms and Input Types",
                    "content_type": "text",
                    "description": "Creating interactive forms with validation and accessibility",
                    "duration_minutes": 60,
                    "content_data": """
<h2>HTML Forms and Input Types</h2>

<h3>Form Basics</h3>
<p>HTML forms allow users to input data and interact with websites. They're essential for user registration, contact forms, surveys, and more.</p>

<h3>Basic Form Structure</h3>
<pre><code>&lt;form action="/submit-form" method="POST" novalidate&gt;
    &lt;fieldset&gt;
        &lt;legend&gt;Personal Information&lt;/legend&gt;
        
        &lt;label for="firstName"&gt;First Name:&lt;/label&gt;
        &lt;input type="text" id="firstName" name="firstName" required&gt;
        
        &lt;label for="email"&gt;Email:&lt;/label&gt;
        &lt;input type="email" id="email" name="email" required&gt;
        
        &lt;button type="submit"&gt;Submit&lt;/button&gt;
        &lt;button type="reset"&gt;Reset&lt;/button&gt;
    &lt;/fieldset&gt;
&lt;/form&gt;</code></pre>

<h3>Form Attributes</h3>
<ul>
    <li><strong>action:</strong> URL where form data is sent</li>
    <li><strong>method:</strong> HTTP method (GET or POST)</li>
    <li><strong>enctype:</strong> Encoding type (multipart/form-data for file uploads)</li>
    <li><strong>target:</strong> Where to display response (_blank, _self)</li>
    <li><strong>novalidate:</strong> Disable browser validation for custom validation</li>
</ul>

<h3>Input Types</h3>

<h4>Text Inputs:</h4>
<pre><code>&lt;!-- Basic text --&gt;
&lt;input type="text" placeholder="Enter your name" maxlength="50"&gt;

&lt;!-- Password --&gt;
&lt;input type="password" placeholder="Enter password" minlength="8"&gt;

&lt;!-- Email with validation --&gt;
&lt;input type="email" placeholder="user@example.com" required&gt;

&lt;!-- URL --&gt;
&lt;input type="url" placeholder="https://example.com"&gt;

&lt;!-- Phone number --&gt;
&lt;input type="tel" placeholder="+1 (555) 123-4567"&gt;

&lt;!-- Search --&gt;
&lt;input type="search" placeholder="Search..." autocomplete="on"&gt;</code></pre>

<h4>Number and Range Inputs:</h4>
<pre><code>&lt;!-- Number input --&gt;
&lt;input type="number" min="1" max="100" step="1" value="50"&gt;

&lt;!-- Range slider --&gt;
&lt;input type="range" min="0" max="100" value="50" step="5"&gt;

&lt;!-- Age with validation --&gt;
&lt;input type="number" min="13" max="120" placeholder="Age"&gt;</code></pre>

<h4>Date and Time Inputs:</h4>
<pre><code>&lt;!-- Date picker --&gt;
&lt;input type="date" min="2025-01-01" max="2025-12-31"&gt;

&lt;!-- Time picker --&gt;
&lt;input type="time" step="300"&gt; &lt;!-- 5-minute steps --&gt;

&lt;!-- Date and time --&gt;
&lt;input type="datetime-local"&gt;

&lt;!-- Month picker --&gt;
&lt;input type="month"&gt;

&lt;!-- Week picker --&gt;
&lt;input type="week"&gt;</code></pre>

<h4>Selection Inputs:</h4>
<pre><code>&lt;!-- Checkbox --&gt;
&lt;input type="checkbox" id="newsletter" name="newsletter" value="yes"&gt;
&lt;label for="newsletter"&gt;Subscribe to newsletter&lt;/label&gt;

&lt;!-- Radio buttons --&gt;
&lt;fieldset&gt;
    &lt;legend&gt;Preferred Contact Method&lt;/legend&gt;
    &lt;input type="radio" id="email" name="contact" value="email"&gt;
    &lt;label for="email"&gt;Email&lt;/label&gt;
    
    &lt;input type="radio" id="phone" name="contact" value="phone"&gt;
    &lt;label for="phone"&gt;Phone&lt;/label&gt;
    
    &lt;input type="radio" id="sms" name="contact" value="sms"&gt;
    &lt;label for="sms"&gt;SMS&lt;/label&gt;
&lt;/fieldset&gt;</code></pre>

<h4>File and Other Inputs:</h4>
<pre><code>&lt;!-- File upload --&gt;
&lt;input type="file" accept=".jpg,.png,.pdf" multiple&gt;

&lt;!-- Image upload --&gt;
&lt;input type="file" accept="image/*" capture="camera"&gt;

&lt;!-- Color picker --&gt;
&lt;input type="color" value="#ff0000"&gt;

&lt;!-- Hidden input --&gt;
&lt;input type="hidden" name="csrf_token" value="abc123"&gt;</code></pre>

<h3>Textarea and Select Elements</h3>

<h4>Textarea:</h4>
<pre><code>&lt;label for="message"&gt;Message:&lt;/label&gt;
&lt;textarea id="message" name="message" rows="5" cols="50" 
          placeholder="Enter your message here..." 
          maxlength="500" required&gt;&lt;/textarea&gt;</code></pre>

<h4>Select Dropdown:</h4>
<pre><code>&lt;label for="country"&gt;Country:&lt;/label&gt;
&lt;select id="country" name="country" required&gt;
    &lt;option value=""&gt;-- Select a country --&lt;/option&gt;
    &lt;optgroup label="North America"&gt;
        &lt;option value="us"&gt;United States&lt;/option&gt;
        &lt;option value="ca"&gt;Canada&lt;/option&gt;
        &lt;option value="mx"&gt;Mexico&lt;/option&gt;
    &lt;/optgroup&gt;
    &lt;optgroup label="Europe"&gt;
        &lt;option value="uk"&gt;United Kingdom&lt;/option&gt;
        &lt;option value="de"&gt;Germany&lt;/option&gt;
        &lt;option value="fr"&gt;France&lt;/option&gt;
    &lt;/optgroup&gt;
&lt;/select&gt;</code></pre>

<h4>Multiple Select:</h4>
<pre><code>&lt;label for="skills"&gt;Skills (hold Ctrl to select multiple):&lt;/label&gt;
&lt;select id="skills" name="skills" multiple size="5"&gt;
    &lt;option value="html"&gt;HTML&lt;/option&gt;
    &lt;option value="css"&gt;CSS&lt;/option&gt;
    &lt;option value="javascript"&gt;JavaScript&lt;/option&gt;
    &lt;option value="react"&gt;React&lt;/option&gt;
    &lt;option value="node"&gt;Node.js&lt;/option&gt;
&lt;/select&gt;</code></pre>

<h3>Form Validation</h3>

<h4>HTML5 Validation Attributes:</h4>
<pre><code>&lt;!-- Required field --&gt;
&lt;input type="text" required&gt;

&lt;!-- Length validation --&gt;
&lt;input type="text" minlength="3" maxlength="20"&gt;

&lt;!-- Number range --&gt;
&lt;input type="number" min="18" max="100"&gt;

&lt;!-- Pattern validation (regex) --&gt;
&lt;input type="text" pattern="[A-Za-z]{3,}" 
       title="Only letters, minimum 3 characters"&gt;

&lt;!-- Email validation (built-in) --&gt;
&lt;input type="email" required&gt;

&lt;!-- Custom validation message --&gt;
&lt;input type="text" required 
       oninvalid="setCustomValidity('Please fill out this field')"
       oninput="setCustomValidity('')"&gt;</code></pre>

<h3>Complete Registration Form Example</h3>
<pre><code>&lt;form action="/register" method="POST" novalidate&gt;
    &lt;fieldset&gt;
        &lt;legend&gt;Account Information&lt;/legend&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="username"&gt;Username:&lt;/label&gt;
            &lt;input type="text" id="username" name="username" 
                   required minlength="3" maxlength="20"
                   pattern="[a-zA-Z0-9_]+" 
                   title="Only letters, numbers, and underscores"&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="email"&gt;Email:&lt;/label&gt;
            &lt;input type="email" id="email" name="email" required&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="password"&gt;Password:&lt;/label&gt;
            &lt;input type="password" id="password" name="password" 
                   required minlength="8"&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="confirmPassword"&gt;Confirm Password:&lt;/label&gt;
            &lt;input type="password" id="confirmPassword" name="confirmPassword" 
                   required&gt;
        &lt;/div&gt;
    &lt;/fieldset&gt;
    
    &lt;fieldset&gt;
        &lt;legend&gt;Personal Information&lt;/legend&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="firstName"&gt;First Name:&lt;/label&gt;
            &lt;input type="text" id="firstName" name="firstName" required&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="lastName"&gt;Last Name:&lt;/label&gt;
            &lt;input type="text" id="lastName" name="lastName" required&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="birthDate"&gt;Birth Date:&lt;/label&gt;
            &lt;input type="date" id="birthDate" name="birthDate" 
                   max="2007-01-01"&gt; &lt;!-- Must be 18+ --&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;label for="bio"&gt;Bio:&lt;/label&gt;
            &lt;textarea id="bio" name="bio" rows="4" 
                      placeholder="Tell us about yourself..." 
                      maxlength="500"&gt;&lt;/textarea&gt;
        &lt;/div&gt;
    &lt;/fieldset&gt;
    
    &lt;fieldset&gt;
        &lt;legend&gt;Preferences&lt;/legend&gt;
        
        &lt;div class="form-group"&gt;
            &lt;input type="checkbox" id="terms" name="terms" required&gt;
            &lt;label for="terms"&gt;I agree to the &lt;a href="/terms"&gt;Terms of Service&lt;/a&gt;&lt;/label&gt;
        &lt;/div&gt;
        
        &lt;div class="form-group"&gt;
            &lt;input type="checkbox" id="newsletter" name="newsletter" value="yes"&gt;
            &lt;label for="newsletter"&gt;Subscribe to our newsletter&lt;/label&gt;
        &lt;/div&gt;
    &lt;/fieldset&gt;
    
    &lt;div class="form-actions"&gt;
        &lt;button type="submit"&gt;Create Account&lt;/button&gt;
        &lt;button type="reset"&gt;Reset Form&lt;/button&gt;
    &lt;/div&gt;
&lt;/form&gt;</code></pre>

<h3>Accessibility Best Practices</h3>
<ul>
    <li>Always use labels with form controls</li>
    <li>Use fieldset and legend for grouping</li>
    <li>Provide clear error messages</li>
    <li>Use proper input types for mobile optimization</li>
    <li>Include placeholder text as guidance, not labels</li>
    <li>Ensure forms are keyboard navigable</li>
    <li>Use ARIA attributes when needed</li>
</ul>
                    """,
                    "order": 2
                },
                {
                    "title": "HTML5 Multimedia and APIs",
                    "content_type": "text",
                    "description": "Working with audio, video, canvas, and modern HTML5 APIs",
                    "duration_minutes": 50,
                    "content_data": """
<h2>HTML5 Multimedia and APIs</h2>

<h3>Audio Element</h3>
<pre><code>&lt;!-- Basic audio --&gt;
&lt;audio controls&gt;
    &lt;source src="audio.mp3" type="audio/mpeg"&gt;
    &lt;source src="audio.ogg" type="audio/ogg"&gt;
    Your browser does not support the audio element.
&lt;/audio&gt;

&lt;!-- Audio with additional attributes --&gt;
&lt;audio controls autoplay loop muted preload="auto"&gt;
    &lt;source src="background-music.mp3" type="audio/mpeg"&gt;
    &lt;source src="background-music.wav" type="audio/wav"&gt;
    &lt;p&gt;Your browser doesn't support HTML5 audio.&lt;/p&gt;
&lt;/audio&gt;</code></pre>

<h3>Video Element</h3>
<pre><code>&lt;!-- Basic video --&gt;
&lt;video controls width="640" height="360"&gt;
    &lt;source src="video.mp4" type="video/mp4"&gt;
    &lt;source src="video.webm" type="video/webm"&gt;
    &lt;source src="video.ogg" type="video/ogg"&gt;
    Your browser does not support the video tag.
&lt;/video&gt;

&lt;!-- Video with poster and tracks --&gt;
&lt;video controls poster="video-thumbnail.jpg" width="100%"&gt;
    &lt;source src="tutorial.mp4" type="video/mp4"&gt;
    &lt;source src="tutorial.webm" type="video/webm"&gt;
    
    &lt;!-- Subtitles/captions --&gt;
    &lt;track kind="subtitles" src="subtitles-en.vtt" srclang="en" label="English"&gt;
    &lt;track kind="subtitles" src="subtitles-es.vtt" srclang="es" label="Spanish"&gt;
    &lt;track kind="captions" src="captions.vtt" srclang="en" label="English Captions"&gt;
    
    &lt;p&gt;Your browser doesn't support HTML5 video.&lt;/p&gt;
&lt;/video&gt;</code></pre>

<h3>Canvas Element</h3>
<pre><code>&lt;!-- HTML --&gt;
&lt;canvas id="myCanvas" width="400" height="200"&gt;
    Your browser does not support the canvas element.
&lt;/canvas&gt;

&lt;script&gt;
// JavaScript to draw on canvas
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Draw a rectangle
ctx.fillStyle = '#FF0000';
ctx.fillRect(10, 10, 100, 50);

// Draw a circle
ctx.beginPath();
ctx.arc(200, 50, 30, 0, 2 * Math.PI);
ctx.fillStyle = '#0000FF';
ctx.fill();

// Draw text
ctx.font = '20px Arial';
ctx.fillStyle = '#000000';
ctx.fillText('Hello Canvas!', 10, 100);
&lt;/script&gt;</code></pre>

<h3>SVG Integration</h3>
<pre><code>&lt;!-- Inline SVG --&gt;
&lt;svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"&gt;
    &lt;circle cx="100" cy="100" r="50" fill="blue" stroke="black" stroke-width="2"/&gt;
    &lt;text x="100" y="105" text-anchor="middle" fill="white" font-family="Arial" font-size="16"&gt;
        SVG Circle
    &lt;/text&gt;
&lt;/svg&gt;

&lt;!-- External SVG --&gt;
&lt;img src="icon.svg" alt="Icon" width="50" height="50"&gt;
&lt;object data="graphic.svg" type="image/svg+xml"&gt;&lt;/object&gt;</code></pre>

<h3>Responsive Images</h3>
<pre><code>&lt;!-- Responsive image with srcset --&gt;
&lt;img src="image-400.jpg" 
     srcset="image-400.jpg 400w, 
             image-800.jpg 800w, 
             image-1200.jpg 1200w"
     sizes="(max-width: 400px) 100vw, 
            (max-width: 800px) 50vw, 
            25vw"
     alt="Responsive image"&gt;

&lt;!-- Picture element for art direction --&gt;
&lt;picture&gt;
    &lt;source media="(max-width: 799px)" srcset="mobile-image.jpg"&gt;
    &lt;source media="(min-width: 800px)" srcset="desktop-image.jpg"&gt;
    &lt;img src="fallback-image.jpg" alt="Responsive image"&gt;
&lt;/picture&gt;</code></pre>

<h3>HTML5 Form Enhancements</h3>
<pre><code>&lt;!-- Progress bar --&gt;
&lt;label for="progress"&gt;Download progress:&lt;/label&gt;
&lt;progress id="progress" value="75" max="100"&gt;75%&lt;/progress&gt;

&lt;!-- Meter element --&gt;
&lt;label for="disk"&gt;Disk usage:&lt;/label&gt;
&lt;meter id="disk" value="0.6" min="0" max="1"&gt;60%&lt;/meter&gt;

&lt;!-- Details/Summary collapsible content --&gt;
&lt;details&gt;
    &lt;summary&gt;Click to expand&lt;/summary&gt;
    &lt;p&gt;This content is hidden by default and can be toggled.&lt;/p&gt;
    &lt;ul&gt;
        &lt;li&gt;Item 1&lt;/li&gt;
        &lt;li&gt;Item 2&lt;/li&gt;
    &lt;/ul&gt;
&lt;/details&gt;</code></pre>

<h3>Data Attributes</h3>
<pre><code>&lt;!-- HTML --&gt;
&lt;div id="user-card" 
     data-user-id="123" 
     data-role="admin" 
     data-last-login="2025-01-15"&gt;
    User Information
&lt;/div&gt;

&lt;script&gt;
// JavaScript access to data attributes
const userCard = document.getElementById('user-card');

// Getting data attributes
const userId = userCard.dataset.userId; // "123"
const role = userCard.dataset.role; // "admin"
const lastLogin = userCard.dataset.lastLogin; // "2025-01-15"

// Setting data attributes
userCard.dataset.status = 'active';
userCard.dataset.theme = 'dark';
&lt;/script&gt;</code></pre>

<h3>Geolocation API</h3>
<pre><code>&lt;button onclick="getLocation()"&gt;Get My Location&lt;/button&gt;
&lt;p id="location"&gt;&lt;/p&gt;

&lt;script&gt;
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, showError);
    } else {
        document.getElementById("location").innerHTML = 
            "Geolocation is not supported by this browser.";
    }
}

function showPosition(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    document.getElementById("location").innerHTML = 
        `Latitude: ${lat}, Longitude: ${lon}`;
}

function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            document.getElementById("location").innerHTML = 
                "User denied the request for Geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            document.getElementById("location").innerHTML = 
                "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            document.getElementById("location").innerHTML = 
                "The request to get user location timed out.";
            break;
        default:
            document.getElementById("location").innerHTML = 
                "An unknown error occurred.";
            break;
    }
}
&lt;/script&gt;</code></pre>

<h3>Local Storage</h3>
<pre><code>&lt;script&gt;
// Check for storage support
if (typeof(Storage) !== "undefined") {
    // Store data
    localStorage.setItem("username", "john_doe");
    localStorage.setItem("preferences", JSON.stringify({
        theme: "dark",
        language: "en"
    }));
    
    // Retrieve data
    const username = localStorage.getItem("username");
    const preferences = JSON.parse(localStorage.getItem("preferences"));
    
    // Remove item
    localStorage.removeItem("username");
    
    // Clear all storage
    localStorage.clear();
    
    // Session storage (cleared when tab closes)
    sessionStorage.setItem("temp_data", "temporary value");
} else {
    console.log("Web Storage not supported");
}
&lt;/script&gt;</code></pre>

<h3>Drag and Drop API</h3>
<pre><code>&lt;style&gt;
.dropzone {
    width: 300px;
    height: 200px;
    border: 2px dashed #ccc;
    text-align: center;
    padding: 20px;
    margin: 20px;
}
.dropzone.dragover {
    border-color: #007bff;
    background-color: #f8f9fa;
}
&lt;/style&gt;

&lt;div id="dragItem" draggable="true"&gt;Drag me!&lt;/div&gt;
&lt;div id="dropZone" class="dropzone"&gt;Drop here&lt;/div&gt;

&lt;script&gt;
const dragItem = document.getElementById('dragItem');
const dropZone = document.getElementById('dropZone');

// Drag events
dragItem.addEventListener('dragstart', function(e) {
    e.dataTransfer.setData('text/plain', 'Hello World');
});

// Drop zone events
dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', function(e) {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const data = e.dataTransfer.getData('text/plain');
    dropZone.innerHTML = `Dropped: ${data}`;
});
&lt;/script&gt;</code></pre>

<h3>File API</h3>
<pre><code>&lt;input type="file" id="fileInput" multiple accept="image/*"&gt;
&lt;div id="preview"&gt;&lt;/div&gt;

&lt;script&gt;
document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = e.target.files;
    const preview = document.getElementById('preview');
    preview.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '200px';
                img.style.margin = '10px';
                preview.appendChild(img);
            };
            
            reader.readAsDataURL(file);
        }
    }
});
&lt;/script&gt;</code></pre>

<h3>Web Workers (Basic Example)</h3>
<pre><code>&lt;!-- Main HTML --&gt;
&lt;button onclick="startWorker()"&gt;Start Worker&lt;/button&gt;
&lt;button onclick="stopWorker()"&gt;Stop Worker&lt;/button&gt;
&lt;p id="result"&gt;&lt;/p&gt;

&lt;script&gt;
let worker;

function startWorker() {
    if (typeof(Worker) !== "undefined") {
        if (typeof(worker) == "undefined") {
            worker = new Worker("worker.js");
        }
        
        worker.onmessage = function(event) {
            document.getElementById("result").innerHTML = event.data;
        };
        
        worker.postMessage("start");
    } else {
        document.getElementById("result").innerHTML = 
            "Sorry, your browser does not support Web Workers.";
    }
}

function stopWorker() {
    if (worker) {
        worker.terminate();
        worker = undefined;
    }
}
&lt;/script&gt;

&lt;!-- worker.js file --&gt;
let i = 0;

function timedCount() {
    i++;
    postMessage(i);
    setTimeout(timedCount, 500);
}

timedCount();
&lt;/script&gt;</code></pre>
                    """,
                    "order": 3
                }
            ]
        },
        {
            "title": "Module 4: CSS3 Fundamentals & Styling",
            "description": "Master CSS styling, selectors, layout techniques, and responsive design",
            "learning_objectives": "Style web pages effectively, create responsive layouts, use CSS Grid and Flexbox",
            "order": 4,
            "lessons": [
                {
                    "title": "CSS Fundamentals and Selectors",
                    "content_type": "text",
                    "description": "Learn CSS syntax, selectors, properties, and values",
                    "duration_minutes": 55,
                    "content_data": """
<h2>CSS Fundamentals and Selectors</h2>

<h3>What is CSS?</h3>
<p>CSS (Cascading Style Sheets) controls the presentation and layout of HTML documents. It separates content from design, making websites more maintainable and flexible.</p>

<h3>CSS Syntax</h3>
<pre><code>selector {
    property: value;
    property: value;
}

/* Example */
h1 {
    color: blue;
    font-size: 24px;
    text-align: center;
}</code></pre>

<h3>Adding CSS to HTML</h3>

<h4>1. External CSS (Recommended):</h4>
<pre><code>&lt;!-- In HTML head --&gt;
&lt;link rel="stylesheet" href="styles.css"&gt;

/* In styles.css */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
}</code></pre>

<h4>2. Internal CSS:</h4>
<pre><code>&lt;head&gt;
    &lt;style&gt;
        body {
            background-color: #f0f0f0;
        }
        h1 {
            color: navy;
        }
    &lt;/style&gt;
&lt;/head&gt;</code></pre>

<h4>3. Inline CSS (Use sparingly):</h4>
<pre><code>&lt;p style="color: red; font-weight: bold;"&gt;Styled text&lt;/p&gt;</code></pre>

<h3>CSS Selectors</h3>

<h4>Basic Selectors:</h4>
<pre><code>/* Element selector */
p { color: black; }
h1 { font-size: 2em; }

/* Class selector */
.highlight { background-color: yellow; }
.error { color: red; }

/* ID selector */
#header { background-color: navy; }
#main-content { max-width: 1200px; }

/* Universal selector */
* { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box;
}</code></pre>

<h4>Attribute Selectors:</h4>
<pre><code>/* Attribute exists */
[title] { cursor: help; }

/* Attribute equals exact value */
[type="email"] { border: 2px solid green; }

/* Attribute starts with value */
[href^="https"] { color: green; }
[href^="mailto"] { color: blue; }

/* Attribute ends with value */
[href$=".pdf"] { color: red; }
[src$=".jpg"] { border: 1px solid gray; }

/* Attribute contains value */
[class*="btn"] { padding: 10px; }
[alt*="photo"] { border-radius: 5px; }</code></pre>

<h4>Pseudo-classes:</h4>
<pre><code>/* Link states */
a:link { color: blue; text-decoration: none; }
a:visited { color: purple; }
a:hover { color: red; text-decoration: underline; }
a:active { color: orange; }
a:focus { outline: 2px solid blue; }

/* Form states */
input:focus { border-color: blue; }
input:valid { border-color: green; }
input:invalid { border-color: red; }
input:disabled { opacity: 0.5; }
input:checked + label { font-weight: bold; }

/* Structural pseudo-classes */
li:first-child { font-weight: bold; }
li:last-child { margin-bottom: 0; }
li:nth-child(odd) { background-color: #f9f9f9; }
li:nth-child(even) { background-color: #e9e9e9; }
li:nth-child(3n) { color: blue; } /* Every 3rd element */

/* Content-based */
p:empty { display: none; }
div:not(.special) { color: gray; }</code></pre>

<h4>Pseudo-elements:</h4>
<pre><code>/* Before and after content */
p::before { 
    content: "📝 "; 
    color: blue;
}
p::after { 
    content: " ✓"; 
    color: green;
}

/* First line and letter styling */
p::first-line { 
    font-weight: bold; 
    text-transform: uppercase;
}
p::first-letter { 
    font-size: 3em; 
    float: left;
    line-height: 1;
    margin-right: 8px;
}

/* Selection styling */
::selection {
    background-color: #ff6b6b;
    color: white;
}

/* Placeholder styling */
input::placeholder {
    color: #999;
    font-style: italic;
}</code></pre>

<h4>Combinator Selectors:</h4>
<pre><code>/* Descendant selector (any nested level) */
div p { color: blue; }
.container span { font-weight: bold; }

/* Child selector (direct children only) */
ul > li { list-style-type: disc; }
.nav > a { display: inline-block; }

/* Adjacent sibling (immediately following) */
h1 + p { margin-top: 0; font-size: 1.2em; }
img + figcaption { font-style: italic; }

/* General sibling (any following sibling) */
h1 ~ p { color: gray; }
.warning ~ input { border-color: orange; }</code></pre>

<h3>CSS Specificity</h3>
<p>Specificity determines which CSS rule applies when multiple rules target the same element:</p>
<ol>
    <li><strong>Inline styles:</strong> 1000 points</li>
    <li><strong>IDs:</strong> 100 points each</li>
    <li><strong>Classes, attributes, pseudo-classes:</strong> 10 points each</li>
    <li><strong>Elements and pseudo-elements:</strong> 1 point each</li>
</ol>

<pre><code>/* Examples of specificity calculation */
p { color: black; }                    /* 1 point */
.text { color: blue; }                 /* 10 points */
#main { color: red; }                  /* 100 points */
div.text { color: green; }             /* 11 points */
#main p.text { color: purple; }        /* 111 points */
style="color: orange"                  /* 1000 points */

/* Use !important sparingly */
p { color: yellow !important; }        /* Overrides most other rules */</code></pre>

<h3>Common CSS Properties</h3>

<h4>Text Properties:</h4>
<pre><code>.text-styling {
    color: #333;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 16px;
    font-weight: bold; /* normal, bold, 100-900 */
    font-style: italic; /* normal, italic, oblique */
    text-align: center; /* left, right, center, justify */
    text-decoration: underline; /* none, underline, line-through */
    text-transform: uppercase; /* none, uppercase, lowercase, capitalize */
    line-height: 1.5; /* 1.5 times font size */
    letter-spacing: 1px;
    word-spacing: 2px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}</code></pre>

<h4>Background Properties:</h4>
<pre><code>.background-styling {
    background-color: #f0f0f0;
    background-image: url('background.jpg');
    background-repeat: no-repeat; /* repeat, repeat-x, repeat-y */
    background-position: center top; /* positions or keywords */
    background-size: cover; /* contain, cover, or specific size */
    background-attachment: fixed; /* scroll, fixed, local */
    
    /* Shorthand property */
    background: #f0f0f0 url('bg.jpg') no-repeat center/cover fixed;
    
    /* Multiple backgrounds */
    background: 
        url('overlay.png') repeat-x top,
        url('main-bg.jpg') no-repeat center/cover;
}</code></pre>

<h4>Border Properties:</h4>
<pre><code>.border-styling {
    /* Individual properties */
    border-width: 2px;
    border-style: solid; /* none, solid, dashed, dotted, double */
    border-color: #333;
    
    /* Shorthand */
    border: 2px solid #333;
    
    /* Individual sides */
    border-top: 3px dashed red;
    border-right: 1px solid blue;
    border-bottom: 2px dotted green;
    border-left: 4px double purple;
    
    /* Border radius for rounded corners */
    border-radius: 10px;
    border-radius: 10px 20px; /* top-left/bottom-right, top-right/bottom-left */
    border-radius: 10px 20px 15px 5px; /* clockwise from top-left */
    
    /* Box shadow */
    box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
    box-shadow: inset 0 0 10px rgba(255,255,255,0.5); /* inset shadow */
}</code></pre>

<h3>CSS Variables (Custom Properties)</h3>
<pre><code>/* Define variables in :root */
:root {
    --primary-color: #3498db;
    --secondary-color: #2ecc71;
    --font-size-large: 24px;
    --border-radius: 8px;
    --shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Use variables */
.button {
    background-color: var(--primary-color);
    font-size: var(--font-size-large);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    
    /* Fallback value */
    color: var(--text-color, #ffffff);
}

/* Override variables in specific contexts */
.dark-theme {
    --primary-color: #2c3e50;
    --secondary-color: #34495e;
}</code></pre>

<h3>CSS Comments</h3>
<pre><code>/* Single line comment */

/*
Multi-line comment
for longer explanations
or temporarily disabling code
*/

/* TODO: Add responsive styles */
/* FIXME: Border not showing correctly in IE */</code></pre>

<h3>Practice Exercise</h3>
<p>Create a styled webpage with:</p>
<ul>
    <li>Navigation menu with hover effects</li>
    <li>Styled headings with custom fonts</li>
    <li>Card components with borders and shadows</li>
    <li>Buttons with different states (hover, active, disabled)</li>
    <li>Use CSS variables for consistent theming</li>
</ul>
                    """,
                    "order": 1
                }
            ]
        }
    ]
    
    # Create the additional modules
    for module_data in remaining_modules:
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
    
    print(f"\\n🎉 Additional modules creation completed!")

if __name__ == "__main__":
    create_remaining_modules()
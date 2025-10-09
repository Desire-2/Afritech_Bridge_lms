#!/usr/bin/env python3
"""
Script to create comprehensive assessments for the Web Development Bootcamp 2025 course
Includes quizzes, assignments, and projects for each module
"""

import requests
import json
from datetime import datetime, timedelta

class WebDevAssessmentsCreator:
    def __init__(self):
        self.base_url = 'http://localhost:5001/api/v1'
        self.token = None
        self.course_id = 7  # Complete Web Development Bootcamp 2025
        self.modules = {}
        
    def login(self):
        """Login with instructor credentials"""
        login_data = {
            'identifier': 'instructor@afritecbridge.com',
            'password': 'Instructor@123'
        }
        
        response = requests.post(f'{self.base_url}/auth/login', json=login_data, timeout=10)
        if response.status_code == 200:
            self.token = response.json().get('access_token')
            print("✅ Login successful")
            return True
        else:
            print(f"❌ Login failed: {response.text}")
            return False
    
    def get_headers(self):
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def get_course_structure(self):
        """Get course modules and lessons structure"""
        response = requests.get(
            f'{self.base_url}/instructor/courses/{self.course_id}',
            headers=self.get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            course_data = response.json()
            for module in course_data.get('modules', []):
                self.modules[module['id']] = {
                    'title': module['title'],
                    'lessons': module.get('lessons', [])
                }
            print(f"✅ Found {len(self.modules)} modules")
            return True
        else:
            print(f"❌ Failed to get course structure: {response.text}")
            return False
    
    def create_quiz(self, title, description, course_id, module_id=None, lesson_id=None):
        """Create a quiz"""
        quiz_data = {
            'title': title,
            'description': description,
            'course_id': course_id,
            'module_id': module_id,
            'lesson_id': lesson_id,
            'is_published': True
        }
        
        response = requests.post(
            f'{self.base_url}/instructor/assessments/quizzes',
            headers=self.get_headers(),
            json=quiz_data,
            timeout=10
        )
        
        if response.status_code == 201:
            quiz = response.json().get('quiz')
            print(f"✅ Created quiz: {title}")
            return quiz['id']
        else:
            print(f"❌ Failed to create quiz '{title}': {response.text}")
            return None
    
    def add_quiz_question(self, quiz_id, text, question_type, answers):
        """Add a question to a quiz"""
        question_data = {
            'text': text,
            'question_type': question_type,
            'answers': answers
        }
        
        response = requests.post(
            f'{self.base_url}/instructor/assessments/quizzes/{quiz_id}/questions',
            headers=self.get_headers(),
            json=question_data,
            timeout=10
        )
        
        if response.status_code == 201:
            return True
        else:
            print(f"❌ Failed to add question: {response.text}")
            return False
    
    def create_assignment(self, title, description, instructions, course_id, module_id=None, due_days=7):
        """Create an assignment"""
        due_date = (datetime.now() + timedelta(days=due_days)).isoformat()
        
        assignment_data = {
            'title': title,
            'description': description,
            'instructions': instructions,
            'course_id': course_id,
            'module_id': module_id,
            'assignment_type': 'both',
            'max_file_size_mb': 25,
            'allowed_file_types': '["html", "css", "js", "zip", "pdf", "txt", "md"]',
            'due_date': due_date,
            'points_possible': 100.0,
            'is_published': True
        }
        
        response = requests.post(
            f'{self.base_url}/instructor/assessments/assignments',
            headers=self.get_headers(),
            json=assignment_data,
            timeout=10
        )
        
        if response.status_code == 201:
            assignment = response.json().get('assignment')
            print(f"✅ Created assignment: {title}")
            return assignment['id']
        else:
            print(f"❌ Failed to create assignment '{title}': {response.text}")
            return None
    
    def create_project(self, title, description, objectives, course_id, module_ids, due_days=14):
        """Create a project"""
        due_date = (datetime.now() + timedelta(days=due_days)).isoformat()
        
        project_data = {
            'title': title,
            'description': description,
            'objectives': objectives,
            'course_id': course_id,
            'module_ids': module_ids,
            'due_date': due_date,
            'points_possible': 200.0,
            'submission_format': 'both',
            'max_file_size_mb': 100,
            'allowed_file_types': '["html", "css", "js", "zip", "pdf", "txt", "md", "png", "jpg", "gif"]',
            'collaboration_allowed': False,
            'max_team_size': 1,
            'is_published': True
        }
        
        response = requests.post(
            f'{self.base_url}/instructor/assessments/projects',
            headers=self.get_headers(),
            json=project_data,
            timeout=10
        )
        
        if response.status_code == 201:
            project = response.json().get('project')
            print(f"✅ Created project: {title}")
            return project['id']
        else:
            print(f"❌ Failed to create project '{title}': {response.text}")
            return None

    def create_fundamentals_quiz(self, module_id):
        """Create quiz for Web Development Fundamentals module"""
        quiz_id = self.create_quiz(
            "Web Development Fundamentals Quiz",
            "Test your understanding of web development basics, internet fundamentals, and development environment setup.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'What does HTML stand for?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'HyperText Markup Language', 'is_correct': True},
                    {'text': 'High Tech Modern Language', 'is_correct': False},
                    {'text': 'Home Tool Markup Language', 'is_correct': False},
                    {'text': 'Hyperlink and Text Markup Language', 'is_correct': False}
                ]
            },
            {
                'text': 'Which protocol is used for secure web communication?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'HTTP', 'is_correct': False},
                    {'text': 'HTTPS', 'is_correct': True},
                    {'text': 'FTP', 'is_correct': False},
                    {'text': 'SSH', 'is_correct': False}
                ]
            },
            {
                'text': 'A web browser is a client-side application.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': True},
                    {'text': 'False', 'is_correct': False}
                ]
            },
            {
                'text': 'What is the purpose of a code editor in web development?',
                'type': 'short_answer',
                'answers': [
                    {'text': 'A code editor provides syntax highlighting, auto-completion, and debugging tools to help developers write and maintain code efficiently.', 'is_correct': True}
                ]
            },
            {
                'text': 'Which of the following are front-end technologies? (Select all that apply)',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'HTML', 'is_correct': True},
                    {'text': 'CSS', 'is_correct': True},
                    {'text': 'JavaScript', 'is_correct': True},
                    {'text': 'MySQL', 'is_correct': False}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_html_fundamentals_quiz(self, module_id):
        """Create quiz for HTML5 Fundamentals module"""
        quiz_id = self.create_quiz(
            "HTML5 Fundamentals Quiz",
            "Test your knowledge of HTML5 elements, semantic markup, and document structure.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'Which HTML5 element is used for the main content of a document?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': '<main>', 'is_correct': True},
                    {'text': '<content>', 'is_correct': False},
                    {'text': '<body>', 'is_correct': False},
                    {'text': '<section>', 'is_correct': False}
                ]
            },
            {
                'text': 'What is the correct HTML5 doctype declaration?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': '<!DOCTYPE html>', 'is_correct': True},
                    {'text': '<!DOCTYPE HTML5>', 'is_correct': False},
                    {'text': '<DOCTYPE html>', 'is_correct': False},
                    {'text': '<!DOCTYPE html5>', 'is_correct': False}
                ]
            },
            {
                'text': 'Semantic HTML elements improve accessibility and SEO.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': True},
                    {'text': 'False', 'is_correct': False}
                ]
            },
            {
                'text': 'Explain the difference between <div> and <section> elements.',
                'type': 'short_answer',
                'answers': [
                    {'text': '<section> is semantic and represents a distinct section of content, while <div> is generic and used for styling or grouping without semantic meaning.', 'is_correct': True}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_advanced_html_quiz(self, module_id):
        """Create quiz for Advanced HTML5 & Forms module"""
        quiz_id = self.create_quiz(
            "Advanced HTML5 & Forms Quiz",
            "Test your understanding of HTML5 forms, input types, validation, and multimedia elements.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'Which HTML5 input type is used for email validation?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'type="email"', 'is_correct': True},
                    {'text': 'type="text"', 'is_correct': False},
                    {'text': 'type="mail"', 'is_correct': False},
                    {'text': 'type="validate-email"', 'is_correct': False}
                ]
            },
            {
                'text': 'The required attribute can be used on form inputs for client-side validation.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': True},
                    {'text': 'False', 'is_correct': False}
                ]
            },
            {
                'text': 'What is the purpose of the <label> element in forms?',
                'type': 'short_answer',
                'answers': [
                    {'text': 'The <label> element associates descriptive text with form controls, improving accessibility and usability by allowing users to click the label to focus the input.', 'is_correct': True}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_css_fundamentals_quiz(self, module_id):
        """Create quiz for CSS3 Fundamentals module"""
        quiz_id = self.create_quiz(
            "CSS3 Fundamentals Quiz",
            "Test your knowledge of CSS syntax, selectors, properties, and styling basics.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'Which CSS property is used to change the text color?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'color', 'is_correct': True},
                    {'text': 'text-color', 'is_correct': False},
                    {'text': 'font-color', 'is_correct': False},
                    {'text': 'text-style', 'is_correct': False}
                ]
            },
            {
                'text': 'CSS stands for Cascading Style Sheets.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': True},
                    {'text': 'False', 'is_correct': False}
                ]
            },
            {
                'text': 'Explain the CSS box model.',
                'type': 'short_answer',
                'answers': [
                    {'text': 'The CSS box model consists of content, padding, border, and margin. Content is the actual element, padding is space inside the border, border surrounds the padding, and margin is space outside the border.', 'is_correct': True}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_advanced_css_quiz(self, module_id):
        """Create quiz for Advanced CSS & Layout module"""
        quiz_id = self.create_quiz(
            "Advanced CSS & Layout Quiz",
            "Test your understanding of Flexbox, Grid, responsive design, and advanced CSS concepts.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'Which CSS property is used to create a flex container?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'display: flex', 'is_correct': True},
                    {'text': 'flex: container', 'is_correct': False},
                    {'text': 'layout: flex', 'is_correct': False},
                    {'text': 'position: flex', 'is_correct': False}
                ]
            },
            {
                'text': 'CSS Grid is better than Flexbox for two-dimensional layouts.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': True},
                    {'text': 'False', 'is_correct': False}
                ]
            },
            {
                'text': 'What is the purpose of media queries in responsive design?',
                'type': 'short_answer',
                'answers': [
                    {'text': 'Media queries allow CSS styles to be applied conditionally based on device characteristics like screen width, height, or orientation, enabling responsive design for different devices.', 'is_correct': True}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_javascript_fundamentals_quiz(self, module_id):
        """Create quiz for JavaScript Fundamentals module"""
        quiz_id = self.create_quiz(
            "JavaScript Fundamentals Quiz",
            "Test your knowledge of JavaScript syntax, variables, functions, and basic programming concepts.",
            self.course_id,
            module_id
        )
        
        if not quiz_id:
            return False
        
        questions = [
            {
                'text': 'Which keyword is used to declare a variable in modern JavaScript?',
                'type': 'multiple_choice',
                'answers': [
                    {'text': 'let', 'is_correct': True},
                    {'text': 'var', 'is_correct': False},
                    {'text': 'variable', 'is_correct': False},
                    {'text': 'declare', 'is_correct': False}
                ]
            },
            {
                'text': 'JavaScript is a statically typed language.',
                'type': 'true_false',
                'answers': [
                    {'text': 'True', 'is_correct': False},
                    {'text': 'False', 'is_correct': True}
                ]
            },
            {
                'text': 'Explain the difference between let, const, and var in JavaScript.',
                'type': 'short_answer',
                'answers': [
                    {'text': 'let has block scope and can be reassigned, const has block scope and cannot be reassigned, var has function scope and can be reassigned. let and const were introduced in ES6 and are preferred over var.', 'is_correct': True}
                ]
            }
        ]
        
        for q in questions:
            self.add_quiz_question(quiz_id, q['text'], q['type'], q['answers'])
        
        return True

    def create_assignments(self):
        """Create practical coding assignments for each module"""
        print("\n🎯 Creating Assignments...")
        
        # Get module IDs
        module_ids = list(self.modules.keys())
        
        assignments = [
            {
                'title': 'Personal Portfolio HTML Structure',
                'description': 'Create the basic HTML structure for a personal portfolio website.',
                'instructions': '''Create an HTML file with the following requirements:
                
1. Proper HTML5 doctype and document structure
2. Semantic HTML elements (header, nav, main, section, footer)
3. At least 5 different sections: About, Skills, Projects, Experience, Contact
4. Use appropriate heading hierarchy (h1, h2, h3)
5. Include meta tags for viewport and description
6. Add placeholder content for each section
7. Validate your HTML using W3C validator

Submit both the HTML file and a screenshot of the validator results.''',
                'module_id': module_ids[1] if len(module_ids) > 1 else None,  # HTML Fundamentals
                'due_days': 7
            },
            {
                'title': 'Interactive Contact Form',
                'description': 'Build a complete contact form with validation using HTML5 form features.',
                'instructions': '''Create a contact form with the following requirements:
                
1. Form fields: Name, Email, Phone, Subject, Message
2. Use appropriate HTML5 input types (email, tel, etc.)
3. Implement client-side validation with required fields
4. Add placeholders and labels for accessibility
5. Include a submit and reset button
6. Style the form with basic CSS for better presentation
7. Test form validation by trying to submit invalid data

Submit the HTML file with embedded CSS and a demo video showing the validation in action.''',
                'module_id': module_ids[2] if len(module_ids) > 2 else None,  # Advanced HTML & Forms
                'due_days': 10
            },
            {
                'title': 'Responsive Card Layout',
                'description': 'Create a responsive card layout using CSS Flexbox or Grid.',
                'instructions': '''Design a responsive card layout with the following specifications:
                
1. Create at least 6 cards with image, title, description, and button
2. Use CSS Flexbox or Grid for layout
3. Implement responsive design (mobile-first approach)
4. Cards should stack on mobile and show in rows on desktop
5. Add hover effects and smooth transitions
6. Use CSS custom properties (variables) for consistent theming
7. Ensure proper spacing and typography

Submit HTML and CSS files, plus screenshots showing mobile and desktop views.''',
                'module_id': module_ids[4] if len(module_ids) > 4 else None,  # Advanced CSS & Layout
                'due_days': 12
            },
            {
                'title': 'Interactive Todo List',
                'description': 'Build a functional todo list application using JavaScript.',
                'instructions': '''Create an interactive todo list with the following features:
                
1. Add new todo items with input validation
2. Mark items as complete/incomplete
3. Delete individual todo items
4. Clear all completed items
5. Display count of remaining items
6. Use local storage to persist data
7. Implement proper event handling
8. Add CSS styling for better user experience

Submit HTML, CSS, and JavaScript files, plus a demo video showing all functionality.''',
                'module_id': module_ids[5] if len(module_ids) > 5 else None,  # JavaScript Fundamentals
                'due_days': 14
            }
        ]
        
        for assignment in assignments:
            self.create_assignment(
                assignment['title'],
                assignment['description'],
                assignment['instructions'],
                self.course_id,
                assignment['module_id'],
                assignment['due_days']
            )

    def create_projects(self):
        """Create comprehensive projects for the course"""
        print("\n🚀 Creating Projects...")
        
        module_ids = list(self.modules.keys())
        
        projects = [
            {
                'title': 'Complete Business Website',
                'description': 'Create a full business website showcasing all HTML and CSS skills learned.',
                'objectives': '''Learning Objectives:
- Apply semantic HTML structure to create a professional website
- Implement responsive design using CSS Grid and Flexbox
- Demonstrate understanding of accessibility best practices
- Create interactive navigation and user-friendly interface
- Optimize for different devices and screen sizes''',
                'module_ids': module_ids[:4],  # First 4 modules
                'due_days': 21
            },
            {
                'title': 'Interactive Web Application',
                'description': 'Build a complete interactive web application using HTML, CSS, and JavaScript.',
                'objectives': '''Learning Objectives:
- Integrate HTML, CSS, and JavaScript to create a functional application
- Implement user interaction and dynamic content manipulation
- Use local storage for data persistence
- Apply responsive design principles
- Demonstrate problem-solving skills and code organization''',
                'module_ids': module_ids,  # All modules
                'due_days': 28
            }
        ]
        
        for project in projects:
            self.create_project(
                project['title'],
                project['description'],
                project['objectives'],
                self.course_id,
                project['module_ids'],
                project['due_days']
            )

    def run(self):
        """Main execution function"""
        print("🎓 Creating Comprehensive Web Development Assessments")
        print("=" * 60)
        
        if not self.login():
            return False
        
        if not self.get_course_structure():
            return False
        
        print(f"\n📚 Course Structure:")
        for module_id, module_info in self.modules.items():
            print(f"  Module {module_id}: {module_info['title']} ({len(module_info['lessons'])} lessons)")
        
        # Create quizzes for each module
        print("\n📝 Creating Quizzes...")
        module_ids = list(self.modules.keys())
        
        if len(module_ids) >= 1:
            self.create_fundamentals_quiz(module_ids[0])
        if len(module_ids) >= 2:
            self.create_html_fundamentals_quiz(module_ids[1])
        if len(module_ids) >= 3:
            self.create_advanced_html_quiz(module_ids[2])
        if len(module_ids) >= 4:
            self.create_css_fundamentals_quiz(module_ids[3])
        if len(module_ids) >= 5:
            self.create_advanced_css_quiz(module_ids[4])
        if len(module_ids) >= 6:
            self.create_javascript_fundamentals_quiz(module_ids[5])
        
        # Create assignments
        self.create_assignments()
        
        # Create projects
        self.create_projects()
        
        print(f"\n✅ Assessment creation completed!")
        print("Created comprehensive assessments including:")
        print("  • 6 Module quizzes with diverse question types")
        print("  • 4 Practical coding assignments")
        print("  • 2 Comprehensive projects")
        print("  • All assessments are published and ready for students")
        
        return True

if __name__ == "__main__":
    creator = WebDevAssessmentsCreator()
    creator.run()
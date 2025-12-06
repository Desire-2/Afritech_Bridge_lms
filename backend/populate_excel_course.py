#!/usr/bin/env python3
"""
Populate Microsoft Excel Mastery Course (ID 9) with modules, lessons, quizzes, and assignments.
"""

import requests
import json

BASE_URL = "http://localhost:5001/api/v1"
COURSE_ID = 9

# Login credentials
credentials = {
    "identifier": "instructor@afritecbridge.com",
    "password": "Instructor@123"
}

def login():
    """Login and get access token"""
    print("🔐 Logging in...")
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code == 200:
        data = response.json()
        print("✅ Login successful!")
        return data.get("access_token")
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def get_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def create_module(token, title, description, order):
    """Create a module in the course"""
    print(f"\n📦 Creating module: {title}")
    data = {
        "title": title,
        "description": description,
        "order": order,
        "is_published": True
    }
    response = requests.post(
        f"{BASE_URL}/instructor/courses/{COURSE_ID}/modules",
        headers=get_headers(token),
        json=data
    )
    if response.status_code == 201:
        module = response.json().get("module", {})
        print(f"   ✅ Module created with ID: {module.get('id')}")
        return module.get("id")
    else:
        print(f"   ❌ Failed: {response.text}")
        return None

def create_lesson(token, module_id, title, content_type, content_data, description, order, duration=15):
    """Create a lesson in a module"""
    print(f"   📄 Creating lesson: {title}")
    data = {
        "title": title,
        "content_type": content_type,
        "content_data": content_data,
        "description": description,
        "order": order,
        "duration_minutes": duration,
        "is_published": True
    }
    response = requests.post(
        f"{BASE_URL}/instructor/courses/{COURSE_ID}/modules/{module_id}/lessons",
        headers=get_headers(token),
        json=data
    )
    if response.status_code == 201:
        lesson = response.json().get("lesson", {})
        print(f"      ✅ Lesson created with ID: {lesson.get('id')}")
        return lesson.get("id")
    else:
        print(f"      ❌ Failed: {response.text}")
        return None

def create_quiz(token, module_id, lesson_id, title, description, questions):
    """Create a quiz with questions"""
    print(f"   📝 Creating quiz: {title}")
    data = {
        "title": title,
        "description": description,
        "course_id": COURSE_ID,
        "module_id": module_id,
        "lesson_id": lesson_id,
        "is_published": True,
        "time_limit": 15,
        "max_attempts": 3,
        "passing_score": 70,
        "questions": questions
    }
    response = requests.post(
        f"{BASE_URL}/instructor/assessments/quizzes",
        headers=get_headers(token),
        json=data
    )
    if response.status_code == 201:
        quiz = response.json().get("quiz", {})
        print(f"      ✅ Quiz created with ID: {quiz.get('id')}")
        return quiz.get("id")
    else:
        print(f"      ❌ Failed: {response.text}")
        return None

def create_assignment(token, module_id, title, description, instructions):
    """Create an assignment"""
    print(f"   📋 Creating assignment: {title}")
    data = {
        "title": title,
        "description": description,
        "instructions": instructions,
        "course_id": COURSE_ID,
        "module_id": module_id,
        "max_score": 100,
        "is_published": True
    }
    response = requests.post(
        f"{BASE_URL}/instructor/assessments/assignments",
        headers=get_headers(token),
        json=data
    )
    if response.status_code == 201:
        assignment = response.json().get("assignment", {})
        print(f"      ✅ Assignment created with ID: {assignment.get('id')}")
        return assignment.get("id")
    else:
        print(f"      ❌ Failed: {response.text}")
        return None

def main():
    print("="*60)
    print("📊 Populating Microsoft Excel Mastery Course (ID 9)")
    print("="*60)
    
    # Step 1: Login
    token = login()
    if not token:
        return
    
    # =====================
    # MODULE 1: Excel Basics
    # =====================
    module1_id = create_module(
        token,
        "Module 1: Excel Fundamentals",
        "Learn the basics of Microsoft Excel including navigation, data entry, and basic formatting.",
        1
    )
    
    if module1_id:
        # Lesson 1.1
        lesson1_1 = create_lesson(
            token, module1_id,
            "Introduction to Excel Interface",
            "text",
            """<h2>Welcome to Microsoft Excel</h2>
<p>Microsoft Excel is a powerful spreadsheet application used for data analysis, calculations, and visualization.</p>

<h3>Key Components of Excel Interface:</h3>
<ul>
<li><strong>Ribbon:</strong> Contains tabs with grouped commands (Home, Insert, Page Layout, etc.)</li>
<li><strong>Name Box:</strong> Shows the active cell reference (e.g., A1, B5)</li>
<li><strong>Formula Bar:</strong> Displays and allows editing of cell contents</li>
<li><strong>Worksheet Area:</strong> The grid of cells organized in rows (numbers) and columns (letters)</li>
<li><strong>Sheet Tabs:</strong> Navigate between multiple worksheets</li>
<li><strong>Status Bar:</strong> Shows information about selected data</li>
</ul>

<h3>Navigation Shortcuts:</h3>
<ul>
<li><code>Ctrl + Home</code> - Go to cell A1</li>
<li><code>Ctrl + End</code> - Go to last used cell</li>
<li><code>Ctrl + Arrow Keys</code> - Jump to edge of data region</li>
<li><code>Page Up/Down</code> - Move one screen up/down</li>
</ul>""",
            "Learn to navigate the Excel interface and understand its key components.",
            1, 20
        )
        
        # Lesson 1.2
        lesson1_2 = create_lesson(
            token, module1_id,
            "Data Entry and Cell Selection",
            "text",
            """<h2>Working with Cells in Excel</h2>

<h3>Selecting Cells:</h3>
<ul>
<li><strong>Single Cell:</strong> Click on any cell</li>
<li><strong>Range:</strong> Click and drag, or hold Shift + Click</li>
<li><strong>Entire Column:</strong> Click column header (A, B, C...)</li>
<li><strong>Entire Row:</strong> Click row number (1, 2, 3...)</li>
<li><strong>Non-adjacent cells:</strong> Hold Ctrl + Click</li>
<li><strong>All Cells:</strong> Ctrl + A</li>
</ul>

<h3>Data Types:</h3>
<ul>
<li><strong>Text:</strong> Any alphanumeric characters (left-aligned by default)</li>
<li><strong>Numbers:</strong> Numeric values (right-aligned by default)</li>
<li><strong>Dates:</strong> Date values (stored as serial numbers)</li>
<li><strong>Formulas:</strong> Start with = sign</li>
</ul>

<h3>Quick Tips:</h3>
<ul>
<li>Press <code>Enter</code> to confirm and move down</li>
<li>Press <code>Tab</code> to confirm and move right</li>
<li>Press <code>Esc</code> to cancel entry</li>
<li>Press <code>F2</code> to edit cell contents</li>
</ul>""",
            "Master cell selection techniques and understand different data types.",
            2, 15
        )
        
        # Lesson 1.3
        lesson1_3 = create_lesson(
            token, module1_id,
            "Basic Formatting",
            "text",
            """<h2>Formatting Cells in Excel</h2>

<h3>Number Formatting:</h3>
<ul>
<li><strong>General:</strong> Default format</li>
<li><strong>Number:</strong> Decimal places, thousand separator</li>
<li><strong>Currency:</strong> $1,234.56</li>
<li><strong>Percentage:</strong> 25%</li>
<li><strong>Date/Time:</strong> Various date formats</li>
</ul>

<h3>Font Formatting (Home Tab):</h3>
<ul>
<li>Font type, size, color</li>
<li>Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U)</li>
</ul>

<h3>Alignment Options:</h3>
<ul>
<li>Horizontal: Left, Center, Right</li>
<li>Vertical: Top, Middle, Bottom</li>
<li>Wrap Text: Display long text in multiple lines</li>
<li>Merge & Center: Combine cells</li>
</ul>

<h3>Borders and Fill:</h3>
<ul>
<li>Add borders to cells</li>
<li>Apply background colors</li>
<li>Use Format Painter (Ctrl+Shift+C) to copy formatting</li>
</ul>""",
            "Learn to format cells, numbers, and apply visual styles.",
            3, 20
        )
        
        # Quiz for Module 1
        quiz1_questions = [
            {
                "text": "What keyboard shortcut takes you to cell A1?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Ctrl + Home", "is_correct": True},
                    {"text": "Ctrl + End", "is_correct": False},
                    {"text": "Ctrl + A", "is_correct": False},
                    {"text": "Alt + Home", "is_correct": False}
                ]
            },
            {
                "text": "Which data type is right-aligned by default in Excel?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Text", "is_correct": False},
                    {"text": "Numbers", "is_correct": True},
                    {"text": "Both are centered", "is_correct": False},
                    {"text": "Both are left-aligned", "is_correct": False}
                ]
            },
            {
                "text": "What does pressing F2 do in Excel?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Delete cell contents", "is_correct": False},
                    {"text": "Edit the active cell", "is_correct": True},
                    {"text": "Insert a new row", "is_correct": False},
                    {"text": "Open the Format menu", "is_correct": False}
                ]
            },
            {
                "text": "How do you select non-adjacent cells?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Shift + Click", "is_correct": False},
                    {"text": "Alt + Click", "is_correct": False},
                    {"text": "Ctrl + Click", "is_correct": True},
                    {"text": "Double-click", "is_correct": False}
                ]
            },
            {
                "text": "What symbol must all Excel formulas start with?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "+", "is_correct": False},
                    {"text": "=", "is_correct": True},
                    {"text": "@", "is_correct": False},
                    {"text": "#", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module1_id, lesson1_3, "Excel Fundamentals Quiz", "Test your knowledge of Excel basics.", quiz1_questions)
        
        # Assignment for Module 1
        create_assignment(
            token, module1_id,
            "Create Your First Spreadsheet",
            "Create a personal budget spreadsheet using Excel fundamentals.",
            """Create a simple personal budget spreadsheet with the following requirements:

1. Create a header row with these columns: Category, Budgeted Amount, Actual Amount, Difference
2. Add at least 5 expense categories (e.g., Rent, Food, Transportation, Entertainment, Utilities)
3. Enter sample data for each category
4. Format the amounts as Currency
5. Apply bold formatting to headers
6. Add borders around all cells
7. Use a fill color for the header row

Submit your completed Excel file (.xlsx)."""
        )
    
    # =====================
    # MODULE 2: Formulas & Functions
    # =====================
    module2_id = create_module(
        token,
        "Module 2: Formulas and Functions",
        "Master Excel formulas and essential functions for calculations and data analysis.",
        2
    )
    
    if module2_id:
        # Lesson 2.1
        lesson2_1 = create_lesson(
            token, module2_id,
            "Basic Arithmetic Formulas",
            "text",
            """<h2>Creating Formulas in Excel</h2>

<h3>Arithmetic Operators:</h3>
<ul>
<li><code>+</code> Addition: =A1+B1</li>
<li><code>-</code> Subtraction: =A1-B1</li>
<li><code>*</code> Multiplication: =A1*B1</li>
<li><code>/</code> Division: =A1/B1</li>
<li><code>^</code> Exponentiation: =A1^2</li>
<li><code>%</code> Percentage: =A1*10%</li>
</ul>

<h3>Order of Operations (PEMDAS):</h3>
<ol>
<li>Parentheses ()</li>
<li>Exponents ^</li>
<li>Multiplication and Division * /</li>
<li>Addition and Subtraction + -</li>
</ol>

<h3>Cell References:</h3>
<ul>
<li><strong>Relative:</strong> A1 (changes when copied)</li>
<li><strong>Absolute:</strong> $A$1 (stays fixed)</li>
<li><strong>Mixed:</strong> $A1 or A$1</li>
</ul>

<p><strong>Tip:</strong> Press F4 to toggle between reference types!</p>""",
            "Learn to create formulas using arithmetic operators and cell references.",
            1, 20
        )
        
        # Lesson 2.2
        lesson2_2 = create_lesson(
            token, module2_id,
            "Essential Functions: SUM, AVERAGE, COUNT",
            "text",
            """<h2>Core Excel Functions</h2>

<h3>SUM Function</h3>
<p>Adds all numbers in a range.</p>
<pre>=SUM(A1:A10)
=SUM(A1,B1,C1)
=SUM(A1:A10,C1:C10)</pre>

<h3>AVERAGE Function</h3>
<p>Calculates the arithmetic mean.</p>
<pre>=AVERAGE(A1:A10)
=AVERAGE(A1,A5,A10)</pre>

<h3>COUNT Functions</h3>
<ul>
<li><code>=COUNT(A1:A10)</code> - Counts cells with numbers</li>
<li><code>=COUNTA(A1:A10)</code> - Counts non-empty cells</li>
<li><code>=COUNTBLANK(A1:A10)</code> - Counts empty cells</li>
</ul>

<h3>MIN and MAX</h3>
<pre>=MIN(A1:A10)  // Smallest value
=MAX(A1:A10)  // Largest value</pre>

<h3>AutoSum Shortcut</h3>
<p>Select a cell below your data and press <code>Alt + =</code> for quick SUM!</p>""",
            "Master the most commonly used Excel functions.",
            2, 25
        )
        
        # Lesson 2.3
        lesson2_3 = create_lesson(
            token, module2_id,
            "Logical Functions: IF, AND, OR",
            "text",
            """<h2>Logical Functions in Excel</h2>

<h3>IF Function</h3>
<p>Returns one value if condition is TRUE, another if FALSE.</p>
<pre>=IF(condition, value_if_true, value_if_false)
=IF(A1>50, "Pass", "Fail")
=IF(B1>=100, B1*0.1, 0)</pre>

<h3>Nested IF</h3>
<pre>=IF(A1>=90, "A", IF(A1>=80, "B", IF(A1>=70, "C", "F")))</pre>

<h3>AND Function</h3>
<p>Returns TRUE if ALL conditions are true.</p>
<pre>=AND(A1>0, A1<100)
=IF(AND(B1>=18, B1<=65), "Eligible", "Not Eligible")</pre>

<h3>OR Function</h3>
<p>Returns TRUE if ANY condition is true.</p>
<pre>=OR(A1="Red", A1="Blue")
=IF(OR(B1="Manager", B1="Director"), "Senior", "Junior")</pre>

<h3>NOT Function</h3>
<pre>=NOT(A1>10)  // Returns TRUE if A1 is NOT greater than 10</pre>""",
            "Learn to make decisions in Excel using logical functions.",
            3, 25
        )
        
        # Quiz for Module 2
        quiz2_questions = [
            {
                "text": "What is the result of =10+5*2 in Excel?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "30", "is_correct": False},
                    {"text": "20", "is_correct": True},
                    {"text": "25", "is_correct": False},
                    {"text": "17", "is_correct": False}
                ]
            },
            {
                "text": "Which function counts only cells containing numbers?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "COUNTA", "is_correct": False},
                    {"text": "COUNT", "is_correct": True},
                    {"text": "COUNTBLANK", "is_correct": False},
                    {"text": "SUM", "is_correct": False}
                ]
            },
            {
                "text": "What does $A$1 represent?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Relative reference", "is_correct": False},
                    {"text": "Absolute reference", "is_correct": True},
                    {"text": "Mixed reference", "is_correct": False},
                    {"text": "Named range", "is_correct": False}
                ]
            },
            {
                "text": "What keyboard shortcut toggles between reference types?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "F2", "is_correct": False},
                    {"text": "F4", "is_correct": True},
                    {"text": "F5", "is_correct": False},
                    {"text": "F9", "is_correct": False}
                ]
            },
            {
                "text": "In =IF(A1>50, \"Pass\", \"Fail\"), what happens if A1 equals 50?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Returns 'Pass'", "is_correct": False},
                    {"text": "Returns 'Fail'", "is_correct": True},
                    {"text": "Returns an error", "is_correct": False},
                    {"text": "Returns 50", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module2_id, lesson2_3, "Formulas and Functions Quiz", "Test your formula and function knowledge.", quiz2_questions)
        
        # Assignment for Module 2
        create_assignment(
            token, module2_id,
            "Sales Analysis with Formulas",
            "Use formulas and functions to analyze sales data.",
            """Create a sales analysis spreadsheet:

1. Create a table with columns: Product, Q1 Sales, Q2 Sales, Q3 Sales, Q4 Sales, Total, Average
2. Add at least 6 products with quarterly sales data
3. Use SUM function to calculate yearly totals
4. Use AVERAGE function for quarterly averages
5. Add a row at the bottom showing totals for each quarter
6. Use MAX and MIN to find best and worst performing products
7. Add an IF formula to classify products as "High Performer" (>$10000) or "Needs Improvement"

Submit your completed Excel file with all formulas visible."""
        )
    
    # =====================
    # MODULE 3: Data Management
    # =====================
    module3_id = create_module(
        token,
        "Module 3: Data Management",
        "Learn to organize, sort, filter, and manage large datasets efficiently.",
        3
    )
    
    if module3_id:
        # Lesson 3.1
        lesson3_1 = create_lesson(
            token, module3_id,
            "Sorting and Filtering Data",
            "text",
            """<h2>Organizing Data in Excel</h2>

<h3>Sorting Data</h3>
<p>Rearrange data in ascending or descending order.</p>

<h4>Quick Sort:</h4>
<ul>
<li>Select any cell in column to sort</li>
<li>Data tab → Sort A to Z (ascending) or Z to A (descending)</li>
</ul>

<h4>Custom Sort (Multiple Levels):</h4>
<ol>
<li>Select your data range</li>
<li>Data → Sort</li>
<li>Add levels to sort by multiple columns</li>
<li>Example: Sort by Department, then by Name</li>
</ol>

<h3>Filtering Data</h3>
<p>Display only rows that meet specific criteria.</p>

<h4>Enable AutoFilter:</h4>
<ul>
<li>Select header row</li>
<li>Data → Filter (or Ctrl+Shift+L)</li>
<li>Click dropdown arrows to filter</li>
</ul>

<h4>Filter Options:</h4>
<ul>
<li>Select/deselect specific values</li>
<li>Text Filters: Contains, Begins With, etc.</li>
<li>Number Filters: Greater Than, Between, Top 10, etc.</li>
<li>Date Filters: This Week, Last Month, etc.</li>
</ul>""",
            "Master sorting and filtering to organize your data effectively.",
            1, 20
        )
        
        # Lesson 3.2
        lesson3_2 = create_lesson(
            token, module3_id,
            "Data Validation",
            "text",
            """<h2>Controlling Data Entry with Validation</h2>

<h3>What is Data Validation?</h3>
<p>Rules that restrict what users can enter in cells.</p>

<h3>Setting Up Validation:</h3>
<ol>
<li>Select cells to validate</li>
<li>Data → Data Validation</li>
<li>Set your criteria</li>
</ol>

<h3>Validation Types:</h3>
<ul>
<li><strong>Whole Number:</strong> Only integers within range</li>
<li><strong>Decimal:</strong> Numbers with decimals</li>
<li><strong>List:</strong> Dropdown selection (most common!)</li>
<li><strong>Date:</strong> Valid dates within range</li>
<li><strong>Time:</strong> Valid times</li>
<li><strong>Text Length:</strong> Limit character count</li>
<li><strong>Custom:</strong> Use a formula</li>
</ul>

<h3>Creating a Dropdown List:</h3>
<pre>1. Select target cells
2. Data → Data Validation
3. Allow: List
4. Source: Type items separated by commas
   OR reference a range: =$A$1:$A$5</pre>

<h3>Input and Error Messages:</h3>
<ul>
<li>Input Message: Shows hint when cell is selected</li>
<li>Error Alert: Shows when invalid data is entered</li>
</ul>""",
            "Learn to control and validate data entry in your spreadsheets.",
            2, 20
        )
        
        # Lesson 3.3
        lesson3_3 = create_lesson(
            token, module3_id,
            "Tables and Named Ranges",
            "text",
            """<h2>Excel Tables and Named Ranges</h2>

<h3>Converting Data to a Table</h3>
<ol>
<li>Select your data range</li>
<li>Insert → Table (or Ctrl+T)</li>
<li>Confirm range and headers</li>
</ol>

<h3>Table Benefits:</h3>
<ul>
<li>Automatic formatting and styling</li>
<li>Filter buttons added automatically</li>
<li>Structured references in formulas</li>
<li>Auto-expansion when adding data</li>
<li>Built-in Total Row option</li>
</ul>

<h3>Structured References:</h3>
<pre>=SUM(Table1[Sales])
=AVERAGE(Table1[Quantity])
=[@Price]*[@Quantity]  (same row reference)</pre>

<h3>Named Ranges</h3>
<p>Give meaningful names to cell ranges.</p>

<h4>Creating Named Ranges:</h4>
<ul>
<li>Select range → Type name in Name Box → Enter</li>
<li>Or: Formulas → Define Name</li>
</ul>

<h4>Using Named Ranges:</h4>
<pre>=SUM(MonthlySales)
=VLOOKUP(A1, ProductList, 2, FALSE)</pre>

<p><strong>Tip:</strong> Press F3 to see list of all named ranges!</p>""",
            "Organize data using Excel Tables and Named Ranges.",
            3, 20
        )
        
        # Quiz for Module 3
        quiz3_questions = [
            {
                "text": "What is the keyboard shortcut to enable AutoFilter?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Ctrl+F", "is_correct": False},
                    {"text": "Ctrl+Shift+L", "is_correct": True},
                    {"text": "Ctrl+T", "is_correct": False},
                    {"text": "Alt+F", "is_correct": False}
                ]
            },
            {
                "text": "Which Data Validation type creates a dropdown list?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Whole Number", "is_correct": False},
                    {"text": "Custom", "is_correct": False},
                    {"text": "List", "is_correct": True},
                    {"text": "Text Length", "is_correct": False}
                ]
            },
            {
                "text": "What is the shortcut to convert data to a Table?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Ctrl+T", "is_correct": True},
                    {"text": "Ctrl+Shift+T", "is_correct": False},
                    {"text": "Alt+T", "is_correct": False},
                    {"text": "Ctrl+N", "is_correct": False}
                ]
            },
            {
                "text": "What does [@Column] represent in a structured reference?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "The entire column", "is_correct": False},
                    {"text": "The value in the same row", "is_correct": True},
                    {"text": "The column header", "is_correct": False},
                    {"text": "The first cell in the column", "is_correct": False}
                ]
            },
            {
                "text": "How do you access the list of all named ranges?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Press F2", "is_correct": False},
                    {"text": "Press F3", "is_correct": True},
                    {"text": "Press F4", "is_correct": False},
                    {"text": "Press F5", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module3_id, lesson3_3, "Data Management Quiz", "Test your data management skills.", quiz3_questions)
        
        # Assignment for Module 3
        create_assignment(
            token, module3_id,
            "Employee Database Management",
            "Create and manage an employee database with validation and filtering.",
            """Create an employee database spreadsheet:

1. Create a table with columns: Employee ID, Name, Department, Position, Hire Date, Salary, Status
2. Add at least 10 employee records
3. Convert the data to an Excel Table
4. Add Data Validation:
   - Department: Dropdown list (HR, IT, Sales, Marketing, Finance)
   - Status: Dropdown (Active, On Leave, Terminated)
   - Salary: Whole number between 30000 and 200000
5. Create named ranges for department lists
6. Add sorting by Department, then by Name
7. Demonstrate filtering to show only IT department employees

Submit your Excel file with all validations and formatting applied."""
        )
    
    # =====================
    # MODULE 4: Charts & Visualization
    # =====================
    module4_id = create_module(
        token,
        "Module 4: Charts and Data Visualization",
        "Create professional charts and visualizations to present data effectively.",
        4
    )
    
    if module4_id:
        # Lesson 4.1
        lesson4_1 = create_lesson(
            token, module4_id,
            "Creating Basic Charts",
            "text",
            """<h2>Introduction to Excel Charts</h2>

<h3>Chart Types Overview:</h3>
<ul>
<li><strong>Column/Bar:</strong> Compare categories</li>
<li><strong>Line:</strong> Show trends over time</li>
<li><strong>Pie/Doughnut:</strong> Show proportions (use sparingly!)</li>
<li><strong>Scatter:</strong> Show relationships between variables</li>
<li><strong>Area:</strong> Cumulative totals over time</li>
</ul>

<h3>Creating a Chart:</h3>
<ol>
<li>Select your data (include headers)</li>
<li>Insert tab → Choose chart type</li>
<li>Or press Alt+F1 for quick chart</li>
</ol>

<h3>Recommended Charts:</h3>
<p>Insert → Recommended Charts analyzes your data and suggests best options.</p>

<h3>Chart Elements:</h3>
<ul>
<li><strong>Chart Title:</strong> Describes the chart</li>
<li><strong>Legend:</strong> Identifies data series</li>
<li><strong>Axis Titles:</strong> Label X and Y axes</li>
<li><strong>Data Labels:</strong> Show values on chart</li>
<li><strong>Gridlines:</strong> Help read values</li>
</ul>

<h3>Quick Tip:</h3>
<p>Click chart + press Ctrl+1 to open Format pane!</p>""",
            "Learn to create various types of charts in Excel.",
            1, 25
        )
        
        # Lesson 4.2
        lesson4_2 = create_lesson(
            token, module4_id,
            "Formatting and Customizing Charts",
            "text",
            """<h2>Making Charts Professional</h2>

<h3>Chart Design Tab:</h3>
<ul>
<li>Quick Layout: Pre-designed element arrangements</li>
<li>Chart Styles: Color schemes and effects</li>
<li>Switch Row/Column: Swap axes</li>
<li>Change Chart Type: Convert to different visualization</li>
</ul>

<h3>Format Tab Options:</h3>
<ul>
<li>Shape Styles: Fill, outline, effects</li>
<li>WordArt Styles: Text formatting</li>
<li>Size: Exact dimensions</li>
</ul>

<h3>Customizing Elements:</h3>
<ol>
<li>Click the element you want to format</li>
<li>Right-click → Format [Element]</li>
<li>Or use Format pane (Ctrl+1)</li>
</ol>

<h3>Color Tips:</h3>
<ul>
<li>Use consistent color palette</li>
<li>Highlight key data with contrasting colors</li>
<li>Consider colorblind-friendly palettes</li>
<li>Match your organization's branding</li>
</ul>

<h3>Adding Trendlines:</h3>
<ol>
<li>Click on data series</li>
<li>Chart Design → Add Chart Element → Trendline</li>
<li>Choose: Linear, Exponential, Moving Average, etc.</li>
</ol>""",
            "Customize charts to create professional visualizations.",
            2, 20
        )
        
        # Lesson 4.3
        lesson4_3 = create_lesson(
            token, module4_id,
            "Conditional Formatting",
            "text",
            """<h2>Visual Data Analysis with Conditional Formatting</h2>

<h3>What is Conditional Formatting?</h3>
<p>Automatically format cells based on their values.</p>

<h3>Accessing Conditional Formatting:</h3>
<p>Home → Conditional Formatting</p>

<h3>Built-in Rules:</h3>
<ul>
<li><strong>Highlight Cell Rules:</strong> Greater Than, Less Than, Equal To, Text Contains, Duplicate Values</li>
<li><strong>Top/Bottom Rules:</strong> Top 10, Bottom 10%, Above Average</li>
<li><strong>Data Bars:</strong> Horizontal bars showing relative values</li>
<li><strong>Color Scales:</strong> Gradient colors (e.g., Red-Yellow-Green)</li>
<li><strong>Icon Sets:</strong> Arrows, flags, ratings, etc.</li>
</ul>

<h3>Creating Custom Rules:</h3>
<ol>
<li>Conditional Formatting → New Rule</li>
<li>Choose rule type</li>
<li>Set conditions and formatting</li>
</ol>

<h3>Formula-Based Rules:</h3>
<pre>=A1>100
=AND($B1="Complete",$C1>0)
=ISBLANK(A1)</pre>

<h3>Managing Rules:</h3>
<ul>
<li>Conditional Formatting → Manage Rules</li>
<li>Edit, delete, or reorder rules</li>
<li>Rules are applied in order - first match wins!</li>
</ul>""",
            "Use conditional formatting to highlight important data patterns.",
            3, 20
        )
        
        # Quiz for Module 4
        quiz4_questions = [
            {
                "text": "Which chart type is best for showing proportions of a whole?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Line chart", "is_correct": False},
                    {"text": "Bar chart", "is_correct": False},
                    {"text": "Pie chart", "is_correct": True},
                    {"text": "Scatter chart", "is_correct": False}
                ]
            },
            {
                "text": "What shortcut creates a quick chart from selected data?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Ctrl+C", "is_correct": False},
                    {"text": "Alt+F1", "is_correct": True},
                    {"text": "F11", "is_correct": False},
                    {"text": "Ctrl+G", "is_correct": False}
                ]
            },
            {
                "text": "Which conditional formatting shows horizontal bars in cells?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Color Scales", "is_correct": False},
                    {"text": "Icon Sets", "is_correct": False},
                    {"text": "Data Bars", "is_correct": True},
                    {"text": "Highlight Rules", "is_correct": False}
                ]
            },
            {
                "text": "What chart type shows the relationship between two variables?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Column chart", "is_correct": False},
                    {"text": "Pie chart", "is_correct": False},
                    {"text": "Scatter chart", "is_correct": True},
                    {"text": "Area chart", "is_correct": False}
                ]
            },
            {
                "text": "What shortcut opens the Format pane for a selected chart element?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Ctrl+F", "is_correct": False},
                    {"text": "Ctrl+1", "is_correct": True},
                    {"text": "Ctrl+Shift+F", "is_correct": False},
                    {"text": "Alt+Enter", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module4_id, lesson4_3, "Charts and Visualization Quiz", "Test your charting and visualization skills.", quiz4_questions)
        
        # Assignment for Module 4
        create_assignment(
            token, module4_id,
            "Sales Dashboard Creation",
            "Create a visual sales dashboard with charts and conditional formatting.",
            """Create a sales dashboard with the following requirements:

1. Create monthly sales data for 4 products over 12 months
2. Create the following charts:
   - Line chart showing sales trends over time
   - Column chart comparing products by quarter
   - Pie chart showing total sales distribution by product
3. Apply conditional formatting:
   - Data bars on monthly totals
   - Color scale (Red-Yellow-Green) on growth rates
   - Icon sets for performance indicators
4. Format all charts professionally with:
   - Clear titles
   - Proper axis labels
   - Legend placement
   - Consistent color scheme
5. Arrange charts in a dashboard layout

Submit your completed dashboard Excel file."""
        )
    
    # =====================
    # MODULE 5: Advanced Functions
    # =====================
    module5_id = create_module(
        token,
        "Module 5: Advanced Functions",
        "Master powerful lookup, text, and date functions for advanced data analysis.",
        5
    )
    
    if module5_id:
        # Lesson 5.1
        lesson5_1 = create_lesson(
            token, module5_id,
            "VLOOKUP and HLOOKUP",
            "text",
            """<h2>Lookup Functions in Excel</h2>

<h3>VLOOKUP (Vertical Lookup)</h3>
<p>Search for a value in the first column and return a value from another column.</p>

<pre>=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])

=VLOOKUP(A2, $D$2:$F$100, 3, FALSE)</pre>

<h4>Parameters:</h4>
<ul>
<li><strong>lookup_value:</strong> What to search for</li>
<li><strong>table_array:</strong> Where to search (lock with $)</li>
<li><strong>col_index_num:</strong> Column to return (1=first column)</li>
<li><strong>range_lookup:</strong> FALSE for exact match, TRUE for approximate</li>
</ul>

<h3>HLOOKUP (Horizontal Lookup)</h3>
<p>Same as VLOOKUP but searches horizontally.</p>
<pre>=HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])</pre>

<h3>Common VLOOKUP Errors:</h3>
<ul>
<li><strong>#N/A:</strong> Value not found (check spelling, use IFERROR)</li>
<li><strong>#REF!:</strong> Column index exceeds table width</li>
<li><strong>#VALUE!:</strong> Invalid arguments</li>
</ul>

<h3>Handling Errors:</h3>
<pre>=IFERROR(VLOOKUP(A2, Data, 3, FALSE), "Not Found")</pre>

<h3>VLOOKUP Limitations:</h3>
<ul>
<li>Can only look right (lookup column must be leftmost)</li>
<li>Returns only first match</li>
<li>Column index breaks if columns inserted</li>
</ul>""",
            "Master VLOOKUP and HLOOKUP for data retrieval.",
            1, 30
        )
        
        # Lesson 5.2
        lesson5_2 = create_lesson(
            token, module5_id,
            "INDEX and MATCH",
            "text",
            """<h2>The Power Combo: INDEX & MATCH</h2>

<h3>Why INDEX/MATCH?</h3>
<ul>
<li>Look up in any direction (left or right)</li>
<li>More flexible than VLOOKUP</li>
<li>Doesn't break when columns change</li>
<li>Better performance on large datasets</li>
</ul>

<h3>MATCH Function</h3>
<p>Returns the position of a value in a range.</p>
<pre>=MATCH(lookup_value, lookup_array, [match_type])

=MATCH("Apple", A1:A100, 0)  // Returns position number</pre>

<h4>Match Types:</h4>
<ul>
<li><strong>0:</strong> Exact match (most common)</li>
<li><strong>1:</strong> Largest value ≤ lookup_value</li>
<li><strong>-1:</strong> Smallest value ≥ lookup_value</li>
</ul>

<h3>INDEX Function</h3>
<p>Returns a value at a specific position.</p>
<pre>=INDEX(array, row_num, [column_num])

=INDEX(B1:B100, 5)  // Returns 5th value in range</pre>

<h3>Combining INDEX & MATCH</h3>
<pre>=INDEX(return_range, MATCH(lookup_value, lookup_range, 0))

// Example: Look up price by product name
=INDEX(C2:C100, MATCH(F2, A2:A100, 0))</pre>

<h3>Two-Way Lookup:</h3>
<pre>=INDEX(B2:E10, MATCH(H1,A2:A10,0), MATCH(H2,B1:E1,0))</pre>""",
            "Learn the powerful INDEX/MATCH combination.",
            2, 30
        )
        
        # Lesson 5.3
        lesson5_3 = create_lesson(
            token, module5_id,
            "XLOOKUP (Modern Lookup)",
            "text",
            """<h2>XLOOKUP: The Modern Solution</h2>

<p><strong>Note:</strong> Available in Excel 365 and Excel 2021+</p>

<h3>Basic Syntax:</h3>
<pre>=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])</pre>

<h3>Simple Example:</h3>
<pre>=XLOOKUP(A2, Products, Prices)
=XLOOKUP("Apple", A:A, C:C, "Not Found")</pre>

<h3>XLOOKUP Advantages:</h3>
<ul>
<li>Look in any direction</li>
<li>Built-in error handling</li>
<li>Return multiple columns/rows</li>
<li>Exact match by default</li>
<li>Search from end (last match)</li>
<li>Wildcard support</li>
</ul>

<h3>Match Modes:</h3>
<ul>
<li><strong>0:</strong> Exact match (default)</li>
<li><strong>-1:</strong> Exact or next smaller</li>
<li><strong>1:</strong> Exact or next larger</li>
<li><strong>2:</strong> Wildcard match</li>
</ul>

<h3>Search Modes:</h3>
<ul>
<li><strong>1:</strong> First to last (default)</li>
<li><strong>-1:</strong> Last to first</li>
<li><strong>2:</strong> Binary search ascending</li>
<li><strong>-2:</strong> Binary search descending</li>
</ul>

<h3>Return Multiple Values:</h3>
<pre>=XLOOKUP(A2, IDs, FirstName:Email)  // Returns multiple columns!</pre>""",
            "Master the modern XLOOKUP function.",
            3, 25
        )
        
        # Quiz for Module 5
        quiz5_questions = [
            {
                "text": "In VLOOKUP, what does FALSE mean for the range_lookup parameter?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Approximate match", "is_correct": False},
                    {"text": "Exact match", "is_correct": True},
                    {"text": "Case-sensitive match", "is_correct": False},
                    {"text": "Partial match", "is_correct": False}
                ]
            },
            {
                "text": "What does the MATCH function return?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "The value found", "is_correct": False},
                    {"text": "The position number", "is_correct": True},
                    {"text": "TRUE or FALSE", "is_correct": False},
                    {"text": "The cell address", "is_correct": False}
                ]
            },
            {
                "text": "What error appears when VLOOKUP cannot find a value?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "#REF!", "is_correct": False},
                    {"text": "#VALUE!", "is_correct": False},
                    {"text": "#N/A", "is_correct": True},
                    {"text": "#NAME?", "is_correct": False}
                ]
            },
            {
                "text": "What is the main advantage of INDEX/MATCH over VLOOKUP?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Faster performance only", "is_correct": False},
                    {"text": "Can look up to the left", "is_correct": True},
                    {"text": "Simpler syntax", "is_correct": False},
                    {"text": "Works with text only", "is_correct": False}
                ]
            },
            {
                "text": "Which function handles VLOOKUP errors gracefully?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "ISERROR", "is_correct": False},
                    {"text": "IFERROR", "is_correct": True},
                    {"text": "ERRORIF", "is_correct": False},
                    {"text": "ONERROR", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module5_id, lesson5_3, "Advanced Functions Quiz", "Test your lookup function knowledge.", quiz5_questions)
        
        # Assignment for Module 5
        create_assignment(
            token, module5_id,
            "Product Lookup System",
            "Create a product lookup system using advanced functions.",
            """Create a product inventory lookup system:

1. Create a Products table with: Product ID, Name, Category, Price, Stock, Supplier
2. Add at least 15 products across different categories
3. Create a lookup section that:
   - Uses VLOOKUP to find product details by ID
   - Uses INDEX/MATCH to find price by product name
   - Uses XLOOKUP (if available) or INDEX/MATCH for reverse lookup
4. Handle errors with IFERROR for all lookups
5. Create a two-way lookup to find stock by Product and Supplier
6. Add data validation dropdowns for easy selection

Bonus: Create a search that works with partial product names.

Submit your completed Excel file demonstrating all lookup methods."""
        )
    
    # =====================
    # MODULE 6: PivotTables
    # =====================
    module6_id = create_module(
        token,
        "Module 6: PivotTables and PivotCharts",
        "Summarize and analyze large datasets using PivotTables and PivotCharts.",
        6
    )
    
    if module6_id:
        # Lesson 6.1
        lesson6_1 = create_lesson(
            token, module6_id,
            "Creating PivotTables",
            "text",
            """<h2>Introduction to PivotTables</h2>

<h3>What is a PivotTable?</h3>
<p>An interactive tool to summarize, analyze, and explore large datasets without formulas.</p>

<h3>Creating a PivotTable:</h3>
<ol>
<li>Select your data (or any cell in the data range)</li>
<li>Insert → PivotTable</li>
<li>Choose destination (new or existing worksheet)</li>
<li>Click OK</li>
</ol>

<h3>PivotTable Areas:</h3>
<ul>
<li><strong>Filters:</strong> Filter entire PivotTable</li>
<li><strong>Columns:</strong> Column headers</li>
<li><strong>Rows:</strong> Row labels</li>
<li><strong>Values:</strong> Numbers to summarize (Sum, Count, Average, etc.)</li>
</ul>

<h3>Building Your First PivotTable:</h3>
<ol>
<li>Drag a field to Rows (e.g., Category)</li>
<li>Drag a field to Values (e.g., Sales)</li>
<li>Excel automatically sums the values!</li>
</ol>

<h3>Value Calculations:</h3>
<ul>
<li>Sum (default for numbers)</li>
<li>Count</li>
<li>Average</li>
<li>Min/Max</li>
<li>Product</li>
<li>Count Numbers</li>
<li>StdDev/Var</li>
</ul>""",
            "Learn to create and configure PivotTables.",
            1, 30
        )
        
        # Lesson 6.2
        lesson6_2 = create_lesson(
            token, module6_id,
            "PivotTable Analysis Techniques",
            "text",
            """<h2>Advanced PivotTable Features</h2>

<h3>Grouping Data:</h3>
<ul>
<li>Right-click date field → Group</li>
<li>Group by: Months, Quarters, Years</li>
<li>Group numbers into ranges</li>
</ul>

<h3>Calculated Fields:</h3>
<ol>
<li>PivotTable Analyze → Fields, Items & Sets → Calculated Field</li>
<li>Create: Profit = Sales - Cost</li>
</ol>

<h3>Show Values As:</h3>
<ul>
<li>% of Grand Total</li>
<li>% of Column Total</li>
<li>% of Row Total</li>
<li>% of Parent Total</li>
<li>Difference From</li>
<li>Running Total</li>
<li>Rank</li>
</ul>

<h3>Slicers and Timelines:</h3>
<p>Visual filters for PivotTables</p>
<ol>
<li>Click PivotTable</li>
<li>PivotTable Analyze → Insert Slicer</li>
<li>Select fields to create slicers</li>
<li>For dates: Insert Timeline</li>
</ol>

<h3>Refreshing Data:</h3>
<ul>
<li>Right-click → Refresh</li>
<li>Or: PivotTable Analyze → Refresh</li>
<li>Shortcut: Alt+F5</li>
</ul>

<h3>Drill Down:</h3>
<p>Double-click any value to see underlying data!</p>""",
            "Master advanced PivotTable analysis techniques.",
            2, 25
        )
        
        # Lesson 6.3
        lesson6_3 = create_lesson(
            token, module6_id,
            "PivotCharts",
            "text",
            """<h2>Visualizing PivotTable Data</h2>

<h3>Creating a PivotChart:</h3>
<ol>
<li>Click inside PivotTable</li>
<li>PivotTable Analyze → PivotChart</li>
<li>Or: Insert → PivotChart (from data)</li>
</ol>

<h3>PivotChart Features:</h3>
<ul>
<li>Automatically linked to PivotTable</li>
<li>Filter buttons on chart</li>
<li>Updates when PivotTable changes</li>
<li>Can use Slicers and Timelines</li>
</ul>

<h3>Chart Types for PivotCharts:</h3>
<ul>
<li>Column/Bar: Compare categories</li>
<li>Line: Trends over time</li>
<li>Pie: Proportions (single data series)</li>
<li>Combo: Mix chart types</li>
</ul>

<h3>Formatting PivotCharts:</h3>
<ul>
<li>Same formatting options as regular charts</li>
<li>Right-click elements to format</li>
<li>Use Chart Styles for quick formatting</li>
</ul>

<h3>Best Practices:</h3>
<ul>
<li>Keep it simple and focused</li>
<li>Use appropriate chart type for data</li>
<li>Add clear titles and labels</li>
<li>Consider your audience</li>
<li>Use slicers for interactivity</li>
</ul>

<h3>Dashboard Tip:</h3>
<p>Connect multiple PivotCharts to the same slicer for synchronized filtering!</p>""",
            "Create interactive PivotCharts for data visualization.",
            3, 20
        )
        
        # Quiz for Module 6
        quiz6_questions = [
            {
                "text": "Which PivotTable area is used for numeric summaries?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Rows", "is_correct": False},
                    {"text": "Columns", "is_correct": False},
                    {"text": "Values", "is_correct": True},
                    {"text": "Filters", "is_correct": False}
                ]
            },
            {
                "text": "How do you see the underlying data for a PivotTable value?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "Right-click and select 'Show Data'", "is_correct": False},
                    {"text": "Double-click the value", "is_correct": True},
                    {"text": "Press F2", "is_correct": False},
                    {"text": "Use the Drill Down button", "is_correct": False}
                ]
            },
            {
                "text": "What is a Slicer in Excel?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "A tool to split cells", "is_correct": False},
                    {"text": "A visual filter for PivotTables", "is_correct": True},
                    {"text": "A chart type", "is_correct": False},
                    {"text": "A data validation tool", "is_correct": False}
                ]
            },
            {
                "text": "What shortcut refreshes a PivotTable?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "F5", "is_correct": False},
                    {"text": "Ctrl+R", "is_correct": False},
                    {"text": "Alt+F5", "is_correct": True},
                    {"text": "Ctrl+F5", "is_correct": False}
                ]
            },
            {
                "text": "Which 'Show Values As' option displays cumulative totals?",
                "question_type": "multiple_choice",
                "points": 10,
                "answers": [
                    {"text": "% of Grand Total", "is_correct": False},
                    {"text": "Difference From", "is_correct": False},
                    {"text": "Running Total", "is_correct": True},
                    {"text": "Rank", "is_correct": False}
                ]
            }
        ]
        create_quiz(token, module6_id, lesson6_3, "PivotTables Quiz", "Test your PivotTable knowledge.", quiz6_questions)
        
        # Assignment for Module 6
        create_assignment(
            token, module6_id,
            "Sales Analysis Dashboard",
            "Create an interactive sales dashboard using PivotTables and PivotCharts.",
            """Create a comprehensive sales analysis dashboard:

1. Start with raw sales data containing: Date, Region, Product, Category, Salesperson, Quantity, Revenue, Cost
2. Include at least 100 transactions across 4 quarters

3. Create PivotTables showing:
   - Revenue by Region and Product
   - Monthly sales trends
   - Top 10 salespeople by revenue
   - Category performance comparison

4. Add calculated fields:
   - Profit (Revenue - Cost)
   - Profit Margin (Profit / Revenue)

5. Create PivotCharts:
   - Column chart for regional comparison
   - Line chart for monthly trends
   - Pie chart for category distribution

6. Add interactivity:
   - Slicers for Region, Category, and Salesperson
   - Timeline for date filtering
   - Connect slicers to all PivotTables

7. Format professionally with consistent styling

Submit your interactive dashboard Excel file."""
        )
    
    print("\n" + "="*60)
    print("✅ Course population completed!")
    print("="*60)

if __name__ == "__main__":
    main()

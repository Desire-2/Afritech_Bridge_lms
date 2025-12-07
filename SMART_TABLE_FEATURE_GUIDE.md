# Smart Table Insertion - Feature Guide 📊

## Overview

The Enhanced Markdown Editor now includes **smart table generation** that automatically converts selected text into properly formatted markdown tables. This eliminates manual table creation and supports multiple data formats.

---

## 🎯 How It Works

### Empty Selection (No Text Selected)
Clicking the table button (⊞) without selecting text inserts a default 3-column template:

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### With Selected Text (Smart Conversion)
The editor automatically detects the format of your selected text and converts it to a markdown table:

---

## 📝 Supported Input Formats

### 1. Comma-Separated Values (CSV)
**Input:**
```
Name,Age,City
John,25,New York
Jane,30,Los Angeles
Bob,28,Chicago
```

**Output (after clicking ⊞ or pressing table button):**
```markdown
| Name | Age | City |
|------|-----|------|
| John | 25  | New York |
| Jane | 30  | Los Angeles |
| Bob  | 28  | Chicago |
```

---

### 2. Tab-Separated Values (TSV)
**Input:** (tabs between columns)
```
Product	Price	Stock
Laptop	999	15
Mouse	29	50
Keyboard	79	30
```

**Output:**
```markdown
| Product  | Price | Stock |
|----------|-------|-------|
| Laptop   | 999   | 15    |
| Mouse    | 29    | 50    |
| Keyboard | 79    | 30    |
```

---

### 3. Pipe-Separated (Already Markdown-like)
**Input:**
```
Course | Duration | Level
Python | 8 weeks | Beginner
Java | 10 weeks | Intermediate
React | 6 weeks | Advanced
```

**Output:** (cleaned and formatted)
```markdown
| Course | Duration | Level |
|--------|----------|-------|
| Python | 8 weeks  | Beginner |
| Java   | 10 weeks | Intermediate |
| React  | 6 weeks  | Advanced |
```

---

### 4. Space-Separated (2+ Spaces)
**Input:**
```
Item        Quantity    Status
Pens        100         Available
Notebooks   50          Low Stock
Erasers     200         Available
```

**Output:**
```markdown
| Item      | Quantity | Status    |
|-----------|----------|-----------|
| Pens      | 100      | Available |
| Notebooks | 50       | Low Stock |
| Erasers   | 200      | Available |
```

---

### 5. Single Column (Line-by-Line)
**Input:**
```
Monday
Tuesday
Wednesday
Thursday
Friday
```

**Output:**
```markdown
| Monday    |
|-----------|
| Tuesday   |
| Wednesday |
| Thursday  |
| Friday    |
```

---

## 🚀 Usage Examples

### Example 1: Quick Data Table
**Scenario:** You have data from a spreadsheet

1. Copy data from Excel/Google Sheets (preserves tabs)
2. Paste into the editor
3. Select the pasted text
4. Click the **⊞** table button
5. Done! ✨

**Before:**
```
Student	Score	Grade
Alice	95	A
Bob	87	B
Carol	92	A
```

**After one click:**
```markdown
| Student | Score | Grade |
|---------|-------|-------|
| Alice   | 95    | A     |
| Bob     | 87    | B     |
| Carol   | 92    | A     |
```

---

### Example 2: Converting Lists to Tables
**Scenario:** You have a simple list you want in table format

**Before:**
```
Name, Email, Role
john@example.com, john@example.com, Student
jane@example.com, jane@example.com, Instructor
bob@example.com, bob@example.com, Admin
```

**After selecting and clicking ⊞:**
```markdown
| Name | Email | Role |
|------|-------|------|
| john@example.com | john@example.com | Student |
| jane@example.com | jane@example.com | Instructor |
| bob@example.com | bob@example.com | Admin |
```

---

### Example 3: Schedule/Timetable
**Before:**
```
Day,Morning,Afternoon,Evening
Monday,Math,Science,Art
Tuesday,English,History,Music
Wednesday,Science,Math,PE
```

**After:**
```markdown
| Day       | Morning | Afternoon | Evening |
|-----------|---------|-----------|---------|
| Monday    | Math    | Science   | Art     |
| Tuesday   | English | History   | Music   |
| Wednesday | Science | Math      | PE      |
```

---

## 🎨 Smart Features

### Automatic Format Detection
The editor automatically detects:
- ✅ **Comma delimiter** (CSV files)
- ✅ **Tab delimiter** (Excel/spreadsheet paste)
- ✅ **Pipe delimiter** (markdown-style)
- ✅ **Multiple spaces** (aligned text)
- ✅ **Single column** (simple lists)

### Intelligent Processing
- ✅ **Trims whitespace** from cells
- ✅ **Handles empty cells** gracefully
- ✅ **Auto-aligns columns** 
- ✅ **Treats first row as header**
- ✅ **Creates separator line** automatically
- ✅ **Adds empty data row** if only header exists

### Edge Case Handling
- ✅ **Uneven columns** - Pads with empty cells
- ✅ **Empty lines** - Filters them out
- ✅ **Mixed delimiters** - Uses most common
- ✅ **Special characters** - Preserves them

---

## 💡 Pro Tips

### Tip 1: From Spreadsheet to Table
1. Copy data from Excel/Google Sheets
2. Paste directly into editor
3. Select pasted content
4. Click ⊞ (table button)
5. Perfect table instantly! 🎉

### Tip 2: Quick Two-Column Table
```
Term, Definition
API, Application Programming Interface
SQL, Structured Query Language
HTML, HyperText Markup Language
```
Select → Click ⊞ → Done!

### Tip 3: Editing Tables
After creation, you can:
- Add rows by copying last row format
- Add columns by inserting `| Header |` and `|---|` 
- Edit cells directly in markdown
- Use online markdown table editors for complex changes

### Tip 4: Best Source Formats
**Best Results:**
- ✅ CSV files (clean)
- ✅ TSV from spreadsheets (well-structured)
- ✅ Aligned text with consistent delimiters

**Needs Manual Cleanup:**
- ⚠️ Inconsistent delimiters
- ⚠️ Mixed data types
- ⚠️ Special formatting within cells

---

## 🔧 Technical Details

### Detection Priority
1. **Tab** - Highest priority (common in spreadsheets)
2. **Pipe** - Second (markdown format)
3. **Comma** - Third (CSV files)
4. **Multiple spaces** - Fourth (aligned text)
5. **Single column** - Fallback

### Processing Algorithm
```
1. Split text by newlines → rows
2. Filter out empty rows
3. Detect delimiter (tab > pipe > comma > spaces)
4. Split each row by delimiter → cells
5. Trim whitespace from each cell
6. Find max column count
7. Normalize all rows to same column count
8. Generate markdown:
   - First row → header
   - Separator line with dashes
   - Remaining rows → data
```

### Output Format
```markdown
| Header 1 | Header 2 | ... |  ← First row
|----------|----------|-----|  ← Separator (auto-sized)
| Cell 1   | Cell 2   | ... |  ← Data rows
| Cell 3   | Cell 4   | ... |
```

---

## 📊 Before & After Examples

### Example 1: Shopping List → Inventory Table
**Before (plain text):**
```
apples, 10, $2.50
bananas, 15, $1.20
oranges, 8, $3.00
```

**After (markdown table):**
```markdown
| apples  | 10 | $2.50 |
|---------|----| ------|
| bananas | 15 | $1.20 |
| oranges | 8  | $3.00 |
```

---

### Example 2: Meeting Agenda → Schedule Table
**Before:**
```
Time	Topic	Speaker
9:00 AM	Opening	John
9:30 AM	Presentation	Jane
10:00 AM	Discussion	Bob
```

**After:**
```markdown
| Time     | Topic        | Speaker |
|----------|--------------|---------|
| 9:00 AM  | Opening      | John    |
| 9:30 AM  | Presentation | Jane    |
| 10:00 AM | Discussion   | Bob     |
```

---

### Example 3: Course Modules → Structured Table
**Before:**
```
Module | Lessons | Duration | Status
Introduction | 5 | 2 hours | Complete
Basics | 10 | 5 hours | In Progress
Advanced | 8 | 4 hours | Not Started
```

**After:**
```markdown
| Module       | Lessons | Duration | Status      |
|--------------|---------|----------|-------------|
| Introduction | 5       | 2 hours  | Complete    |
| Basics       | 10      | 5 hours  | In Progress |
| Advanced     | 8       | 4 hours  | Not Started |
```

---

## ❓ Common Questions

**Q: What if my data has no header?**
A: The first row is always treated as the header. Add a header row first if needed.

**Q: Can I convert multi-line cells?**
A: Not currently - each line becomes a separate row. Use `<br>` tags in cells for line breaks.

**Q: What about nested tables?**
A: Markdown doesn't support nested tables. Consider separate tables or HTML.

**Q: How do I align columns (left/right/center)?**
A: Edit the separator line:
- Left: `|:---|`
- Center: `|:---:|`
- Right: `|---:|`

**Q: Can I merge cells?**
A: Basic markdown tables don't support cell merging. Use HTML tables for advanced layouts.

**Q: What's the maximum table size?**
A: No hard limit, but very large tables (100+ rows) may be better as CSV downloads.

---

## 🎯 Use Cases

### Education
- ✅ Course schedules
- ✅ Student rosters
- ✅ Grade tables
- ✅ Assignment deadlines
- ✅ Learning objectives matrix

### Documentation
- ✅ API endpoint references
- ✅ Configuration options
- ✅ Comparison charts
- ✅ Feature matrices
- ✅ Version compatibility

### Content Creation
- ✅ Product comparisons
- ✅ Pricing tables
- ✅ Feature lists
- ✅ Timeline/roadmaps
- ✅ Resource lists

---

## 🚀 Try It Now!

1. **Navigate** to Course Creation → Add/Edit Lesson
2. **Select** "Text" content type
3. **Paste** some comma-separated or tab-separated data
4. **Select** the pasted text
5. **Click** the ⊞ table button in the toolbar
6. **Watch** the magic happen! ✨

---

## 📚 Related Features

- **Quick Reference**: `MARKDOWN_QUICK_REFERENCE.md`
- **Full Guide**: `MARKDOWN_EDITOR_USAGE_GUIDE.md`
- **Enhancement Summary**: `MARKDOWN_ENHANCEMENT_SUMMARY.md`

---

**Smart table insertion makes creating structured content faster and easier than ever! 📊✨**

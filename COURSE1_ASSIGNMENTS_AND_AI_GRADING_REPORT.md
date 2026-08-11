# 📊 Course 1 Assignments & AI Grading System — Analysis Report

**Generated:** August 11, 2026 · **Source:** Production database (`lms_rx36`, via `backend/.env`) + `backend/src/services/excel_grading/` codebase

---

## Part 1 — Assignments of Course 1

### Course Overview

| Field | Value |
|---|---|
| **Course ID** | 1 |
| **Title** | **Excel Mastery: From Beginner to Data Expert** |
| **Assignments found** | **19** (all `file_upload` type, all published) |
| **Default points** | 100.0 per assignment |
| **Default passing score** | 60.0 per assignment |
| **Linked rubrics** | None (`rubric_id` is `NULL` for all 19 → the AI **generates** a rubric from instructions at grading time) |
| **Modules** | 17 modules, ordered 1 → 20 (gaps: orders 12, 18, 19 have no modules) |

### Module Structure (17 modules)

| Order | Module ID | Module Title |
|---|---|---|
| 1 | 2 | Fundamentals & Data Entry - Detailed Course Content |
| 2 | 34 | Calculations, Text Handling, and Foundational Lookups |
| 3 | 35 | Advanced Logic, Conditional Aggregation, and Modern Lookups |
| 4 | 37 | Next-Generation Formulas and Data Transformation with Power Query |
| 5 | 36 | Data Analysis, Reporting, and Pivot Table Mastery |
| 6 | 38 | Automation Fundamentals with Macros and VBA |
| 7 | 39 | Advanced Visualization and Dynamic Dashboard Design |
| 8 | 40 | Deep Dive into Power Query and M Language |
| 9 | 41 | Data Modeling with Power Pivot and DAX Fundamentals |
| 10 | 42 | Advanced Array Formulas and Optimization Tools |
| 11 | 43 | Structured VBA Programming and Custom Tools |
| 13 | 45 | Auditing, Debugging, and Performance Optimization |
| 14 | 46 | Statistical Modeling, Forecasting, and Scenario Testing |
| 15 | 47 | Integrating Excel with External Data Ecosystems |
| 16 | 48 | Structured VBA for Enterprise Application Development |
| 17 | 49 | Advanced Financial Modeling and Risk Simulation |
| 20 | 52 | Advanced VBA Architecture, Collections, and Event Handling |

---

### 📝 Assignment 2 — Excel Fundamentals Practical Exam: Interface, Navigation, and Data Automation
- **Module:** Fundamentals & Data Entry (order 1) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed after) · **Due:** none

**Description:** Tests mastery of the fundamental Excel interface elements, efficient navigation techniques, and automated data entry tools (Autofill and Flash Fill). The student simulates setting up a preliminary Employee Roster worksheet, using keyboard shortcuts instead of mouse-based interaction, organizing workbook structure, and using Excel's pattern recognition to populate and clean data. Strict adherence to specified shortcuts is required.

**Instructions (summary):**
- **Part 1 – Workbook Setup & Interface:** Rename Sheet1 to "Roster Management", apply a Tab Color, add headers (Full Name, Department ID, Start Date, First Name, Last Name) in row 1. Verify the Name Box and Formula Bar behave correctly with `=1+1`. Ensure Undo/Redo are on the Quick Access Toolbar.
- **Part 2 – Data Input & Automation:** Enter two employee records (John M. Smith / 101 / 1/1/2024; Alice B. Johnson / 102 / 1/15/2024). Use the Fill Handle to generate Department IDs 101→110 and a logical date series to row 10. Use Flash Fill (`Ctrl+E`) to populate First Name and Last Name columns for all 9 rows.
- **Part 3 – Navigation & Selection:** Use `Ctrl+Arrow Down`, `Ctrl+Home`, `Ctrl+Spacebar`, `Shift+Spacebar`, `Ctrl+Shift+Arrow Down`/`Right` to select A1:E10, and `Ctrl+G` (Go To) to jump to A1 on the Roster sheet from a new Sheet2.
- **Submission:** Upload the file to Google Drive and share the link with "anyone with link" access.

---

### 📝 Assignment 3 — Applying Data Validation for Enhanced Data Quality
- **Module:** Fundamentals & Data Entry (order 1) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 5 (allowed) · **Due:** none

**Description:** Students apply Data Validation to ensure data accuracy in a practical scenario, creating a robust user-friendly template that prevents "garbage in" by setting predefined rules. They work on a case study involving validation rules, drop-down lists, and input messages/error alerts — demonstrating the ability to apply theoretical concepts to real-world problems.

**Instructions (summary):**
1. Create a sheet named "Orders".
2. Limit order quantities between 1–100 (Whole number / between).
3. Create a drop-down for product codes with exactly 8 characters (Text length / equal to).
4. Configure an input message guiding the required product-code format.
5. Set up an error alert for invalid product codes.
6. Create a named Excel Table column of acceptable product categories (e.g., Electronics, Fashion, Home Goods).
7. Use the named table column as the source for the drop-down in "Orders".
8. Upload to Google Drive, paste the link with "anyone with link" access.

---

### 📝 Assignment 5 — Mastering Calculations, Text Handling, and Foundational Lookups
- **Module:** Calculations, Text Handling, and Foundational Lookups (order 2) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 9 (allowed) · **Due:** none

**Description:** Applies module concepts to real-world scenarios across three parts: (1) aggregation functions (SUM, AVERAGE, COUNT) to summarize data, (2) text manipulation (TRIM, CONCATENATE, LEFT, RIGHT) to clean messy data, (3) lookup functions (VLOOKUP, HLOOKUP) to retrieve data across tables — developing data-analysis proficiency.

**Instructions (summary):**
1. Open the sample dataset (Google Sheets link provided) and create a worksheet per part.
2. Part 1: Use aggregation functions to calculate total revenue, average revenue, and sales count per region.
3. Part 2: Use text functions to clean and standardize customer names and addresses.
4. Part 3: Use lookup functions to retrieve sales data per region and product.
5. Submit worksheets as separate files plus a written report explaining approach and results.

---

### 📝 Assignment 6 — Applying Essential Arithmetic and Aggregation Skills
- **Module:** Calculations, Text Handling, and Foundational Lookups (order 2) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (allowed) · **Due:** none

**Description:** Students practice HLOOKUP, SUMIF, COUNTIF, and AVERAGEIF on real-world scenarios — solving business problems like regional sales totals, counting products in a price range, and averaging revenues under conditions.

**Instructions (summary):**
1. Download the sample sales-data spreadsheet (link provided).
2. Use **HLOOKUP** to find September's total revenue → cell E1.
3. Use **SUMIF** for North region revenue → E2.
4. Use **COUNTIF** to count transactions > $4000 → E3.
5. Use **AVERAGEIF** for the Software category average → E4.
6. Use wildcards with **COUNTIF** to count products ending in "top" → E5.

---

### 📝 Assignment 8 — Advanced Logic and Lookup Project
- **Module:** Advanced Logic, Conditional Aggregation, and Modern Lookups (order 3) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** 2026-07-14

**Description:** A project applying advanced logic, conditional aggregation, and modern lookups to analyze a sales dataset (regions, product types, transaction values, dates), producing a comprehensive report with complex conditional logic and efficient lookups.

**Instructions (summary):**
1. Download the dataset (link provided).
2. Use **IFERROR** and **ISNA** to keep the report clean.
3. Apply **SUMIFS / COUNTIFS / AVERAGEIFS** for metrics like total sales by region, average transaction value by product type, and transaction counts by date range.
4. Use **INDEX/MATCH** and **XLOOKUP** for flexible lookups.
5. Use comparison operators (`<`, `>`, `<=`, `>=`) within conditional aggregation (e.g., sales above a threshold, transactions within a date range).

---

### 📝 Assignment 9 — Relational Reporting and Advanced Metric Derivation: Data Model & Calculated Items Design
- **Module:** Data Analysis, Reporting, and Pivot Table Mastery (order 5) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 8 (not allowed) · **Due:** none

**Description:** A theoretical/design assignment where the student acts as an advanced data analyst designing a variance report using Calculated Items and the Excel Data Model — integrating two tables (Financial_Data fact table + Product_Dimension lookup) without manual VLOOKUP merging. Requires documenting design steps, definitions, and decisions.

**Instructions (summary):**
- **Part 1 – Calculated Item:** Define "Variance" (Actual Sales − Budget Amount) as a column in the PivotTable; justify why it must be a **Calculated Item** rather than a Calculated Field; provide the exact dialog formula using Category Type labels.
- **Part 2 – Data Model:** Outline steps to load both tables into the Excel Data Model from the Insert PivotTable dialog; define the Many/One sides and the linking key; describe defining the One-to-Many relationship via the Data Ribbon.
- **Part 3 – Report Construction:** Design the final layout (Variance by Product Category); explain one major benefit of the Data Model over VLOOKUP merging.

---

### 📝 Assignment 7 — Applying Next-Generation Formulas and Power Query for Data Transformation
- **Module:** Next-Generation Formulas and Data Transformation with Power Query (order 4) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** 2026-06-25

**Description:** Applies Power Query and M language to clean, transform, and analyze an e-commerce sales dataset (customer info, order details, product categories) into a business-analysis-ready model, demonstrating Dynamic Array functions and conditional logic.

**Instructions (summary):**
1. Import the sales dataset into Power Query (link provided).
2. Use **M language** to create a custom column extracting unique product categories.
3. Apply conditional logic to flag orders > $1000 as "High Value", others "Standard".
4. Use the **SEQUENCE** function to generate the next 12 months of dates and merge with sales data to create a forecast table.
5. Clean and transform data (handle missing values, remove duplicates, format dates).

---

### 📝 Assignment 10 — Dynamic Data Automation: Commission Review using Variables, Conditions, and Loops
- **Module:** Automation Fundamentals with Macros and VBA (order 6) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 8 (not allowed) · **Due:** none

**Description:** Synthesizes Variables, Conditional Logic (If/Then/Else), and Iteration (For…Next) into a dynamic macro that processes sales figures, checks each against a target, and applies status + color coding — moving from macro-recorder user to automation expert. Requires best practices like `Option Explicit` and typed variables.

**Instructions (summary):**
1. Insert a module with **`Option Explicit`**.
2. Declare `targetGoal As Long` (15000), `rowCounter As Long`, `currentSales As Long`.
3. Write a **For…Next** loop (rows 2–11) reading Column B values into `currentSales`.
4. **If…Then…ElseIf:** ≥ target → "High Commission" + green; ≥ 10000 → "Standard Commission" + blue; else → "Needs Review" + red (in Column C).
5. Reflection questions: why typed data types beat `Variant`, and how loop-driven dynamic row numbers save time.

---

### 📝 Assignment 11 — Project Alpha: Dynamic KPI Dashboard Construction using ActiveX and Layered Visualizations
- **Module:** Advanced Visualization and Dynamic Dashboard Design (order 7) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 5 (not allowed) · **Due:** none

**Description:** Builds a professional single-screen KPI dashboard with a custom Speedometer Chart (layered Doughnut + Pie on the Secondary Axis), an ActiveX Command Button linked to VBA, Named Ranges for dynamic labels, and performance optimization.

**Instructions (summary):**
1. Create "Dashboard" and "Calculations" sheets with Speedometer gauge data (series totaling 200).
2. Insert a Doughnut chart, rotate 270°, hide the "Hidden Half" segment, color Red/Yellow/Green segments.
3. Add the needle series as a Pie chart on the **Secondary Axis**, rotate 270°, hide all but the needle segment.
4. Create a dynamic label formula → Named Range → Text Box linked to it, centered in the gauge.
5. Insert an **ActiveX Command Button**, customize Caption/Font/BackColor.
6. Wire `CommandButton1_Click()` with `Application.ScreenUpdating` toggling and a `MsgBox` data-refresh confirmation.
7. Hide "Calculations"; ensure no volatile functions (INDIRECT/OFFSET); final dashboard contains only chart, label, and button.

---

### 📝 Assignment 12 — Power Query Resilience: Parameterization and Structured Data Error Trapping
- **Module:** Deep Dive into Power Query and M Language (order 8) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Demonstrates mastery of advanced Power Query features: Query Parameters for dynamic source management, extraction from nested Records/Lists, and `try…otherwise` resilience — simulating a production environment where connection details are managed externally and complex payloads process without halting on errors.

**Instructions (summary):**
- **Part 1 (Query A):** Create parameters `CurrentEnvironment` (Test/Production), `Path_Test`, `Path_Prod`; write M that selects the path conditionally (`if CurrentEnvironment = "Production" then Path_Prod else Path_Test`) and uses it in a simulated source step.
- **Part 2 (Query B):** Create a table (via "Enter Data") with `ValueA`, `ValueB` (some zeros), and a Record column. Extract `[RecordColumn][ID]`; use `Record.FieldOrDefault` for an `API_Key` field defaulting to "N/A"; add `Result_Calculation = [ValueA] / [ValueB]` wrapped in `try…otherwise` (0 on error); add an `Error_Log` column reading `[HasError]`/`[Error][Message]`.

---

### 📝 Assignment 13 — DAX Mastery: Context Control for Advanced Business Insights
- **Module:** Data Modeling with Power Pivot and DAX Fundamentals (order 9) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Applies foundational DAX concepts (Row/Filter Context, iteration, filter modification) in Power Pivot by creating advanced measures with SUMX, CALCULATE, ALL, and FILTER — moving beyond simple aggregations for expert-level analysis.

**Instructions (summary):**
1. Set up a Power Pivot Data Model (Fact Sales, Dim Product, Dim Geography, Dim Date) with base measure `[Total Sales] = SUM('Fact Sales'[SalesAmount])`.
2. `[Total Profit]` via **SUMX** iterating `(Unit Price − Unit Cost) * Quantity`.
3. `[Online Channel Sales]` via **CALCULATE** with Channel = "Online".
4. `[Total Sales ALL Products]` via **CALCULATE** + **ALL('Dim Product')**; `[% of Total Sales by Product]` via **DIVIDE**.
5. `[High Quantity Order Sales]` via **CALCULATE** + **FILTER** (Quantity > 10); `[Eastern Region Sales]` filtering Dim Geography RegionName = "Eastern".
6. Demonstrate all measures in a Pivot Table (Category in Rows, measures in Values, RegionName as Filter) and observe context behavior.

---

### 📝 Assignment 14 — Mastering Advanced Array Formulas and Solver for Business Decisions
- **Module:** Advanced Array Formulas and Optimization Tools (order 10) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Demonstrates proficiency with legacy CSE (Ctrl+Shift+Enter) array formulas for complex manipulation/conditional aggregation, and the critical skill of interpreting Solver's Answer and Sensitivity reports — including engine selection and constraint management for business optimization.

**Instructions (summary):**
- **Part 1 – Array Formulas (35 pts):** CSE `{=SUM(IF(...))}` for "Widget A" in "East" region sales; equivalent SUMPRODUCT; CSE `{=LARGE(IF(...))}` for 2nd-highest Marketing score; one scenario where CSE is still needed today.
- **Part 2 – Solver (45 pts):** Choose Simplex LP / GRG Nonlinear / Evolutionary for three scenarios (linear product mix; `=SQRT(A1)` constraint; `IF`-based bonus constraint). Interpret Answer/Sensitivity snippets: which constraint is binding, net profit impact of one extra labor hour at $20 (vs shadow price $25), and how many hours can be added before the optimal mix changes.
- **Part 3 – Performance & Reflection (20 pts):** Two best practices for speeding up a workbook with whole-column CSE formulas; the strategic value of Sensitivity Reports.

---

### 📝 Assignment 15 — Module 11 Assignment: Building Robust VBA Solutions with Object Management and Error Handling
- **Module:** Structured VBA Programming and Custom Tools (order 11) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Applies structured programming to create a robust VBA solution — interacting with workbooks/sheets, handling runtime errors gracefully, using FileSystemObject for directories, and demonstrating custom functions vs. Sub procedures.

**Instructions (summary):**
1. Save as Macro-Enabled Workbook; enable **Microsoft Scripting Runtime** reference; create a test `DailyReport.xlsx` with SalesData + Summary sheets.
2. Create `ProcessDailyReport` Sub with `Dim`/`Set` objects, string constants for paths, `On Error GoTo ErrorHandler` plus `CleanUp:` label and `GoTo CleanUp`.
3. Use **FileSystemObject** to check/create a `Processed_Reports` backup folder on the Desktop with a `MsgBox` result.
4. Open `DailyReport.xlsx`, reference the SalesData sheet, close with `SaveChanges:=False` and reset `Application.DisplayAlerts` in CleanUp.
5. `Select Case Err.Number`: 1004 → file-not-found message; 9 → missing sheet message; Else → generic message with Err.Number/Err.Description.
6. Create `CalculateQuarterlyBonus(TotalSales, BonusRate)` Function returning a Double, and a `TestBonusCalculation` Sub demonstrating it.

---

### 📝 Assignment 16 — Excel Model Health Check: An Expert Auditor's Report
- **Module:** Auditing, Debugging, and Performance Optimization (order 13) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** A written audit report where the student plays a senior Excel consultant performing a "health check" on a complex inherited model — identifying structural inefficiencies, errors, and performance bottlenecks and proposing systematic solutions (no workbook build required).

**Instructions (summary):**
- **Part 1 – Structural Audit:** Named Ranges cleanup via Name Manager (#REF! names, oversized ranges, INDEX/COUNTA redefinition example); consolidate redundant Conditional Formatting rules, mitigate volatile functions, audit Data Validation; remove "ghost data" (print areas, orphaned objects, excess rows/columns) using Go To Special.
- **Part 2 – External Dependencies:** Use the **Edit Links** dialog; criteria for Update Values / Change Source / Break Link with example scenarios for each; when/why to switch to Manual Calculation with the recalculation shortcuts.
- **Part 3 – Advanced Debugging:** Two custom Data Validation formula scenarios (date constraint, mutual exclusivity, or value-dependent) with exact formulas; audit/manage external data connections (refresh settings, "Enable background refresh" implications).

---

### 📝 Assignment 17 — Business Decision-Making with Statistical Modeling & Risk Simulation
- **Module:** Statistical Modeling, Forecasting, and Scenario Testing (order 14) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Applies advanced statistics and risk modeling: the Data Analysis ToolPak for hypothesis testing plus a Monte Carlo simulation built with statistically credible random variables — producing data-driven recommendations and risk assessment.

**Instructions (summary):**
- **Part 1 – Hypothesis Testing & ANOVA:** Generate 20 before/after training scores; state H0/Ha; run a **t-Test: Paired Two Sample for Means** (α=0.05) via the ToolPak and interpret the p-value with a business conclusion. Also run **ANOVA: Single Factor** across three marketing strategies (15 days each) and interpret.
- **Part 2 – Monte Carlo Simulation:** Fixed inputs ($5M revenue, $3M variable costs); model Revenue Growth ~N(6.5%, 2.0%) and Cost Increase ~N(1.0%, 0.8%) using `NORM.INV(RAND(), Mean, StDev)`; compute projected revenue/costs/gross profit; run 1,000 iterations; compute Mean, StDev, Min, Max, 5th and 95th percentiles; interpret the average profit, 90% probability range, and risk from the standard deviation.

---

### 📝 Assignment 18 — Enterprise Data Integration: From Excel Model to Power BI Service
- **Module:** Integrating Excel with External Data Ecosystems (order 15) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Simulates deploying an Excel-based Power Pivot Data Model (connected to on-premise SQL Server) into the Microsoft Power BI Service — covering the On-Premise Data Gateway, Query Folding, refresh, and data governance.

**Instructions (summary):**
1. **Publishing:** Detail steps to publish only the Power Pivot Data Model to Power BI Service and why that beats uploading the whole workbook.
2. **Gateway:** Explain the On-Premise Data Gateway's role in secure cloud↔on-prem communication; configuration steps for the `EnterpriseDW` data source and credential management.
3. **Scheduled Refresh:** Step-by-step daily scheduled refresh setup (dataset↔gateway mapping, credentials, frequency, failure notifications).
4. **Query Folding:** Explain what it is and why it's critical; how to verify a filter step folds; provide a hypothetical native SQL query for the `2024-01-01` filter.
5. **Governance:** Benefits of centrally managed Gateway credentials vs. credentials embedded in workbooks.

---

### 📝 Assignment 19 — Enterprise Project Folder Utility: Building a Structured VBA Application
- **Module:** Structured VBA for Enterprise Application Development (order 16) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Develops a "Project Folder Manager" VBA application integrating professional error handling, FileSystemObject, custom Class Modules, advanced UserForm design, and Windows Registry settings — transitioning from scripting to enterprise application development.

**Instructions (summary):**
1. Insert UserForm `frmProjectManager` and Class Module `ProjectFolderUtil`.
2. **Class:** `CreateProjectFolder(basePath, projectName)` (creates folder + "Docs"/"Reports" subfolders, `On Error Resume Next` + `Err.Number` checks); `DeleteFolderIfEmpty(path)`; `FolderExists(path)` — all with robust error handling.
3. **UserForm:** MultiPage with "Folder Operations" (Base Path + Project Name textboxes, "Create Project Structure" button, "Folder to Delete" + "Delete Empty Folder" button, input validation) and "Settings" (Default Base Path textbox, "Save Default Path" via `SaveSetting` with `APP_NAME="EnterpriseProjectUtility"`, Section="Paths", Key="DefaultProjectPath", and "Load Default Path" via `GetSetting`).
4. **Initialize:** In `UserForm_Initialize`, load the registry default into the Base Project Path textbox with error handling.

---

### 📝 Assignment 20 — Investment Project & Portfolio Risk Assessment: A Comprehensive Analysis
- **Module:** Advanced Financial Modeling and Risk Simulation (order 17) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** A comprehensive financial-analysis assignment for a high-net-worth client: capital budgeting (NPV/IRR), risk analysis (Monte Carlo, VaR, CVaR), and sensitivity analysis with Data Tables — culminating in a recommendation.

**Instructions (summary):**
1. **Valuation:** Build a financial model for a $500,000 investment with 5-year cash flows starting at $120,000 growing 5%/yr, discounted at 10%; calculate NPV and IRR.
2. **Sensitivity (Data Tables):** One-variable table varying growth 0–10% (1% steps) showing NPV; two-variable table varying investment $450K–$550K ($25K steps) × discount rate 8–12% (0.5% steps).
3. **Monte Carlo (≥1,000 iterations):** Growth ~N(5%, 2%); compute average NPV, NPV standard deviation, and probability of negative NPV.
4. **VaR / CVaR:** Compute both at 95% confidence from the simulated NPVs and interpret downside risk.
5. **Portfolio Integration:** Conceptually apply the Markowitz model to an existing two-asset portfolio (8%/12% and 12%/18%) and discuss how the project's characteristics would influence inclusion.
6. **Executive Summary:** 1–2 page synthesis with a clear recommendation justified by quantitative and qualitative results.

---

### 📝 Assignment 21 — Dynamic Data Management with Advanced VBA Architecture and Events
- **Module:** Advanced VBA Architecture, Collections, and Event Handling (order 20) · **Type:** file_upload · **Points:** 100 · **Passing:** 60 · **Resubmissions:** 3 (not allowed) · **Due:** none

**Description:** Builds a dynamic, interactive data-management system using Class Modules for modularity, `Scripting.Dictionary` for storage/retrieval, and Workbook/Worksheet events for user interaction and persistence — moving beyond sequential scripting to professional-grade applications.

**Instructions (summary):**
1. **Setup:** Save as `.xlsm`; create Class Module `CItem` with ≥3 `Property Get/Let` procedures (ItemID unique, ItemName, Quantity/Status); set up an input area (A1:C1) and a display table on Sheet1.
2. **Dictionary Storage:** Public `Scripting.Dictionary` (enable Microsoft Scripting Runtime reference); `InitializeDataDictionary`; `AddItemToDictionary` (duplicate-ID prevention); `UpdateItemInDictionary`; `DisplayItemsOnSheet` (clear + repopulate).
3. **Events:** `Workbook_Open` → initialize + load saved data + display; `Worksheet_Change` on input cells → create/update CItem and refresh display with invalid-input handling; `Workbook_BeforeSave` → persist dictionary to a hidden sheet/named range.
4. **Error Handling & Modularity:** `On Error GoTo` routines with `Err.Description`/`Err.Number` user messages in all critical procedures; break complex tasks into focused routines.

---

### Assignment Summary Table

| ID | Title | Module (Order) | Due | Resub. | Type |
|---|---|---|---|---|---|
| 2 | Excel Fundamentals Practical Exam | Fundamentals (1) | — | 3 | file_upload |
| 3 | Applying Data Validation for Enhanced Data Quality | Fundamentals (1) | — | 5 | file_upload |
| 5 | Mastering Calculations, Text Handling, and Foundational Lookups | Calculations/Lookups (2) | — | 9 | file_upload |
| 6 | Applying Essential Arithmetic and Aggregation Skills | Calculations/Lookups (2) | — | 3 | file_upload |
| 8 | Advanced Logic and Lookup Project | Advanced Logic (3) | 2026-07-14 | 3 | file_upload |
| 7 | Next-Generation Formulas and Power Query | Power Query (4) | 2026-06-25 | 3 | file_upload |
| 9 | Data Model & Calculated Items Design | Pivot Mastery (5) | — | 8 | file_upload |
| 10 | Commission Review (Variables, Conditions, Loops) | VBA Automation (6) | — | 8 | file_upload |
| 11 | Project Alpha: KPI Dashboard (ActiveX) | Dashboards (7) | — | 5 | file_upload |
| 12 | Power Query Resilience & Error Trapping | Power Query Deep Dive (8) | — | 3 | file_upload |
| 13 | DAX Mastery: Context Control | Power Pivot/DAX (9) | — | 3 | file_upload |
| 14 | Advanced Array Formulas and Solver | Array Formulas (10) | — | 3 | file_upload |
| 15 | Building Robust VBA Solutions | Structured VBA (11) | — | 3 | file_upload |
| 16 | Excel Model Health Check Audit | Auditing (13) | — | 3 | file_upload |
| 17 | Statistical Modeling & Risk Simulation | Statistics (14) | — | 3 | file_upload |
| 18 | Excel Model → Power BI Service | External Ecosystems (15) | — | 3 | file_upload |
| 19 | Enterprise Project Folder Utility | Enterprise VBA (16) | — | 3 | file_upload |
| 20 | Investment Project & Portfolio Risk Assessment | Financial Modeling (17) | — | 3 | file_upload |
| 21 | Advanced VBA Architecture and Events | Advanced VBA (20) | — | 3 | file_upload |

---

## Part 2 — How the AI Grading System Works

### Overview

The system is an **AI-powered grading engine for MS Excel assignments/projects** living in `backend/src/services/excel_grading/`. It is *deterministic rule-based analysis* (parsing the actual `.xlsx/.xlsm` file internals) rather than a "look at the answer and compare" LLM — although an optional LLM (OpenRouter/Gemini) can rewrite the feedback text into a more natural instructor letter. Key files:

| Component | File |
|---|---|
| Orchestrator | `excel_grading_service.py` |
| Rubric generator ("AI brain") | `rubric_generator.py` |
| Grading engine | `grading_engine.py` |
| Mastery-level classifier | `excel_mastery_levels.py` |
| Feedback generator | `feedback_generator.py` |
| Learning engine | `learning_engine.py` |
| Auto-grader trigger | `auto_grader.py` |
| Analyzers | `excel_analyzer.py`, `formula_analyzer.py`, `chart_analyzer.py`, `pivot_analyzer.py`, `vba_analyzer.py`, `power_query_analyzer.py`, `formatting_analyzer.py` |
| API routes | `excel_grading_routes.py` |
| Storage models | `excel_grading_models.py` (ExcelGradingResult, GradingExperience, GeneratedRubric) |

### The 14-step grading pipeline (`ExcelGradingService.grade_submission`)

1. **Load & validate** — loads the `AssignmentSubmission`/`ProjectSubmission`, its parent assignment/project, and the course.
2. **Excel-course check** — the course title/description must contain keywords (`ms excel`, `excel`, `spreadsheet`, …). Course 1 qualifies.
3. **Idempotency** — if already graded (and `force` is false), returns the existing result.
4. **Extract files** — parses the submission's `file_url`/`file_path` JSON array.
5. **Filter Excel files** — keeps only `.xlsx`, `.xlsm`, `.xls`, `.csv`.
6. **Download** — pulls the first Excel file from Google Drive, Vercel Blob, any HTTP(S) URL, or a relative path resolved against configured frontends (100 MB cap, HTML-page rejection).
7. **Parse requirements** — reads the assignment title/description/instructions + module context and extracts machine-checkable requirements: required functions (VLOOKUP, SUMIFS…), feature scope flags (pivots, charts, VBA, Power Query — only *mentioned* features are graded), required sheet names, and a **task-structure profile** (counts of parts, steps, theory items, deliverables → a complexity score).
8. **Get/Generate rubric** — priority order: instructor-created rubric (course or instructor template) → cached AI-generated rubric (matched by a SHA-256 hash of `title|description|instructions`) → freshly generated rubric. If instructions are too short, it falls back to a default scope-based rubric.
9. **Learning insights** — pulls calibration/pattern data from past instructor reviews (only applied once ≥ 3 samples exist).
10. **Run the analysis pipeline** — only runs analyzers whose scope flag is on:
    - `ExcelAnalyzer` — sheets, named ranges, hidden sheets, formulas, cell errors, conditional formatting, data validation, charts, pivots (openpyxl; pandas for `.xls`/`.csv`).
    - `FormulaAnalyzer` — extracts every formula, classifies 500+ functions into 16 categories, detects advanced/expert functions, absolute/relative references, error handling, nesting depth → complexity score 0–100, and issues (magic numbers, cell errors, huge formulas).
    - `ChartAnalyzer` — chart count/types/titles.
    - `PivotAnalyzer` — parses pivot XML from the zip: fields, data fields, calculated fields/items, slicers.
    - `VBAAnalyzer` — extracts VBA via oletools (zip fallback), scans for suspicious/security patterns (Shell, FileSystemObject, auto-exec macros), code quality (Option Explicit, error handling, comments, naming), automation patterns.
    - `PowerQueryAnalyzer` — extracts M code from customXml/connections, detects transformations (merge, group-by, filters), data sources, complexity.
    - `FormattingAnalyzer` — scoring 0–100 per sheet (data presence, density, CF/DV bonuses, cell-error deductions).
    - `detect_mastery_level` — classifies the assignment as **Foundation / Intermediate / Advanced / Expert** using a 3-signal approach: title keyword matching + deep content analysis (concept complexity, parts/steps, word count) + module-order fallback.
11. **Grade** (`GradingEngine.grade()`) — builds the rubric and scores 7 criteria per submission:

| Criterion | Base weight | Notes |
|---|---|---|
| Formulas | 25 | presence, complexity, advanced/expert usage, diversity, error handling, required-function compliance |
| PivotTables | 15 | count, slicers, calculated fields — level-aware |
| Charts | 10 | count, type diversity, titles |
| PowerQuery_M | 15 | queries, transformations, merges |
| VBA | 15 | structure, quality, automation, security deductions |
| Formatting | 10 | formatting score, CF, data validation, named ranges |
| Completeness | 10 | required sheets, data presence, feature coverage |

   Weights are **redistributed dynamically** so only in-scope categories carry points (out-of-scope = 0). Instructor rubrics map to these categories by keyword. Scoring is **mastery-level aware** (e.g., a Foundation student gets bonus credit for a PivotTable that would be expected at Intermediate+). Result includes total score, percentage, letter grade (A–F), confidence, flagged anomalies (empty submission, VBA security risk, template-copy suspicion, hidden sheets), strengths/weaknesses, and a `manual_review_required` flag (triggered by low confidence, anomalies, extreme scores, or theory questions).
12. **Calibration** — if learning insights exist, a conservative ±50% correction of the historical override delta is applied and confidence is adjusted.
13. **Feedback generation** (`FeedbackGenerator`) — a structured, level-aware letter: opening with score/grade, strengths/weaknesses, per-criterion feedback referencing the rubric's **task checklist** (detected tasks, expected deliverables and formulas), specific cell/formula/VBA/PQ references, cross-referenced "required formulas found vs missing", flagged issues, and a closing noting the grade needs instructor review. Optionally rewritten by an LLM (OpenRouter primary, Gemini fallback — configurable via system settings) through `generate_ai_enhanced`.
14. **Persistence & downstream effects** — deletes any previous result (single authoritative grade), saves an `ExcelGradingResult` (scores, rubric breakdown, full rubric data with metadata, analysis dump, feedback, confidence, audit fields), caches the generated rubric for reuse, and (via `auto_grader` / the route) writes the scaled grade onto the submission, updates ModuleProgress/LessonCompletion, and can auto-request a resubmission.

### Automatic grading trigger (`auto_grader.py`)

- Fires right after a student submits an assignment/project **if** the course is an Excel course **and** the submission contains an Excel file.
- Runs grading in a **background thread** (Flask app context) with 2 retries (5s delay) for download failures and a 120s timeout.
- On completion: auto-approves the result (`instructor_reviewed=True`, `manual_review_required=False`, note "Auto-approved by AI grading system"), writes the grade to the submission, updates learning progress, and emails the student.
- **Below passing score (default 60%)** → automatically creates a modification/resubmission request with AI feedback excerpts (respecting the per-student resubmission limit) and emails the student.

### Instructor review & the learning loop (`learning_engine.py`)

- Instructors can `approve` or `override` any AI result via `POST /api/v1/excel-grading/review/<result_id>`.
- Every review is recorded as a **GradingExperience** with the score delta (instructor − AI). Over time:
  - **Calibration offset** — AI scores shift by 50% of the average historical override delta.
  - **Confidence hints** — high approval rate → high confidence; low → low.
  - **Rubric memory** — generated rubrics are cached by instructions-hash and, once an instructor approves a grade, marked **approved/trusted** and reused instead of regenerating.
  - **Pattern notes** — e.g., "AI tends to undergrade by X pts".

### API surface (`/api/v1/excel-grading`)

| Method & Path | Purpose |
|---|---|
| POST `/grade/<submission_id>` | AI-grade one submission (assignment/project, optional `force`) |
| POST `/grade-batch/<assignment_id>` | Grade all submissions of an assignment |
| GET `/submissions` | List gradeable Excel submissions (pending/graded, per course) |
| GET `/results/<result_id>` · `/results/submission/<id>` | Retrieve results (full or strict format) |
| POST `/review/<result_id>` | Instructor approve/override + auto resubmission flow |
| GET `/history` · GET `/stats/<course_id>` | Course grading history & analytics |
| POST `/preview` | Upload a file to see what analysis the AI would produce (no save) |
| GET `/my-results` · `/my-results/<submission_id>` · `/auto-grade-status/<id>` | Student-facing results & polling |
| GET `/learning/stats` · GET/`POST /learning/rubric/<assignment_id>[/approve]` | Learning stats & rubric inspection/approval |

### What this means for Course 1

- All 19 assignments have **no instructor rubric**, so the AI **generates a task-specific rubric from the instructions** on first grading, caches it by instructions-hash, and reuses it until the instructions change.
- Assignments are heavily **theory/design heavy** (e.g., 9, 14, 16, 17, 18, 20 include written reflection/theory questions). The system detects these as `theory_tasks`, cannot auto-grade written responses, and **flags them for instructor review** while still scoring the file-based parts (formulas, pivots, VBA, charts, formatting).
- Because the course spans Foundation → Expert modules, the **mastery-level classifier** will grade each assignment with appropriate expectations (e.g., a Foundation student with any PivotTable is rewarded; an Expert student missing VBA error handling is penalized).
- Grades are delivered **instantly on submission** (background auto-grading) with email notifications, and failing submissions automatically open a resubmission cycle.

### Known limits & safeguards

- Only **MS Excel** files/courses are auto-graded (`.xlsx/.xlsm/.xls/.csv`); other courses use manual instructor grading.
- `.xls`/`.csv` get limited analysis (no formulas/charts/pivots) → lower confidence.
- Zip-bomb protection (200 MB decompressed cap) and download size caps (100 MB).
- VBA security scanning can zero the VBA criterion and force manual review on high-risk code.
- Written/theory answers are never auto-graded — they are surfaced to the instructor.

---

*Data sourced from the production PostgreSQL database (`lms_rx36` per `backend/.env`) and the grading codebase. No data was modified.*

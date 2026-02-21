#!/usr/bin/env python3
"""
Convert AML_POLICY.md to a professionally styled PDF.
Usage: python3 generate_aml_pdf.py
"""

import os
import markdown
from weasyprint import HTML, CSS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH  = os.path.join(BASE_DIR, "AML_POLICY.md")
PDF_PATH = os.path.join(BASE_DIR, "AML_POLICY.pdf")

# ── Read & convert Markdown ────────────────────────────────────────────────────
with open(MD_PATH, "r", encoding="utf-8") as f:
    md_text = f.read()

body_html = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc", "nl2br"]
)

# ── Full HTML document ─────────────────────────────────────────────────────────
HTML_DOCUMENT = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>AfriTech Bridge – AML Policy ATB-AML-001</title>
</head>
<body>
{body_html}
</body>
</html>"""

# ── Professional CSS ───────────────────────────────────────────────────────────
CSS_STYLES = CSS(string="""
/* ── Page setup ──────────────────────────────────── */
@page {
  size: A4;
  margin: 22mm 20mm 24mm 20mm;

  @top-center {
    content: "AfriTech Bridge – Anti-Money Laundering Policy  |  ATB-AML-001  |  v1.0";
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 7.5pt;
    color: #6b7280;
    border-bottom: 0.5pt solid #d1d5db;
    padding-bottom: 3pt;
  }

  @bottom-left {
    content: "CONFIDENTIAL – Internal Use Only";
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 7pt;
    color: #9ca3af;
  }

  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 7.5pt;
    color: #6b7280;
  }
}

@page :first {
  @top-center { content: none; }
  @bottom-left {
    content: "CONFIDENTIAL – Internal Use Only";
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 7pt;
    color: #9ca3af;
  }
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 7.5pt;
    color: #6b7280;
  }
}

/* ── Base typography ─────────────────────────────── */
* { box-sizing: border-box; }

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.6;
  color: #1f2937;
  background: #ffffff;
}

/* ── Headings ────────────────────────────────────── */
h1 {
  font-size: 22pt;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8pt 0;
  padding-bottom: 6pt;
  border-bottom: 3pt solid #059669;
  page-break-before: avoid;
}

h2 {
  font-size: 13pt;
  font-weight: 700;
  color: #0f172a;
  margin: 18pt 0 6pt 0;
  padding-bottom: 3pt;
  border-bottom: 1pt solid #d1fae5;
  page-break-after: avoid;
}

h3 {
  font-size: 11pt;
  font-weight: 600;
  color: #059669;
  margin: 12pt 0 4pt 0;
  page-break-after: avoid;
}

h4 {
  font-size: 10pt;
  font-weight: 600;
  color: #374151;
  margin: 10pt 0 3pt 0;
  page-break-after: avoid;
}

/* ── Cover metadata block (first <p> tags) ───────── */
p {
  margin: 0 0 6pt 0;
  orphans: 3;
  widows: 3;
}

/* ── Bold metadata key-value lines ──────────────── */
p > strong:first-child {
  color: #374151;
}

/* ── Horizontal rule (used as section divider) ───── */
hr {
  border: none;
  border-top: 1pt solid #e5e7eb;
  margin: 14pt 0;
}

/* ── Tables ──────────────────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10pt 0 10pt 0;
  font-size: 9pt;
  page-break-inside: avoid;
}

thead tr {
  background-color: #059669;
  color: #ffffff;
}

thead th {
  padding: 6pt 8pt;
  text-align: left;
  font-weight: 700;
  font-size: 9pt;
  letter-spacing: 0.3pt;
}

tbody tr:nth-child(odd)  { background-color: #f0fdf4; }
tbody tr:nth-child(even) { background-color: #ffffff; }

tbody td {
  padding: 5pt 8pt;
  border-bottom: 0.5pt solid #d1fae5;
  vertical-align: top;
}

/* ── Lists ───────────────────────────────────────── */
ul, ol {
  margin: 4pt 0 6pt 0;
  padding-left: 18pt;
}

li {
  margin-bottom: 3pt;
  orphans: 2;
  widows: 2;
}

li > ul, li > ol {
  margin-top: 2pt;
}

/* ── Inline code / pre ───────────────────────────── */
code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 8.5pt;
  background: #f3f4f6;
  border-radius: 2pt;
  padding: 1pt 3pt;
  color: #1e3a5f;
}

pre {
  background: #f3f4f6;
  border-left: 3pt solid #059669;
  padding: 8pt 10pt;
  font-size: 8pt;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

/* ── Blockquote ──────────────────────────────────── */
blockquote {
  border-left: 3pt solid #059669;
  margin: 8pt 0;
  padding: 4pt 12pt;
  background: #f0fdf4;
  color: #374151;
  font-style: italic;
}

/* ── Links ───────────────────────────────────────── */
a {
  color: #059669;
  text-decoration: none;
}

/* ── Strong / em ─────────────────────────────────── */
strong { font-weight: 700; }
em     { font-style: italic; color: #4b5563; }

/* ── Avoid breaking after headings ──────────────── */
h1, h2, h3, h4 { page-break-after: avoid; }
h1 + *, h2 + *, h3 + *, h4 + * { page-break-before: avoid; }
""")

# ── Render PDF ─────────────────────────────────────────────────────────────────
print(f"Reading  : {MD_PATH}")
print(f"Writing  : {PDF_PATH}")

HTML(string=HTML_DOCUMENT).write_pdf(PDF_PATH, stylesheets=[CSS_STYLES])

print("Done. PDF generated successfully.")

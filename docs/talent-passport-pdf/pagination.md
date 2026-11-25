# Pagination and Page Composition

## 1. Fixed geometry

The backend renderer uses A4 portrait pages and a fixed content frame. Page 1 is
always the signature cover. The frame constants are in
`backend/src/talent_passport/document/tokens.py`:

- `MARGIN_X = 18 mm`
- `HEADER_HEIGHT = 15 mm`
- `FOOTER_HEIGHT = 16 mm`
- `CONTENT_TOP = PAGE_HEIGHT − HEADER_HEIGHT − 7 mm`
- `CONTENT_BOTTOM = FOOTER_HEIGHT + 7 mm`
- `CONTENT_WIDTH = PAGE_WIDTH − 2 × MARGIN_X`

Header and footer bands are drawn by `draw_page_header()` and
`draw_page_footer()` in `document/primitives.py`; the shared footer prints
`BRIDGE TO OPPORTUNITY`, the opaque document reference and `PAGE n / total`.

## 2. Measured flow engine

`FlowEngine` in `document/pagination.py` receives a list of measured `Block`
objects from `build_content_blocks(spec)` and places them in the frame:

1. `block.measure(CONTENT_WIDTH)` returns the required height using the same
   embedded fonts that draw the text.
2. If `top − height < CONTENT_BOTTOM`, the block moves to a new page.
3. If the block declares a `min_height` and `top − min_height < CONTENT_BOTTOM`,
   it also moves to a new page. This implements keep-with-next for a section
   heading plus its first content block (wrapped in `Group` by `_section()`).
4. `block.draw()` is called with absolute top-based coordinates. `FlowEngine`
   tracks the cursor in ReportLab's bottom-based coordinates and converts with
   `PAGE_HEIGHT − self.top` at the call boundary, because all `Block.draw()`
   implementations interpret `top` as a distance from the page top.
5. `top` decreases by the measured height plus `GAP_SMALL`.

The engine never reduces font sizes, scales the page or rasterizes content.
Long text blocks require at least two lines before a break so a single orphan
line is not left behind. Oversized atomic cards move intact to the next page.

## 3. Two-pass page numbering

`render_document()` in `document/renderer.py` renders twice:

1. First pass uses `total_pages = 0`; a `PyPDF2.PdfReader` counts the pages.
2. Second pass re-renders with the accurate total so every footer prints
   `PAGE n / total`.

`invariant=1` and `pageCompression=1` are set on the ReportLab canvas for
deterministic output. The rendering is content-aware: the page count depends on
the approved records in the spec, not on a forced fixed page count. The sample
document generated during verification produced four pages; the validator
requires at least two pages (cover plus content).

## 4. Section-level rules

- Section headings are numbered sequentially in `sections.py`.
- A heading and its first block are wrapped in a `Group`, so they stay together.
- Sections without approved data are omitted in the share edition; the personal
  record edition may show a small explicit empty note.
- `Spacer(SECTION_GAP)` separates completed sections.
- The final section always contains the `QRPanel`, edition label and disclaimer,
  so verification information is never orphaned from its heading.

## 5. Validation of pagination results

`validate_pdf()` checks that every page has an A4 MediaBox, that searchable text
contains the document title and reference, that embedded fonts and images are
present, and that at least one real hyperlink annotation exists. It returns a
summary dictionary (`pages`, `page_size_pt`, `embedded_fonts`, `hyperlinks`,
`embedded_images`, `text_characters`) that is stored in document metadata.

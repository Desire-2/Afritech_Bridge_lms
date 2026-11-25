# Print Reliability

## 1. A4 geometry

Every page is ReportLab `A4` portrait: 595.28 × 841.89 pt. The validator checks
each MediaBox within 1 pt tolerance. A real sample PDF was checked with
`pdfinfo`, which reported `Page size: 595.28 x 841.89 pts (A4)` and four pages.

## 2. No browser layout

The PDF is produced entirely by the backend renderer. The frontend only requests
and displays the returned bytes. There is no CSS page size, `@media print`,
canvas drawing, `window.print()` or html-to-PDF conversion in the Passport
module, so print output does not depend on browser zoom or screen layout.

## 3. Text and graphics

- Five TTF faces are embedded; `/FontFile2` markers are present in generated PDFs.
- Text is real selectable/searchable glyphs; validation extracts the title and
  document reference from the PDF text layer.
- Rules, panels, bars and the bridge motif are vector drawing operations.
- The official logo is embedded as `/DCTDecode` JPEG data inside an ASCII85 object.
  Raw `ff d8 ff` bytes are therefore not expected in the outer PDF stream;
  validation checks for `/DCTDecode` where appropriate.
- QR codes are embedded PNG images with high error correction.

## 4. Headers, footers and page numbers

The repeated header contains the official logo, `TALENT PASSPORT`, and the
edition label. The footer contains `BRIDGE TO OPPORTUNITY`, the opaque document
reference and `PAGE n / total`. Page totals come from the two-pass render, so the
numbers stay accurate when content length changes.

## 5. Rendered-page inspection

A sample PDF was rendered to PNG with `pdftoppm -png -r 110`. Page 1 was
inspected visually and showed the navy hero, logo chip, title, identity details,
document control, issuer line, QR/link area and footer as intended.

Text-position inspection with `pdftotext -bbox-layout` on the content pages
revealed a coordinate mismatch in the flow engine: bottom-based coordinates were
being passed to blocks that expect top-based coordinates, which placed sections
in reverse order and content above its headings. The `FlowEngine.place()` call
was corrected to convert `self.top` with `PAGE_HEIGHT - self.top`. After
regenerating, `pdftotext -layout` confirmed sections 01–03 on page 2, 04–07 on
page 3 and 08 on page 4, each heading above its content.

A second coordinate bug was found when the user reported that the logo was not
visible on the downloadable PDF. The logo bytes were embedded and validation
passed (`embedded_images >= 2`), but `assets.draw_logo()` passed its top-based
`top` directly to `canvas.drawImage()`, which expects a bottom-based origin. The
image was drawn just below the page edge. It now converts the lower edge with
`PAGE_HEIGHT - (top + height)`, matching every other drawing helper. Verification
included: (1) a recording-canvas unit test asserting the exact drawImage origin,
(2) an integration assertion that parses the PDF content stream and requires an
image placement above 70% of page height, and (3) rendering the regenerated PDF
to PNG at 150 dpi and counting dark logo pixels in the cover and page-2 header
regions (725 and 116 respectively). Both new tests fail when the old coordinate
is restored. Automated PDF tests were re-run after the fix (26 passed across the
Passport PDF and Passport modules).

## 6. Viewer guidance

For best results, print at 100% / actual size with A4 portrait paper and margins
set to none in the print dialog. The document already contains its own margins
and footer band. Do not use “fit to page” if the viewer scales A4 to a different
regional paper size.

# Professional Talent Passport PDF — Design System

This document describes the implemented visual system. All values are backend
constants in `backend/src/talent_passport/document/tokens.py`. No request field,
frontend component or template string can change them.

## 1. Page and frame

| Property | Value |
|---|---|
| Page | A4 portrait, 595.28 × 841.89 pt |
| Horizontal margin | 18 mm on each side |
| Header band | 15 mm |
| Footer band | 16 mm |
| Content top | `PAGE_HEIGHT − HEADER_HEIGHT − 7 mm` |
| Content bottom | `FOOTER_HEIGHT + 7 mm` |
| Drawing coordinate convention | Top-based helpers in `primitives.py`; conversion to ReportLab bottom-based coordinates happens in `page_y()` |

Every page uses the same frame. Page 1 is a signature cover; pages 2 onward use
the repeated header/footer and measured content flow.

## 2. Official palette

| Role | Hex |
|---|---|
| Navy | `#0B1C3A` |
| Teal | `#3ECFB2` |
| Orange | `#F07C2E` |
| Warm White | `#F8F8F5` |
| Paper | `#F0F1ED` |
| Dark Text | `#17212F` |
| Muted Grey | `#6D7884` |
| Light Line | `#DDE3E5` |

Soft alpha variants (`TEAL_WASH`, `ORANGE_WASH`, `NAVY_WASH`) are defined for
vector fills only. The official logo is embedded as its original JPEG bytes and
is never recolored, redrawn or stretched.

## 3. Typography

Five DejaVu TTF faces are vendored under `backend/assets/fonts/` and registered
as ReportLab `TTFont` faces in `document/text.py`:

| Registered name | File |
|---|---|
| `PassportSans` | `DejaVuSans.ttf` |
| `PassportSansBold` | `DejaVuSans-Bold.ttf` |
| `PassportSansItalic` | `DejaVuSans-Oblique.ttf` |
| `PassportSerif` | `DejaVuSerif.ttf` |
| `PassportSerifBold` | `DejaVuSerif-Bold.ttf` |

Body copy and interface labels use Sans; the cover title, name and large
statistics use Serif for an editorial credential feel. The full size/leading
table is `TYPE` in `tokens.py`. Text is drawn as real glyphs, not outlines or
images, so it remains selectable and searchable. Measured wrapping uses the same
registered fonts as final drawing.

## 4. Editorial structure

The cover (`document/cover.py`) uses a deep navy hero field, a warm-white logo
chip, an orange left rule, the two-line title `PROFESSIONAL / TALENT PASSPORT`,
the `Bridge to opportunity` line, a vector bridge motif, identity details, a
document-control block, an authorised-issuer line and a compact QR/link panel.

Content pages (`document/sections.py`) use numbered section headings and these
blocks from `document/blocks.py`:

- `StatStrip` — large serif numerals for completeness and record counts.
- `Panel` / `KeyValueRows` — identity and professional-direction panels.
- `TimelineRow` — learning milestones.
- `ChipRow` — grouped skills with backend-derived evidence status labels.
- `ProjectCard` — curated project submissions.
- `CredentialCard` — active official certificates.
- `AchievementRow` — awarded records.
- `QRPanel` — verification block with link and document metadata.
- `LogoMark` — closing official issuer signature on the final verification page.
- `Disclaimer` — scope and non-employment-guarantee wording.

Section order is fixed: Professional identity, Learning journey, Skills and
competencies, Project portfolio, Credentials, Achievements, Professional
direction, Final verification. Empty sections are omitted from the Professional
Share Edition. The Personal Record Edition may show an explicit empty note so
the owner can see what is missing; hidden sections never appear as placeholder
records.

### 4.1 Logo presentation

Logo presentation was refined using UI/UX design intelligence guidance
(Swiss/minimal style, trust navy, editorial serif accents). The official
`logo.jpg` bytes are still embedded unchanged — only its container and scale
changed:

- Cover: the mark was enlarged from 14 mm to 20 mm and fitted tightly in a
  warm-white chip with a 0.7 mm teal baseline that echoes the hero accent rule.
- Repeated header: the mark was enlarged from 6 mm to 8 mm in a taller chip.
- Final verification: a `LogoMark` block adds a closing issuer signature with
  “OFFICIAL DOCUMENT / AfriTech Bridge / Bridge to opportunity”.

No redrawing, recolouring or stretching of the official asset occurs.

## 5. Brand motif

`draw_bridge_motif()` in `document/primitives.py` draws a vector suspension
bridge: deck, two pylons, cable fans and an orange node. It is generated from
coordinates, not raster artwork, and communicates the “Bridge to Opportunity”
identity without imitating a government passport or certificate template.

## 6. Asset rules

- Official logo source: `backend/static/images/logo.jpg`; loaded via
  `ImageReader` from repository bytes.
- `draw_logo()` computes a uniform scale from the image's own pixel dimensions
  and passes `preserveAspectRatio=True`.
- QR codes are generated server-side from a trusted absolute verification URL
  using `qrcode` with `ERROR_CORRECT_H`; the renderer refuses non-http(s) URLs.
- No remote asset fetch and no request-supplied image path is accepted.
- No profile portrait, project screenshot field or badge image pipeline exists
  in the LMS, so none is fabricated.

## 7. Metadata and links

`document/renderer.py` sets PDF title, author, subject, creator and keywords
from `tokens.py` before drawing. `draw_link_text()` registers real PDF
`linkURL` annotations. The verification QR and link reference the opaque
`document_ref`, never an internal database id or a raw hash.

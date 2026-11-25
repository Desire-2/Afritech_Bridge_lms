"""Section composition for content pages.

The order below is fixed. Sections with no approved data are omitted from the
share edition; the personal record edition may show an explicit empty note so
the learner can see what is missing without exposing another data source.
"""

from __future__ import annotations

from typing import List, Tuple

from . import tokens as t
from .blocks import (
    AchievementRow,
    Block,
    ChipRow,
    CredentialCard,
    Disclaimer,
    Group,
    KeyValueRows,
    LogoMark,
    Panel,
    ProjectCard,
    QRPanel,
    SectionHeading,
    Spacer,
    StatStrip,
    Text,
    TimelineRow,
)
from .spec import DocumentSpec
from .text import one_line

EMPTY_NOTE = "No approved records in this section yet."
DISCLAIMER = (
    "This document summarizes records captured by the AfriTech Bridge LMS. It is "
    "not an employment guarantee, a transcript, or a substitute for an official "
    "certificate. Verification is available only for the document reference shown "
    "above. Hidden sections are never represented by placeholder records."
)


def _heading(number: int, title: str, subtitle: str = "") -> SectionHeading:
    return SectionHeading(f"{number:02d}", title, subtitle or None)


def _section(heading: SectionHeading, content: List[Block]) -> List[Block]:
    """Keep a section heading and its first block on the same page."""
    if not content:
        return [heading]
    return [Group([heading, content[0]], gap=t.GAP_SMALL)] + content[1:]


def _identity(spec: DocumentSpec, number: int) -> List[Block]:
    profile = spec.profile or {}
    rows: List[Tuple[str, object]] = []
    if profile.get("headline"):
        rows.append(("Professional identity", profile["headline"]))
    location = ", ".join(part for part in (profile.get("city"), profile.get("country")) if part)
    if location:
        rows.append(("Location", location))
    if profile.get("summary"):
        rows.append(("Summary", profile["summary"]))
    if profile.get("languages"):
        languages = profile["languages"]
        if isinstance(languages, list):
            rows.append(("Languages", ", ".join(str(item) for item in languages)))
    # Contact details appear only when the backend public serializer included
    # them because the owner explicitly enabled show_email/show_phone.
    if profile.get("email"):
        rows.append(("Email", profile["email"]))
    if profile.get("phone"):
        rows.append(("Phone", profile["phone"]))
    if not rows:
        if spec.edition != "professional_share":
            return [_heading(number, "Professional identity"), Text(EMPTY_NOTE, "small")]
        return []

    blocks: List[Block] = []
    stats = []
    if spec.completeness is not None:
        stats.append((f"{spec.completeness}%", "Profile completeness"))
    for label, value in (("Verified skills", spec.stats.get("skills_verified")),
                         ("Certificates", spec.stats.get("certificates")),
                         ("Projects", spec.stats.get("projects"))):
        if value is not None:
            stats.append((str(value), label))
    if stats:
        blocks.append(StatStrip(stats[:4]))
    blocks.append(Panel([KeyValueRows(rows)], fill=t.WARM_WHITE))
    return _section(
        _heading(number, "Professional identity",
                 "Self-described professional information approved for this edition"),
        blocks,
    )


def _learning(spec: DocumentSpec, number: int) -> List[Block]:
    if not spec.learning:
        if spec.edition != "professional_share":
            return [_heading(number, "Learning journey"), Text(EMPTY_NOTE, "small")]
        return []
    blocks: List[Block] = [TimelineRow(item) for item in spec.learning]
    return _section(
        _heading(number, "Learning journey",
                 "Milestones from canonical LMS records, newest first"),
        blocks,
    )


def _skills(spec: DocumentSpec, number: int) -> List[Block]:
    if not spec.skills:
        if spec.edition != "professional_share":
            return [_heading(number, "Skills and competencies"), Text(EMPTY_NOTE, "small")]
        return []
    grouped: dict[str, List[str]] = {}
    for item in spec.skills:
        category = one_line(item.get("category")) or "General"
        label = one_line(item.get("name")) or "Skill"
        qualifier = one_line(item.get("proficiency_level")) or one_line(item.get("status"))
        grouped.setdefault(category, []).append(f"{label} · {qualifier}" if qualifier else label)
    blocks: List[Block] = []
    for category, values in grouped.items():
        blocks.append(Panel([Text(category.upper(), "label", t.ORANGE), ChipRow(values)],
                            fill=t.WARM_WHITE))
    return _section(
        _heading(number, "Skills and competencies",
                 "Status reflects evidence rules; no self-asserted proficiency is shown"),
        blocks,
    )


def _projects(spec: DocumentSpec, number: int) -> List[Block]:
    if not spec.projects:
        if spec.edition != "professional_share":
            return [_heading(number, "Project portfolio"), Text(EMPTY_NOTE, "small")]
        return []
    blocks: List[Block] = [ProjectCard(item) for item in spec.projects]
    return _section(
        _heading(number, "Project portfolio",
                 "Curated work derived from LMS submissions and learner context"),
        blocks,
    )


def _credentials(spec: DocumentSpec, number: int) -> List[Block]:
    if not spec.certificates:
        if spec.edition != "professional_share":
            return [_heading(number, "Credentials"), Text(EMPTY_NOTE, "small")]
        return []
    blocks: List[Block] = [CredentialCard(item) for item in spec.certificates]
    return _section(
        _heading(number, "Credentials",
                 "Active official certificates only; verify each reference independently"),
        blocks,
    )


def _achievements(spec: DocumentSpec, number: int) -> List[Block]:
    if not spec.achievements:
        if spec.edition != "professional_share":
            return [_heading(number, "Achievements"), Text(EMPTY_NOTE, "small")]
        return []
    blocks: List[Block] = [AchievementRow(item) for item in spec.achievements]
    return _section(
        _heading(number, "Achievements",
                 "Awarded records mirrored from canonical LMS achievement services"),
        blocks,
    )


def _direction(spec: DocumentSpec, number: int) -> List[Block]:
    direction = spec.direction or {}
    rows: List[Tuple[str, object]] = []
    for label, key in (
        ("Interests", "career_interests"),
        ("Specialization", "areas_of_specialization"),
        ("Goals", "professional_goals"),
        ("Work preference", "preferred_work_arrangement"),
        ("Opportunities", "preferred_opportunities"),
    ):
        value = direction.get(key)
        if isinstance(value, list):
            value = ", ".join(str(item) for item in value if str(item).strip())
        if one_line(value):
            rows.append((label, value))
    if direction.get("links"):
        links = direction["links"]
        if isinstance(links, list):
            rows.append(("Links", ", ".join(str(item) for item in links if str(item).strip())))
    if not rows:
        if spec.edition != "professional_share":
            return [_heading(number, "Professional direction"), Text(EMPTY_NOTE, "small")]
        return []
    return _section(
        _heading(number, "Professional direction",
                 "Stated direction, not a placement or employment claim"),
        [Panel([KeyValueRows(rows)], fill=t.PAPER)],
    )


def build_content_blocks(spec: DocumentSpec) -> List[Block]:
    """Return the complete ordered content flow for non-cover pages."""
    builders = (_identity, _learning, _skills, _projects, _credentials,
                _achievements, _direction)
    blocks: List[Block] = []
    section_number = 1
    for builder in builders:
        section_blocks = builder(spec, section_number)
        if section_blocks:
            blocks.extend(section_blocks)
            blocks.append(Spacer(t.SECTION_GAP))
            section_number += 1

    final_panel = Panel([
        LogoMark(),
        QRPanel(spec.verification_url, spec.document_ref, spec.generated_at,
                spec.template_version, spec.status_label),
        Text(spec.edition_label, "small_bold", t.NAVY),
        Text(DISCLAIMER, "small"),
    ], fill=t.WARM_WHITE, gap=t.GAP_MEDIUM)
    blocks.extend(_section(
        _heading(section_number, "Final verification",
                 "Document integrity and official verification route"),
        [final_panel],
    ))
    return blocks

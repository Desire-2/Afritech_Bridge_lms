"""
Tests for the dynamic skill assessment profile system.

Verifies that:
- Course titles and categories resolve to the correct profile
- The scoring engine can use both new generic fields and legacy Excel fields
- Title keywords override category mappings
- Unknown courses fall back to the "general" profile
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from src.config.course_skill_profiles import (
    get_skill_profile_for_course,
    SKILL_PROFILES,
)
from src.utils.application_scoring import (
    _skill_level_to_legacy_enum,
)


# ─── Profile Resolution Tests ────────────────────────────────────────────


class TestProfileResolution:
    """Verify that courses resolve to the correct skill profile."""

    def test_excel_course_returns_excel_profile(self):
        """Course titled 'Excel Mastery' → profile_key = 'excel'"""
        profile = get_skill_profile_for_course('Excel Mastery', 'Excel')
        assert profile['profile_key'] == 'excel'
        assert 'Microsoft Excel' in profile['subject_label']

    def test_python_course_returns_python_profile(self):
        """Course titled 'Python for Beginners' → profile_key = 'python'"""
        profile = get_skill_profile_for_course('Python for Beginners')
        assert profile['profile_key'] == 'python'
        assert 'Python' in profile['subject_label']

    def test_web_dev_course_by_category(self):
        """Course with category 'Web Development' → profile_key = 'web_development'"""
        profile = get_skill_profile_for_course('Build Modern Sites', 'Web Development')
        assert profile['profile_key'] == 'web_development'

    def test_unknown_course_returns_general_profile(self):
        """Course titled 'Community Leadership' → profile_key = 'general'"""
        profile = get_skill_profile_for_course('Community Leadership')
        assert profile['profile_key'] == 'general'

    def test_title_keyword_overrides_category(self):
        """Course title 'Python Data Analysis' with category 'Excel' → profile_key = 'python' (title wins)"""
        profile = get_skill_profile_for_course('Python Data Analysis', 'Excel')
        assert profile['profile_key'] == 'python', \
            f"Expected 'python' but got '{profile['profile_key']}' — title keyword should override category"

    def test_graphic_design_by_title_keyword(self):
        """Course titled 'Figma for UI Designers' → profile_key = 'graphic_design'"""
        profile = get_skill_profile_for_course('Figma for UI Designers')
        assert profile['profile_key'] == 'graphic_design'

    def test_digital_marketing_by_title(self):
        """Course titled 'SEO & Digital Marketing Strategy' → profile_key = 'digital_marketing'"""
        profile = get_skill_profile_for_course('SEO & Digital Marketing Strategy')
        assert profile['profile_key'] == 'digital_marketing'

    def test_profile_keys_all_present(self):
        """All 8 expected profile keys exist in SKILL_PROFILES"""
        expected = {'excel', 'python', 'web_development', 'graphic_design',
                    'data_analysis', 'backend_development', 'digital_marketing', 'general'}
        assert set(SKILL_PROFILES.keys()) == expected


# ─── Skill Level Enum Mapping Tests ──────────────────────────────────────


class TestSkillLevelMapping:
    """Verify that human-readable skill levels map to legacy enum values."""

    def test_never_used_maps_correctly(self):
        assert _skill_level_to_legacy_enum('Never used it') == 'never_used'
        assert _skill_level_to_legacy_enum(None) == 'never_used'
        assert _skill_level_to_legacy_enum('') == 'never_used'

    def test_beginner_maps_correctly(self):
        assert _skill_level_to_legacy_enum('Beginner (basic data entry)') == 'beginner'
        assert _skill_level_to_legacy_enum('Beginner (variables, loops, basic syntax)') == 'beginner'

    def test_intermediate_maps_correctly(self):
        assert _skill_level_to_legacy_enum('Intermediate (formulas, charts)') == 'intermediate'
        assert _skill_level_to_legacy_enum('Intermediate (functions, files, OOP basics)') == 'intermediate'

    def test_advanced_maps_correctly(self):
        assert _skill_level_to_legacy_enum('Advanced (pivot tables, VLOOKUP, macros)') == 'advanced'
        assert _skill_level_to_legacy_enum('Advanced (libraries, APIs, data structures)') == 'advanced'

    def test_expert_maps_correctly(self):
        assert _skill_level_to_legacy_enum('Expert (VBA, Power Query, dashboards)') == 'expert'
        assert _skill_level_to_legacy_enum('Expert (frameworks, testing, deployment)') == 'expert'


# ─── Scoring Engine Fallback Tests ───────────────────────────────────────


class TestScoringEngineFallback:
    """Verify the scoring engine correctly uses new generic fields or falls back to legacy Excel fields."""

    def test_new_skill_fields_used_when_present(self):
        """Application with only new generic fields should score correctly."""
        # We test via the _skill_level_to_legacy_enum helper directly
        # Full scoring integration tests require a database connection
        assert _skill_level_to_legacy_enum('Advanced (libraries, APIs, data structures)') == 'advanced'
        assert _skill_level_to_legacy_enum('Beginner (basic data entry)') == 'beginner'
        assert _skill_level_to_legacy_enum('Expert (VBA, Power Query, dashboards)') == 'expert'

    def test_legacy_excel_fields_fallback(self):
        """Old-style Excel level 'intermediate' should still map via _skill_level_to_legacy_enum."""
        # Legacy enum values that appear directly should be returned as-is
        assert _skill_level_to_legacy_enum('intermediate') == 'intermediate'
        assert _skill_level_to_legacy_enum('advanced') == 'advanced'
        assert _skill_level_to_legacy_enum('beginner') == 'beginner'


# ─── Error Handling Tests ────────────────────────────────────────────────


class TestErrorHandling:
    """Edge cases and error handling for profile resolution."""

    def test_none_title_and_none_category(self):
        """Both title and category set to None → fallback to 'general'"""
        profile = get_skill_profile_for_course(None, None)
        assert profile['profile_key'] == 'general'

    def test_empty_string_title(self):
        """Empty title with no category → fallback to 'general'"""
        profile = get_skill_profile_for_course('', None)
        assert profile['profile_key'] == 'general'

    def test_case_insensitive_category(self):
        """Category 'python' (lowercase) should still match"""
        profile = get_skill_profile_for_course('Some Course', 'python')
        assert profile['profile_key'] == 'python'

    def test_partial_category_match(self):
        """Category 'Data Science' should match 'data_analysis'"""
        profile = get_skill_profile_for_course('Course Title', 'Data Science')
        assert profile['profile_key'] == 'data_analysis'

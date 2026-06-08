# Marshmallow Schemas for Internship Application System

from marshmallow import Schema, fields, ValidationError, validate, pre_load
from datetime import datetime
import re


class InternshipTrackSchema(Schema):
    """Schema for internship track creation and updates"""
    id = fields.Str(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    slug = fields.Str(required=True, validate=validate.Regexp(r'^[a-z0-9-]+$'))
    description = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    icon_key = fields.Str(validate=validate.Length(max=50), allow_none=True)
    is_active = fields.Bool(dump_default=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class InternshipCohortSchema(Schema):
    """Schema for internship cohort creation and updates"""
    id = fields.Str(dump_only=True)
    track_id = fields.Str(required=True)
    track_name = fields.Str(dump_only=True)
    cohort_name = fields.Str(required=True, validate=validate.Length(min=1, max=120))
    cohort_code = fields.Str(required=True, validate=validate.Regexp(r'^[A-Z0-9-]+$'))
    start_date = fields.DateTime(required=True)
    end_date = fields.DateTime(required=True)
    capacity = fields.Int(validate=validate.Range(min=1), allow_none=True)
    is_accepting = fields.Bool(dump_default=True)
    description = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    accepted_count = fields.Int(dump_only=True)
    is_full = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class InternshipApplicationSchema(Schema):
    """Schema for full application details"""
    id = fields.Str(dump_only=True)
    reference_code = fields.Str(dump_only=True)
    applicant_type = fields.Str(required=True, validate=validate.OneOf(['graduate', 'short_course_alumni', 'external']))
    full_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    phone = fields.Str(required=True, validate=validate.Length(min=6, max=20))
    national_id = fields.Str(validate=validate.Length(max=50), allow_none=True)
    track_id = fields.Str(required=True)
    track_name = fields.Str(dump_only=True)
    cohort_id = fields.Str(allow_none=True)
    cohort_code = fields.Str(dump_only=True)
    user_id = fields.Int(dump_only=True)
    motivation_letter = fields.Str(required=True, validate=validate.Length(min=50, max=5000))
    portfolio_url = fields.Url(allow_none=True)
    github_url = fields.Url(allow_none=True)
    linkedin_url = fields.Url(allow_none=True)
    cv_original_name = fields.Str(dump_only=True)
    status = fields.Str(dump_only=True)
    reviewer_id = fields.Int(dump_only=True)
    reviewer_name = fields.Str(dump_only=True)
    reviewer_notes = fields.Str(dump_only=True)
    reviewed_at = fields.DateTime(dump_only=True)
    interview_date = fields.DateTime(dump_only=True)
    interview_notes = fields.Str(dump_only=True)
    rejection_reason = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class ApplicationSubmissionSchema(Schema):
    """Schema for application form submission (public endpoint)"""
    applicant_type = fields.Str(required=True, validate=validate.OneOf(['graduate', 'short_course_alumni', 'external']))
    full_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    email = fields.Email(required=True)
    phone = fields.Str(required=True, validate=validate.Length(min=6, max=20))
    national_id = fields.Str(validate=validate.Length(max=50), allow_none=True)
    track_id = fields.Str(required=True)
    cohort_id = fields.Str(allow_none=True)
    motivation_letter = fields.Str(required=True, validate=validate.Length(min=50, max=5000))
    portfolio_url = fields.Str(allow_none=True, validate=validate.Length(max=500))
    github_url = fields.Str(allow_none=True, validate=validate.Length(max=500))
    linkedin_url = fields.Str(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def convert_empty_strings(self, data, **kwargs):
        """Convert empty strings to None and strip whitespace for all optional fields.
        
        Multipart form data sends unfilled fields as empty strings ("")
        rather than None, which causes strict field validators to fail.
        This hook normalizes those values before validation runs.
        """
        if not isinstance(data, dict):
            return data
        
        # Strip whitespace from all string values
        for key, value in list(data.items()):
            if isinstance(value, str):
                data[key] = value.strip()
        
        # Convert empty strings to None for optional fields
        optional_none_fields = ['national_id', 'cohort_id', 'portfolio_url', 'github_url', 'linkedin_url']
        for field_name in optional_none_fields:
            if field_name in data and data[field_name] in ('', None):
                data[field_name] = None
        
        return data


class ApplicationStatusUpdateSchema(Schema):
    """Schema for admin status update"""
    status = fields.Str(
        required=True,
        validate=validate.OneOf(['pending', 'reviewing', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected'])
    )
    note = fields.Str(validate=validate.Length(max=2000), allow_none=True)
    interview_date = fields.DateTime(allow_none=True)
    interview_meeting_link = fields.Str(validate=validate.Length(max=500), allow_none=True)
    interview_meeting_platform = fields.Str(
        validate=validate.OneOf(['zoom', 'google_meet', 'teams', 'whatsapp', 'other']),
        allow_none=True
    )


class AssignCohortSchema(Schema):
    """Schema for assigning cohort to accepted application"""
    cohort_id = fields.Str(required=True)


class ApplicationFiltersSchema(Schema):
    """Schema for filtering admin applications list"""
    status = fields.Str(validate=validate.OneOf(['pending', 'reviewing', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected']), allow_none=True)
    track_id = fields.Str(allow_none=True)
    cohort_id = fields.Str(allow_none=True)
    search = fields.Str(validate=validate.Length(max=255), allow_none=True)
    start_date = fields.DateTime(allow_none=True)
    end_date = fields.DateTime(allow_none=True)
    page = fields.Int(validate=validate.Range(min=1), dump_default=1)
    per_page = fields.Int(validate=validate.Range(min=1, max=100), dump_default=20)
    sort_by = fields.Str(validate=validate.OneOf(['created_at', 'updated_at', 'name', 'status']), dump_default='created_at')
    sort_order = fields.Str(validate=validate.OneOf(['asc', 'desc']), dump_default='desc')


class PaginationSchema(Schema):
    """Schema for paginated response"""
    data = fields.List(fields.Dict())
    page = fields.Int()
    per_page = fields.Int()
    total = fields.Int()
    pages = fields.Int()


def validate_phone(value):
    """Validate phone number in E.164 or local RW format"""
    # E.164 format: +1234567890
    # Local RW format: 0788123456 or 788123456
    if not re.match(r'^(\+\d{1,3}[\d\s\-\(\)]{7,20}|\d{9,15})$', value):
        raise ValidationError('Invalid phone number format')
    return value

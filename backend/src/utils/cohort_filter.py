"""
Cohort scoping helpers shared by the instructor routes and the inactivity
service.

A cohort's authoritative identity is ``Enrollment.application_window_id``.
Some older enrollments only carry ``Enrollment.cohort_label``, so a query that
filters purely on the window foreign key silently misses them - the cohort card
and the student table would show students that the query cannot see.
"""

from sqlalchemy import and_, or_, false

from ..models.course_models import ApplicationWindow, Enrollment


def apply_cohort_filter(query, cohort_id=None, cohort_label=None, course_id=None):
    """Filter an enrollment query using the same cohort identity as cohort cards.

    ``application_window_id`` is the canonical relationship.  Some older
    enrollments only have ``cohort_label`` populated, so include those rows
    when the selected window has the same label.  When an ID is supplied it
    takes precedence over a label supplied by the client; otherwise a stale
    label can turn a valid cohort selection into an empty result set.
    """
    if cohort_id is not None:
        window_query = ApplicationWindow.query.filter_by(id=cohort_id)
        if course_id is not None:
            window_query = window_query.filter_by(course_id=course_id)
        window = window_query.first()

        if not window:
            return query.filter(false())

        cohort_matches = [Enrollment.application_window_id == window.id]
        if window.cohort_label:
            cohort_matches.append(
                and_(
                    Enrollment.application_window_id.is_(None),
                    Enrollment.cohort_label == window.cohort_label,
                )
            )
        return query.filter(or_(*cohort_matches))

    if cohort_label:
        return query.filter(Enrollment.cohort_label == cohort_label)

    return query

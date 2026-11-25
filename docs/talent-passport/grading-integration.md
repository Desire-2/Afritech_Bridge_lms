# Grading and event integration

## Hook contract

All write paths call the same failure-isolated entry point:

```python
notify_talent_passport(
    event_type, student_id, source_type, source_id,
    course_id=None, suffix=None,
)
```

`hooks.py` records the event inside a SAVEPOINT, logs and swallows all
exceptions, and never commits the originating LMS transaction. The event key is
a hash of `event_type|student_id|source_type|source_id|suffix`. Repeats with the
same suffix are no-ops; meaningful corrections must use a new suffix.

## Wired canonical write paths

| File | Event(s) | Suffix behavior |
|---|---|---|
| `src/routes/file_upload_routes.py` | `assignment.submitted`, `assignment.resubmitted`, `project.submitted` | Resubmission uses `submitted_at`; team-member events use `team-member`. |
| `src/routes/student_routes.py` | `assignment.submitted`, `project.submitted`, `quiz.submitted` | Submission/end timestamps, with `team:<marker>` for members. |
| `src/routes/quiz_progress_routes.py` | `quiz.submitted` | `<attempt status>:<end_time or id>`, distinguishing graded vs manual-pending attempts. |
| `src/routes/grading_routes.py` | `assignment.graded`, `project.graded` | `instructor:<graded_at>`, `bulk:<graded_at>`, `team-member:<graded_at>`, `quick:<graded_at>`. |
| `src/services/aage/persistence.py` | `aage.published` | `result-<id>-<published_at>`; called before `db_commit()` so publication is seen by Passport. |
| `src/services/excel_grading/auto_grader.py` | `excel.graded`, `excel.reviewed` | `preliminary:<time>`, `<instructor_reviewed>:<review time>`. |
| `src/routes/excel_grading_routes.py` | `excel.reviewed` | `instructor:<reviewed_at or legacy id>`. |
| `src/services/certificate_service.py` | `certificate.issued`, `certificate.updated` | Force-refresh updates use `score:<overall_score>`. |
| `src/services/achievement_service.py` | `achievement.awarded` | `<times_earned>:<earned_at>`. |
| `src/services/enrollment_progress_service.py` | `enrollment.progress`, `course.completed` | `<progress>:<status>:<completed_at>`. |

AAGE route-level hooks were deliberately removed: they ran after commit and
would not persist reliably. The single canonical hook now lives in
`write_through_grade` before `db_commit()`.

## Provenance handled by the evidence engine

- AAGE: official only when `is_official=True` or `status == "published"`, with
  an approved `GradingReview` where required.
- Excel: authoritative only when `instructor_reviewed=True`.
- Classic grading: `graded_by` alone is insufficient; the engine requires a
  staff grader signal or `GradingHistory`.
- Team projects: shared grades are downgraded to `awaiting_review` with no score
  until an individual contribution is explicitly verified.
- Certificates: active and unexpired → verified; inactive/expired → rejected.

## Known manual-sync-only gaps

These paths were identified during the hook audit and are intentionally
documented rather than hidden:

1. Certificate revocation/expiry has no dedicated hook. The engine understands
   `is_active=False` and expiry, but sync must be triggered after a hard delete
   or deactivation outside `CertificateService`.
2. Enrollment creation/deletion write sites have no hook. `LEARNING` evidence is
   created when progress/certificate flows or a full backfill runs.
3. Module/lesson completion has no hook or dedicated synchronizer.
   `SOURCE_MODULE`/`SOURCE_LESSON` constants exist but no event is emitted.
4. Mapping create/update/delete does not immediately recompute existing skills;
   changes take effect on the next sync.
5. Skill-badge award/verification changes have no hook. Only verified
   `StudentSkillBadge` rows are mirrored when achievements sync.

The recovery path for all five is `POST /api/v1/student/talent-passport/sync`
or `backfill_students()`. These gaps are listed again in the final report under
limitations.

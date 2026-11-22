# Instructor guide — Assessment Intelligence

Open **Instructor → Assessment Intelligence** in the LMS. The page is available to
instructors and admins; other roles see an access-denied message.

## 1. Build and approve a rubric

1. Choose the course and an assignment or project.
2. Click **Generate AI rubric**. The engine first analyzes the description,
   instructions, deliverables, learning objectives and technologies, then drafts
   criteria, weights, maximum marks, performance levels, evidence requirements and
   suggested evaluators. Nothing is graded at this step.
3. Review the draft. The **weight total must read 100/100** before approval. Add or
   remove criteria, adjust levels and state exactly what evidence is required.
4. Preview the draft, then **Approve**. Approval freezes a versioned snapshot;
   subsequent edits create a new version instead of changing graded history.

Existing manual and Excel grading continue to work unchanged. A rubric that is
already approved or has graded submissions is never edited in place: the editor
forks a new draft linked to the original, leaving the graded snapshot intact.

## 2. Run grading

Use the **Grading Queue** to filter by course, assessment, submission type,
evaluator, status, confidence, review requirement and date.

- **Start grading** enqueues a persistent job. Jobs are idempotent: submitting the
  same request while one is active returns the existing job.
- The queue polls job status. A job can be **retried** (bounded attempts) or
  **cancelled**; neither leaves a half-written grade.
- Evidenced results self-approve after a successful job, like Excel grading.
  Results stay **under review** only for real blockers: a provisional rubric,
  a failed deterministic check, evaluator conflict, `UNVERIFIED` evidence,
  unresolved artifacts or low publishability confidence.

The engine reads submitted source/documents as text only. It never executes student
code. ZIPs are checked for path traversal, symlinks, nested archives, binaries and
declared-size ZIP bombs before any file content is used.

## 3. Review a result

Open a pending review. The workspace shows:

- the submission and its safe file manifest;
- evaluator outputs, versions and conflicts;
- criterion marks, rationale, feedback, limitations and evidence category;
- confidence factors and warnings;
- grading history and prior instructor corrections.

To correct a mark, enter a new value and a **required reason**. The final score is
recomputed by deterministic Python code; the model never recalculates it. You can
record a broader correction explanation, which becomes a learning-example candidate
with the original and adjusted scores, rubric/evaluator versions, provider, model,
evidence and your explanation.

Finish with **Approve** or **Reject with reason**. Approval allows publication;
automatic approval uses the same write-through path. Publication updates the same
`submission.grade` row used by manual grading, so module progress, course score,
the 70% certificate rule and notifications behave exactly as before.

## 4. Learning and calibration

The **Learning & Calibration** tab reports where AI scores differed from instructor
scores, frequent correction patterns and per-evaluator quality. Correction examples
are not used until explicitly approved.

A calibration run compares a candidate evaluator version with the current production
version over approved examples/cases using MAE, criterion agreement, false pass/fail
rates and override rate. If there is not enough benchmark data, the run says so.
A candidate becomes active only after **Approve version**. **Rollback** restores the
previous production version. Every action is audited.

## 5. Administrative controls

Admins can enable/disable evaluators, inspect policy thresholds and change
confidence/review/auto-publish policy. `auto_approve_enabled` (default on) and
`auto_approve_min` (default 70) control the Excel-style path; the stricter
`auto_publish_*` keys are independent. Policy changes apply to new runs only;
they never retroactively alter an existing grade.

## 6. What students see

Students see only published results: grade, criterion marks, feedback, strengths,
areas for improvement, resources and status. Internal prompts, benchmark data,
raw evaluator packets, confidence internals and other students' evidence are never
shown to them.

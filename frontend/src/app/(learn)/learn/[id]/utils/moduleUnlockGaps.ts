// Helpers that surface WHICH lessons block a module unlock.
//
// The unlock-eligibility API already returns `lesson_requirements.failed_lessons`
// (id, title, status, score, requirements, completed) and `recommendations`,
// but most UI surfaces only rendered counts ("Complete N more lesson(s)",
// "Lessons: X/Y passed"). These helpers turn that payload into display-ready
// items so the interface can name every blocking lesson and what is missing.

export interface EligibilityFailedLesson {
  id: number;
  title: string;
  order?: number;
  status?: string;
  score?: number;
  current_score?: number;
  required_score?: number;
  completed?: boolean;
  requirements?: string[];
}

export interface UnlockErrorInfo {
  mainError: string;
  failedLessons: Array<{
    id: number;
    title: string;
    order: number;
    requirements: string[];
    lessonScore: number;
  }>;
  previousModule?: {
    id: number;
    title: string;
    order: number;
  };
  validationErrors: string[];
  lessonsChecked: number;
  lessonsPassed: number;
  moduleScore: number;
  actionRequired: string;
}

/**
 * Short human labels for one failed lesson's requirement strings.
 * Mirrors EnhancedModuleUnlockService._summarize_lesson_requirements —
 * every requirement yields a label (the old keyword filter silently
 * dropped the video-90% and reading-start messages, leaving lessons
 * unnamed).
 */
export function summarizeRequirementLabels(requirements?: string[] | null): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const req of requirements ?? []) {
    const low = (req ?? '').toLowerCase();
    let label: string;
    if (low.includes('started')) {
      label = 'start the lesson';
    } else if (low.includes('video') || low.includes('watch')) {
      label = 'watch 90%+ of the video';
    } else if (low.includes('quiz')) {
      label = 'pass the quiz';
    } else if (low.includes('assignment')) {
      label = 'pass the assignment';
    } else if (low.includes('reading') || low.includes('engagement')) {
      label = 'finish reading & engagement';
    } else if (low.includes('score') || low.includes('80%')) {
      label = 'reach an 80% lesson score';
    } else {
      label = (req ?? '').trim().slice(0, 80) || 'complete lesson requirements';
    }
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.length > 0 ? labels : ['complete lesson requirements'];
}

export function failedLessonsFromEligibility(eligibility: any): EligibilityFailedLesson[] {
  const list = eligibility?.lesson_requirements?.failed_lessons;
  if (!Array.isArray(list)) return [];
  return list as EligibilityFailedLesson[];
}

/**
 * One display line per blocking lesson: title, whether the lesson was
 * already marked completed, and what is missing.
 */
export function failedLessonItems(eligibility: any): string[] {
  return failedLessonsFromEligibility(eligibility).map((lesson) => {
    const title = lesson.title || `Lesson ${lesson.id}`;
    const labels = summarizeRequirementLabels(lesson.requirements);
    const head =
      lesson.completed === true
        ? `Lesson “${title}” — marked completed, but re-check failed`
        : `Lesson “${title}” — not completed`;
    return `${head}: ${labels.join(', ')}`;
  });
}

/**
 * missingItems for the module-progress modal: failed lessons first (named
 * individually), then the backend recommendations minus their own
 * `Lesson '…'` lines so nothing is listed twice.
 */
export function mergeMissingItems(eligibility: any): string[] {
  const lessonItems = failedLessonItems(eligibility);
  const recommendations: string[] = Array.isArray(eligibility?.recommendations)
    ? eligibility.recommendations.filter(
        (rec: any) => typeof rec === 'string' && !rec.startsWith("Lesson '")
      )
    : [];
  return [...lessonItems, ...recommendations];
}

/**
 * Build the ModuleUnlockErrorDialog payload straight from an eligibility
 * response, so the "what exactly is missing" dialog can be opened even
 * when the manual Unlock button is hidden behind the frontend count gate.
 */
export function buildUnlockErrorInfo(eligibility: any): UnlockErrorInfo {
  const lessonReq = eligibility?.lesson_requirements ?? {};
  const failed = failedLessonsFromEligibility(eligibility);
  const blockingMessage =
    lessonReq.blocking_message ||
    (lessonReq.has_critical_failures
      ? 'Critical lesson requirements are blocking this module'
      : null);
  const mainError =
    blockingMessage ||
    (failed.length > 0
      ? `${failed.length} lesson${failed.length === 1 ? '' : 's'} in the previous module ${
          failed.length === 1 ? 'does' : 'do'
        } not meet requirements yet`
      : 'Module requirements are not met yet');

  return {
    mainError,
    failedLessons: failed.map((lesson) => ({
      id: lesson.id,
      title: lesson.title || `Lesson ${lesson.id}`,
      order: lesson.order ?? 0,
      requirements: Array.isArray(lesson.requirements) ? lesson.requirements : [],
      lessonScore: lesson.score ?? lesson.current_score ?? 0,
    })),
    previousModule: eligibility?.previous_module,
    validationErrors: [],
    lessonsChecked: lessonReq.total_count ?? 0,
    lessonsPassed: lessonReq.passed_count ?? 0,
    moduleScore: eligibility?.total_score ?? 0,
    actionRequired: 'complete_requirements',
  };
}

// ── LocalStorage Helpers for Lesson Progress ────────────────────────

const STORAGE_KEY_PREFIX = "learn_progress_";
const MAX_AGE_DAYS = 7;

export interface SavedLessonProgress {
  lessonId: number;
  moduleId: number;
  timestamp: string;
}

export function saveLastLesson(
  courseId: number,
  lessonId: number,
  moduleId: number
): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${courseId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        lessonId,
        moduleId,
        timestamp: new Date().toISOString(),
      } satisfies SavedLessonProgress)
    );
  } catch (error) {
    console.error("Failed to save lesson progress to localStorage:", error);
  }
}

export function loadLastLesson(
  courseId: number
): { lessonId: number; moduleId: number } | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed: SavedLessonProgress = JSON.parse(stored);
    const timestamp = new Date(parsed.timestamp);
    const now = new Date();
    const daysDiff =
      (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < MAX_AGE_DAYS) {
      return { lessonId: parsed.lessonId, moduleId: parsed.moduleId };
    }
  } catch (error) {
    console.error("Failed to load lesson progress from localStorage:", error);
  }
  return null;
}

/**
 * Store user font size preference for lesson content.
 */
export function saveFontSizePreference(level: number): void {
  try {
    localStorage.setItem("lesson_font_size", level.toString());
  } catch {
    /* ignore */
  }
}

export function loadFontSizePreference(): number {
  try {
    const saved = localStorage.getItem("lesson_font_size");
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (parsed >= -1 && parsed <= 1) return parsed;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

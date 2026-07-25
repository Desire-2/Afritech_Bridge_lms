"use client";

import { useState, useCallback, useEffect } from "react";
import { StudentApiService } from "@/services/studentApi";
import { saveLastLesson, loadLastLesson } from "../utils/localStorage";
import type { CourseData, ModuleData } from "../types";

export interface NavigationState {
  currentLesson: any | null;
  currentModuleId: number | null;
  currentLessonIndex: number;
  totalLessons: number;
  hasNextLesson: boolean;
  hasPrevLesson: boolean;
  sidebarOpen: boolean;
}

export function useLessonNavigation(
  courseId: number,
  courseData: CourseData | null
) {
  const [currentLesson, setCurrentLesson] = useState<any | null>(null);
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Compute derived navigation state
  const { currentLessonIndex, totalLessons, hasNextLesson, hasPrevLesson } =
    deriveNavigationState(courseData, currentLesson, currentModuleId);

  // Auto-close sidebar on small screens
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Restore or initialize lesson position
  useEffect(() => {
    if (!courseData?.course?.modules) return;

    let lessonToSet: any = null;
    let moduleIdToSet: number | null = null;

    // 1. Find first uncompleted lesson from backend progress data
    if (courseData.modules && Array.isArray(courseData.modules)) {
      lessonToSet = findFirstUncompletedLesson(courseData);
      if (lessonToSet) {
        moduleIdToSet = lessonToSet.module_id;
      }
    }

    // 2. Fallback to API's current_lesson_id
    if (
      !lessonToSet &&
      (courseData as any).current_lesson_id &&
      courseData.course?.modules
    ) {
      for (const module of courseData.course.modules) {
        const lesson = module.lessons?.find(
          (l: any) => l.id === (courseData as any).current_lesson_id
        );
        if (lesson) {
          lessonToSet = lesson;
          moduleIdToSet = module.id;
          break;
        }
      }
    }

    // 3. Try localStorage
    if (!lessonToSet) {
      const savedProgress = loadLastLesson(courseId);
      if (savedProgress && courseData.course?.modules) {
        const moduleWithLesson = courseData.course.modules.find(
          (m: any) =>
            m.id === savedProgress.moduleId &&
            m.lessons?.some((l: any) => l.id === savedProgress.lessonId)
        );
        if (moduleWithLesson) {
          const lesson = moduleWithLesson.lessons.find(
            (l: any) => l.id === savedProgress.lessonId
          );
          if (lesson) {
            lessonToSet = lesson;
            moduleIdToSet = savedProgress.moduleId;
          }
        }
      }
    }

    // 4. Final fallback: first lesson
    if (
      !lessonToSet &&
      courseData.course?.modules?.[0]?.lessons?.[0]
    ) {
      lessonToSet = courseData.course.modules[0].lessons[0];
      moduleIdToSet = courseData.course.modules[0].id;
    }

    if (lessonToSet && moduleIdToSet) {
      setCurrentLesson(lessonToSet);
      setCurrentModuleId(moduleIdToSet);
    }
  }, [courseData, courseId]);

  const handleLessonSelect = useCallback(
    (lessonId: number, moduleId: number) => {
      if (!courseData?.course?.modules) return;

      const module = courseData.course.modules.find(
        (m: any) => m.id === moduleId
      );
      if (!module?.lessons) return;

      const lesson = module.lessons.find((l: any) => l.id === lessonId);
      if (!lesson) return;

      setCurrentLesson(lesson);
      setCurrentModuleId(moduleId);
      saveLastLesson(courseId, lessonId, moduleId);

      // Scroll to top of content
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [courseData, courseId]
  );

  const navigateLesson = useCallback(
    (direction: "prev" | "next") => {
      if (!courseData?.course?.modules || !currentLesson) return;

      const currentModule = courseData.course.modules.find(
        (m: any) => m.id === currentModuleId
      );
      if (!currentModule?.lessons) return;

      const idx = currentModule.lessons.findIndex(
        (l: any) => l.id === currentLesson.id
      );

      if (direction === "next") {
        const nextLesson = currentModule.lessons[idx + 1];
        if (nextLesson) {
          handleLessonSelect(nextLesson.id, currentModuleId!);
        } else {
          // Move to next module's first lesson
          const moduleIdx = courseData.course.modules.findIndex(
            (m: any) => m.id === currentModuleId
          );
          const nextModule = courseData.course.modules[moduleIdx + 1];
          if (nextModule?.lessons?.[0]) {
            handleLessonSelect(nextModule.lessons[0].id, nextModule.id);
          }
        }
      } else {
        const prevLesson = currentModule.lessons[idx - 1];
        if (prevLesson) {
          handleLessonSelect(prevLesson.id, currentModuleId!);
        } else {
          // Move to previous module's last lesson
          const moduleIdx = courseData.course.modules.findIndex(
            (m: any) => m.id === currentModuleId
          );
          const prevModule = courseData.course.modules[moduleIdx - 1];
          if (prevModule?.lessons) {
            const last = prevModule.lessons[prevModule.lessons.length - 1];
            if (last) handleLessonSelect(last.id, prevModule.id);
          }
        }
      }
    },
    [courseData, currentLesson, currentModuleId, handleLessonSelect]
  );

  return {
    currentLesson,
    setCurrentLesson,
    currentModuleId,
    setCurrentModuleId,
    currentLessonIndex,
    totalLessons,
    hasNextLesson,
    hasPrevLesson,
    sidebarOpen,
    setSidebarOpen,
    handleLessonSelect,
    navigateLesson,
  };
}

// ── Helper Functions ───────────────────────────────────────────────

function findFirstUncompletedLesson(
  courseData: CourseData
): { id: number; module_id: number } | null {
  if (!courseData.modules || !Array.isArray(courseData.modules)) return null;

  for (const moduleData of courseData.modules) {
    const lessonsCompleted = moduleData.lessons_completed || [];
    const moduleInfo = (moduleData as any).module;
    const uncompleted = lessonsCompleted.find(
      (lesson: any) => !lesson.completed
    );
    if (uncompleted && moduleInfo) {
      const fullModule = (courseData as any).course?.modules?.find(
        (m: any) => m.id === moduleInfo.id
      );
      if (fullModule) {
        const fullLesson = fullModule.lessons?.find(
          (l: any) => l.id === uncompleted.id
        );
        if (fullLesson) return { id: fullLesson.id, module_id: moduleInfo.id };
      }
    }
  }
  return null;
}

function deriveNavigationState(
  courseData: CourseData | null,
  currentLesson: any | null,
  currentModuleId: number | null
) {
  let currentLessonIndex = 0;
  let totalLessons = 0;
  let hasNextLesson = false;
  let hasPrevLesson = false;

  if (courseData?.course?.modules && currentLesson && currentModuleId) {
    const currentModule = courseData.course.modules.find(
      (m: any) => m.id === currentModuleId
    );
    if (currentModule?.lessons) {
      totalLessons = currentModule.lessons.length;
      currentLessonIndex = currentModule.lessons.findIndex(
        (l: any) => l.id === currentLesson.id
      );
      hasNextLesson = currentLessonIndex < totalLessons - 1;
      hasPrevLesson = currentLessonIndex > 0;

      // Check if there's a next module if at the end of current module
      if (!hasNextLesson) {
        const moduleIdx = courseData.course.modules.findIndex(
          (m: any) => m.id === currentModuleId
        );
        const nextModule = courseData.course.modules[moduleIdx + 1];
        if (nextModule?.lessons?.length) {
          hasNextLesson = true;
        }
      }
      if (!hasPrevLesson) {
        const moduleIdx = courseData.course.modules.findIndex(
          (m: any) => m.id === currentModuleId
        );
        const prevModule = courseData.course.modules[moduleIdx - 1];
        if (prevModule?.lessons?.length) {
          hasPrevLesson = true;
        }
      }
    }
  }

  return { currentLessonIndex, totalLessons, hasNextLesson, hasPrevLesson };
}

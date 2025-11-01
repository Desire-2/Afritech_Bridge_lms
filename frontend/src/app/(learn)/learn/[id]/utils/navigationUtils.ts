import { LessonData, ModuleData, ModuleStatus } from '../types';

export interface NavigationHelpers {
  getCurrentLessonIndex: (currentLesson: any, courseModules: any[]) => number;
  getAllLessons: (courseModules: any[]) => Array<LessonData & { moduleId: number }>;
  navigateToLesson: (
    direction: 'prev' | 'next',
    currentLesson: any,
    courseModules: any[],
    currentModuleId: number | null,
    getModuleStatus: (moduleId: number) => ModuleStatus,
    handleLessonSelect: (lessonId: number, moduleId: number) => void
  ) => void;
  hasNextLesson: (
    currentLessonIndex: number,
    allLessons: Array<LessonData & { moduleId: number }>,
    currentModuleId: number | null,
    getModuleStatus: (moduleId: number) => ModuleStatus
  ) => boolean;
  hasPrevLesson: (
    currentLessonIndex: number,
    allLessons: Array<LessonData & { moduleId: number }>,
    getModuleStatus: (moduleId: number) => ModuleStatus
  ) => boolean;
}

export const getCurrentLessonIndex = (currentLesson: any, courseModules: any[]): number => {
  if (!currentLesson || !courseModules) return -1;
  const allLessons = courseModules.flatMap((module: any) => module.lessons || []);
  return allLessons.findIndex((l: any) => l.id === currentLesson.id);
};

export const getAllLessons = (courseModules: any[]): Array<LessonData & { moduleId: number }> => {
  if (!courseModules) return [];
  return courseModules.flatMap((module: any) => 
    (module.lessons || []).map((lesson: any) => ({ ...lesson, moduleId: module.id }))
  );
};

export const navigateToLesson = (
  direction: 'prev' | 'next',
  currentLesson: any,
  courseModules: any[],
  currentModuleId: number | null,
  getModuleStatus: (moduleId: number) => ModuleStatus,
  handleLessonSelect: (lessonId: number, moduleId: number) => void
): void => {
  const allLessons = getAllLessons(courseModules);
  const currentIndex = getCurrentLessonIndex(currentLesson, courseModules);
  
  if (direction === 'prev' && currentIndex > 0) {
    const prevLesson = allLessons[currentIndex - 1];
    const prevLessonModule = courseModules?.find((m: any) => m.id === prevLesson.moduleId);
    
    if (prevLessonModule) {
      const prevModuleStatus = getModuleStatus(prevLessonModule.id);
      if (prevModuleStatus === 'completed' || prevModuleStatus === 'in_progress' || prevModuleStatus === 'unlocked') {
        handleLessonSelect(prevLesson.id, prevLesson.moduleId);
      }
    }
  } else if (direction === 'next' && currentIndex < allLessons.length - 1) {
    const nextLesson = allLessons[currentIndex + 1];
    const nextLessonModule = courseModules?.find((m: any) => m.id === nextLesson.moduleId);
    
    if (nextLessonModule && nextLessonModule.id !== currentModuleId) {
      const nextModuleStatus = getModuleStatus(nextLessonModule.id);
      if (nextModuleStatus === 'locked') {
        console.log('Cannot access next module - it is locked');
        return;
      }
    }
    
    handleLessonSelect(nextLesson.id, nextLesson.moduleId);
  }
};

export const hasNextLesson = (
  currentLessonIndex: number,
  allLessons: Array<LessonData & { moduleId: number }>,
  currentModuleId: number | null,
  getModuleStatus: (moduleId: number) => ModuleStatus
): boolean => {
  if (currentLessonIndex >= allLessons.length - 1) return false;
  
  const nextLesson = allLessons[currentLessonIndex + 1];
  if (!nextLesson) return false;
  
  if (nextLesson.moduleId !== currentModuleId) {
    const nextModuleStatus = getModuleStatus(nextLesson.moduleId);
    if (nextModuleStatus === 'locked') {
      return false;
    }
  }
  
  return true;
};

export const hasPrevLesson = (
  currentLessonIndex: number,
  allLessons: Array<LessonData & { moduleId: number }>,
  getModuleStatus: (moduleId: number) => ModuleStatus
): boolean => {
  if (currentLessonIndex <= 0) return false;
  
  const prevLesson = allLessons[currentLessonIndex - 1];
  if (!prevLesson) return false;
  
  const prevModuleStatus = getModuleStatus(prevLesson.moduleId);
  return prevModuleStatus === 'completed' || 
         prevModuleStatus === 'in_progress' || 
         prevModuleStatus === 'unlocked';
};

export const navigationHelpers: NavigationHelpers = {
  getCurrentLessonIndex,
  getAllLessons,
  navigateToLesson,
  hasNextLesson,
  hasPrevLesson
};

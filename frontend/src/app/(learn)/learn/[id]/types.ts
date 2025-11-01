// Type definitions for the Learning Interface

export interface CourseCompletion {
  totalLessons: number;
  completedLessons: number;
  totalQuizzes: number;
  completedQuizzes: number;
  totalAssignments: number;
  completedAssignments: number;
  overallScore: number;
  passingThreshold: number;
}

export interface InteractionEvent {
  type: string;
  lessonId?: number;
  moduleId?: number;
  timestamp: string;
  timeSpent?: number;
  engagementScore?: number;
  [key: string]: any;
}

export interface ProgressData {
  reading_progress: number;
  engagement_score: number;
  scroll_progress: number;
  time_spent: number;
  auto_saved?: boolean;
  completion_method?: 'automatic' | 'manual';
}

export interface LessonData {
  id: number;
  title: string;
  description?: string;
  content?: string;
  module_id?: number;
}

export interface ModuleData {
  id: number;
  title: string;
  description?: string;
  lessons?: LessonData[];
  order?: number;
}

export interface CourseData {
  id?: number;
  course?: {
    id: number;
    title: string;
    description?: string;
    modules?: ModuleData[];
  };
  current_lesson?: LessonData;
  title?: string;
  description?: string;
  modules?: ModuleData[];
  success?: boolean;
}

export type ViewMode = 'content' | 'assessment' | 'notes';

export type ModuleStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';

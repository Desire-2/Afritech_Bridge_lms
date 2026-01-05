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
  is_completed?: boolean;
}

export interface ModuleData {
  id: number;
  title: string;
  description?: string;
  lessons?: LessonData[];
  order?: number;
  is_released?: boolean;  // Whether the module is released (visible to students)
  released_at?: string;   // When the module was released (for manual releases)
}

export interface CourseData {
  id?: number;
  course?: {
    id: number;
    title: string;
    description?: string;
    modules?: ModuleData[];
    // Module release metadata (only present when for_student=True)
    total_module_count?: number;
    released_module_count?: number;
    // Module release settings
    start_date?: string;
    module_release_count?: number;
    module_release_interval?: string;
    module_release_interval_days?: number;
  };
  current_lesson?: LessonData;
  title?: string;
  description?: string;
  modules?: ModuleData[];
  success?: boolean;
}

export type ViewMode = 'content' | 'assessment' | 'notes' | 'quiz' | 'assignments';

export type ModuleStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';

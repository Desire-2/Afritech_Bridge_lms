"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CourseCreationService from '@/services/course-creation.service';
import {
  Course,
  EnhancedModule,
  EnhancedLesson,
  Assignment,
  Project,
  Quiz
} from '@/types/api';

// Import components (we'll create these)
import CourseOverview from '@/components/instructor/course-creation/CourseOverview';
import ModuleManagement from '@/components/instructor/course-creation/ModuleManagement';
import AssessmentManagement from '@/components/instructor/course-creation/AssessmentManagement';
import CourseSettings from '@/components/instructor/course-creation/CourseSettings';

type TabType = 'overview' | 'modules' | 'assessments' | 'settings';

const InstructorCourseDetailsPage = () => {
  const params = useParams();
  const { token } = useAuth();
  const courseId = parseInt(params?.courseId as string);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [assessments, setAssessments] = useState<{
    quizzes: Quiz[];
    assignments: Assignment[];
    projects: Project[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !courseId) return;
    
    fetchCourseData();
  }, [token, courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [courseData, assessmentData] = await Promise.all([
        CourseCreationService.getCourseDetails(courseId),
        CourseCreationService.getAssessmentsOverview(courseId)
      ]);
      
      setCourse(courseData);
      setAssessments(assessmentData);
    } catch (err: any) {
      console.error('Error fetching course data:', err);
      setError(err.message || 'Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseUpdate = (updatedCourse: Course) => {
    setCourse(updatedCourse);
  };

  const handleAssessmentUpdate = async () => {
    // Refresh assessments data and wait for it to complete
    try {
      console.log('[CourseDetailsPage] Starting assessment update refresh...');
      const updatedAssessments = await CourseCreationService.getAssessmentsOverview(courseId);
      console.log('[CourseDetailsPage] Assessments fetched from service:', updatedAssessments);
      console.log(`[CourseDetailsPage] Quiz count: ${updatedAssessments.quizzes?.length || 0}`);
      
      if (updatedAssessments.quizzes && updatedAssessments.quizzes.length > 0) {
        updatedAssessments.quizzes.forEach((quiz, idx) => {
          const qCount = quiz.questions?.length || 0;
          console.log(`[CourseDetailsPage] Quiz ${idx + 1}: ID=${quiz.id}, Title="${quiz.title}", Questions=${qCount}`);
          if (quiz.questions && quiz.questions.length > 0) {
            const firstQ = quiz.questions[0];
            console.log(`  └─ First question: "${firstQ.question_text || firstQ.text}"`);
          }
        });
      }
      
      console.log('[CourseDetailsPage] About to call setAssessments with:', updatedAssessments);
      setAssessments(updatedAssessments);
      console.log('[CourseDetailsPage] setAssessments completed');
    } catch (error) {
      console.error('[CourseDetailsPage] Failed to refresh assessments:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading course...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={fetchCourseData}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600 dark:text-slate-400">
          Course not found
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; shortLabel: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: '📊' },
    { id: 'modules', label: 'Modules & Lessons', shortLabel: 'Modules', icon: '📚' },
    { id: 'assessments', label: 'Assessments', shortLabel: 'Assess.', icon: '📝' },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Course Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white break-words">
                {course.title}
              </h1>
              {/* Status badge - inline on mobile, separate on sm+ */}
              <span className={`inline-flex shrink-0 px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-medium ${
                course.is_published 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              }`}>
                {course.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            {course.description && (
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5 sm:mt-2 line-clamp-2 sm:line-clamp-3">
                {course.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs - horizontally scrollable on small screens */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-4 sm:mb-6">
        <nav className="flex overflow-x-auto scrollbar-hide -mb-px gap-1 sm:gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 py-2.5 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-md'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="mr-1.5 sm:mr-2">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4 sm:mt-6">
        {activeTab === 'overview' && (
          <CourseOverview 
            course={course} 
            assessments={assessments}
            onCourseUpdate={handleCourseUpdate}
          />
        )}
        
        {activeTab === 'modules' && (
          <ModuleManagement 
            course={course}
            onCourseUpdate={handleCourseUpdate}
          />
        )}
        
        {activeTab === 'assessments' && assessments && (
          <AssessmentManagement 
            course={course}
            assessments={assessments}
            onAssessmentUpdate={handleAssessmentUpdate}
          />
        )}
        
        {activeTab === 'settings' && (
          <CourseSettings 
            course={course}
            onCourseUpdate={handleCourseUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default InstructorCourseDetailsPage;

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

  const handleAssessmentUpdate = () => {
    // Refresh assessments data
    CourseCreationService.getAssessmentsOverview(courseId)
      .then(setAssessments)
      .catch(console.error);
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

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'modules', label: 'Modules & Lessons', icon: '📚' },
    { id: 'assessments', label: 'Assessments', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {course.title}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {course.description}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              course.is_published 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}>
              {course.is_published ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Course Settings
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Course settings functionality will be implemented here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorCourseDetailsPage;

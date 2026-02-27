"use client";

import React, { useState } from 'react';
import { Course, Assignment, Project, Quiz } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';

interface CourseOverviewProps {
  course: Course;
  assessments: {
    quizzes: Quiz[];
    assignments: Assignment[];
    projects: Project[];
  } | null;
  onCourseUpdate: (course: Course) => void;
}

const CourseOverview: React.FC<CourseOverviewProps> = ({ 
  course, 
  assessments, 
  onCourseUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: course.title,
    description: course.description,
    learning_objectives: course.learning_objectives || '',
    target_audience: course.target_audience || '',
    estimated_duration: course.estimated_duration || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const updatedCourse = await CourseCreationService.updateCourse(course.id, editForm);
      onCourseUpdate(updatedCourse);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Failed to update course');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToggle = async () => {
    try {
      setLoading(true);
      const updatedCourse = await CourseCreationService.updateCourse(course.id, {
        is_published: !course.is_published
      });
      onCourseUpdate(updatedCourse);
    } catch (error) {
      console.error('Error toggling publish status:', error);
      alert('Failed to update publish status');
    } finally {
      setLoading(false);
    }
  };

  const totalModules = course.modules?.length || 0;
  const totalLessons = course.modules?.reduce((sum, module) => sum + (module.lessons?.length || 0), 0) || 0;
  const totalAssessments = (assessments?.quizzes?.length || 0) + 
                          (assessments?.assignments?.length || 0) + 
                          (assessments?.projects?.length || 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Course Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <span className="text-lg sm:text-2xl">📚</span>
            </div>
            <div className="ml-2.5 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 truncate">Modules</p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{totalModules}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <span className="text-lg sm:text-2xl">📄</span>
            </div>
            <div className="ml-2.5 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 truncate">Lessons</p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{totalLessons}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <span className="text-lg sm:text-2xl">📝</span>
            </div>
            <div className="ml-2.5 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 truncate">Assessments</p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{totalAssessments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <span className="text-lg sm:text-2xl">👥</span>
            </div>
            <div className="ml-2.5 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 truncate">Students</p>
              <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Course Information */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Course Information
          </h3>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handlePublishToggle}
              disabled={loading}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                course.is_published
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
              }`}
            >
              {loading && (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? 'Updating...' : (course.is_published ? 'Unpublish' : 'Publish')}
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              disabled={loading}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Course Title
              </label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Learning Objectives
              </label>
              <textarea
                value={editForm.learning_objectives}
                onChange={(e) => setEditForm({ ...editForm, learning_objectives: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="What will students learn from this course?"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={editForm.target_audience}
                  onChange={(e) => setEditForm({ ...editForm, target_audience: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., Beginners, Intermediate developers"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Estimated Duration
                </label>
                <input
                  type="text"
                  value={editForm.estimated_duration}
                  onChange={(e) => setEditForm({ ...editForm, estimated_duration: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., 4 weeks, 20 hours"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setIsEditing(false)}
                disabled={loading}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">Title</h4>
              <p className="text-slate-600 dark:text-slate-400">{course.title}</p>
            </div>
            
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">Description</h4>
              <p className="text-slate-600 dark:text-slate-400">{course.description}</p>
            </div>
            
            {course.learning_objectives && (
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Learning Objectives</h4>
                <p className="text-slate-600 dark:text-slate-400">{course.learning_objectives}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.target_audience && (
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Target Audience</h4>
                  <p className="text-slate-600 dark:text-slate-400">{course.target_audience}</p>
                </div>
              )}
              
              {course.estimated_duration && (
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Estimated Duration</h4>
                  <p className="text-slate-600 dark:text-slate-400">{course.estimated_duration}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <button className="p-3 sm:p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
            <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">📚</div>
            <h4 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">Add Module</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Create a new module with lessons</p>
          </button>
          
          <button className="p-3 sm:p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
            <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">📝</div>
            <h4 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">Create Assignment</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Add a new assignment</p>
          </button>
          
          <button className="p-3 sm:p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left sm:col-span-2 lg:col-span-1">
            <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">🎯</div>
            <h4 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white">Create Project</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Define a multi-part project</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseOverview;
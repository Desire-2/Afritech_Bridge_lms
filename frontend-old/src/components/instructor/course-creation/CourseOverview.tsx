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
    <div className="space-y-6">
      {/* Course Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <span className="text-2xl">📚</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Modules</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalModules}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <span className="text-2xl">📄</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Lessons</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalLessons}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <span className="text-2xl">📝</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Assessments</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalAssessments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Students</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Course Information */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Course Information
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePublishToggle}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                course.is_published
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
              }`}
            >
              {loading ? 'Updating...' : (course.is_published ? 'Unpublish' : 'Publish')}
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg font-medium transition-colors"
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
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
            <div className="text-2xl mb-2">📚</div>
            <h4 className="font-medium text-slate-900 dark:text-white">Add Module</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">Create a new module with lessons</p>
          </button>
          
          <button className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
            <div className="text-2xl mb-2">📝</div>
            <h4 className="font-medium text-slate-900 dark:text-white">Create Assignment</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">Add a new assignment</p>
          </button>
          
          <button className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-medium text-slate-900 dark:text-white">Create Project</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">Define a multi-part project</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseOverview;
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import CourseCreationService from '@/services/course-creation.service';
import { Course, Assignment } from '@/types/api';

const AssignmentsPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchCourses();
  }, [token]);

  useEffect(() => {
    if (selectedCourse) {
      fetchAssignments(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      // We need to get courses from the instructor service or create a method to get all instructor courses
      const response = await fetch('/api/v1/instructor/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const coursesData: Course[] = await response.json();
        setCourses(coursesData);
        if (coursesData.length > 0) {
          setSelectedCourse(coursesData[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (courseId: number) => {
    try {
      const assessmentData = await CourseCreationService.getAssessmentsOverview(courseId);
      setAssignments(assessmentData.assignments || []);
    } catch (err: any) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading assignments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Assignments</h1>
        <div className="flex space-x-4">
          {selectedCourse && (
            <Link
              href={`/instructor/courses/${selectedCourse.id}?tab=assessments`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create Assignment
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Course Selection */}
      {courses.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Select Course</h2>
          <div className="flex flex-wrap gap-2">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCourse?.id === course.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {course.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assignments List */}
      {selectedCourse ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Assignments for {selectedCourse.title}
            </h2>
          </div>
          
          {assignments.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No assignments found for this course.
              </p>
              <Link
                href={`/instructor/courses/${selectedCourse.id}?tab=assessments`}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create your first assignment →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        {assignment.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-3">
                        {assignment.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                        {assignment.due_date && (
                          <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                        )}
                        {assignment.points_possible && (
                          <span>Points: {assignment.points_possible}</span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          assignment.is_published
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {assignment.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Link
                        href={`/instructor/courses/${selectedCourse.id}?tab=assessments&assignment=${assignment.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/instructor/grading?assignment=${assignment.id}`}
                        className="text-green-600 hover:text-green-700 font-medium text-sm"
                      >
                        Grade
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            You don't have any courses yet. Create a course first to manage assignments.
          </p>
          <Link
            href="/instructor/courses/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create Your First Course
          </Link>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
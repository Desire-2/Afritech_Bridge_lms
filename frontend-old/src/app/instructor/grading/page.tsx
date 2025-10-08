"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import CourseCreationService from '@/services/course-creation.service';
import { Course, Assignment, Quiz, Project } from '@/types/api';

interface GradingItem {
  id: number;
  type: 'assignment' | 'quiz' | 'project';
  title: string;
  course_title: string;
  course_id: number;
  due_date?: string;
  submissions_count?: number;
  graded_count?: number;
}

const GradingPage = () => {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const assignmentId = searchParams?.get('assignment');
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradingItems, setGradingItems] = useState<GradingItem[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGradingData();
  }, [token]);

  const fetchGradingData = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      // Fetch instructor courses
      const response = await fetch('/api/v1/instructor/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const coursesData: Course[] = await response.json();
        setCourses(coursesData);
        
        // Fetch assessments for all courses
        const allGradingItems: GradingItem[] = [];
        
        for (const course of coursesData) {
          try {
            const assessments = await CourseCreationService.getAssessmentsOverview(course.id);
            
            // Add assignments to grading items
            assessments.assignments?.forEach((assignment: Assignment) => {
              if (assignment.is_published) {
                allGradingItems.push({
                  id: assignment.id,
                  type: 'assignment',
                  title: assignment.title,
                  course_title: course.title,
                  course_id: course.id,
                  due_date: assignment.due_date,
                  submissions_count: 0, // TODO: Get from submissions API
                  graded_count: 0, // TODO: Get from submissions API
                });
              }
            });
            
            // Add quizzes to grading items
            assessments.quizzes?.forEach((quiz: Quiz) => {
              if (quiz.is_published) {
                allGradingItems.push({
                  id: quiz.id,
                  type: 'quiz',
                  title: quiz.title,
                  course_title: course.title,
                  course_id: course.id,
                  submissions_count: 0, // TODO: Get from quiz attempts API
                  graded_count: 0, // TODO: Get from quiz attempts API
                });
              }
            });
            
            // Add projects to grading items
            assessments.projects?.forEach((project: Project) => {
              if (project.is_published) {
                allGradingItems.push({
                  id: project.id,
                  type: 'project',
                  title: project.title,
                  course_title: course.title,
                  course_id: course.id,
                  due_date: project.due_date,
                  submissions_count: 0, // TODO: Get from submissions API
                  graded_count: 0, // TODO: Get from submissions API
                });
              }
            });
          } catch (err) {
            console.error(`Failed to fetch assessments for course ${course.id}:`, err);
          }
        }
        
        setGradingItems(allGradingItems);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load grading data');
    } finally {
      setLoading(false);
    }
  };

  const filteredGradingItems = gradingItems.filter(item => {
    if (selectedCourse === 'all') return true;
    return item.course_id === parseInt(selectedCourse);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading grading items...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Grading Center</h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Course Filter */}
      {courses.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Filter by Course</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCourse('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCourse === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              All Courses
            </button>
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course.id.toString())}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCourse === course.id.toString()
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

      {/* Grading Items */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Items to Grade ({filteredGradingItems.length})
          </h2>
        </div>
        
        {filteredGradingItems.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No grading items found. {selectedCourse === 'all' ? 'Create some assessments first.' : 'This course has no published assessments.'}
            </p>
            <Link
              href="/instructor/courses"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Go to Courses →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredGradingItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.type === 'assignment' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                        item.type === 'quiz' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                      }`}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mb-3">
                      Course: {item.course_title}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                      {item.due_date && (
                        <span>Due: {new Date(item.due_date).toLocaleDateString()}</span>
                      )}
                      <span>Submissions: {item.submissions_count || 0}</span>
                      <span>Graded: {item.graded_count || 0}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Link
                      href={`/instructor/courses/${item.course_id}?tab=assessments&${item.type}=${item.id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      className="text-green-600 hover:text-green-700 font-medium text-sm"
                      onClick={() => {
                        // TODO: Implement grading interface
                        alert('Grading interface coming soon!');
                      }}
                    >
                      Grade Submissions
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingPage;


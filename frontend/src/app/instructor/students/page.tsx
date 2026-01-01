"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService from '@/services/instructor.service';
import { User, Course } from '@/types/api';

interface StudentWithCourse extends User {
  course_title?: string;
  enrollment_date?: string;
  progress?: number;
  last_accessed?: string;
  enrollment_id?: number;
  course_id?: number;
}

const StudentsPage = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentWithCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [unenrolling, setUnenrolling] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ show: boolean; student: StudentWithCourse | null }>({ show: false, student: null });

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      try {
        const [studentsData, coursesData] = await Promise.all([
          InstructorService.getMyStudents(),
          InstructorService.getMyCourses()
        ]);
        
        // Ensure data is always an array
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err: any) {
        console.error('Students fetch error:', err);
        setError(err.message || 'Failed to load students');
        setStudents([]); // Set empty arrays on error
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const filteredStudents = Array.isArray(students) ? students.filter(student => {
    const matchesSearch = searchTerm === '' || 
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === 'all' || student.course_title === selectedCourse;
    
    return matchesSearch && matchesCourse;
  }) : [];

  const handleUnenrollClick = (student: StudentWithCourse) => {
    setShowConfirmDialog({ show: true, student });
  };

  const handleUnenrollConfirm = async () => {
    const student = showConfirmDialog.student;
    if (!student || !student.enrollment_id) {
      setError('Cannot unenroll: Missing enrollment information');
      setShowConfirmDialog({ show: false, student: null });
      return;
    }

    setUnenrolling(student.enrollment_id);
    try {
      const result = await InstructorService.unenrollStudent(student.enrollment_id);
      
      // Remove student from local state
      setStudents(prevStudents => 
        prevStudents.filter(s => s.enrollment_id !== student.enrollment_id)
      );
      
      // Show success message (you can use a toast notification library here)
      console.log(result.message);
      
    } catch (err: any) {
      console.error('Unenroll error:', err);
      setError(err.message || 'Failed to unenroll student');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUnenrolling(null);
      setShowConfirmDialog({ show: false, student: null });
    }
  };

  const handleUnenrollCancel = () => {
    setShowConfirmDialog({ show: false, student: null });
  };

  // Prevent hydration mismatch
  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading students...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center my-10">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Students</h1>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total: {Array.isArray(filteredStudents) ? filteredStudents.length : 0} students
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search Students
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="course" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filter by Course
            </label>
            <select
              id="course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            >
              <option value="all">All Courses</option>
              {Array.isArray(courses) && courses.map(course => (
                <option key={course.id} value={course.title}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!Array.isArray(filteredStudents) || filteredStudents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {!Array.isArray(students) || students.length === 0 ? 'No students enrolled in your courses yet.' : 'No students match your search criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Enrolled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Last Accessed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {Array.isArray(filteredStudents) && filteredStudents.map((student) => (
                  <tr key={`${student.id}-${student.enrollment_id || student.course_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              {student.first_name?.[0] || student.username[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {student.first_name && student.last_name 
                              ? `${student.first_name} ${student.last_name}`
                              : student.username
                            }
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-white">
                        {student.course_title || 'Unknown Course'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {student.enrollment_date 
                          ? new Date(student.enrollment_date).toLocaleDateString()
                          : 'Unknown'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${student.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {student.progress || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {student.last_accessed 
                          ? new Date(student.last_accessed).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3">
                        View Details
                      </button>
                      <button className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-3">
                        Message
                      </button>
                      <button 
                        onClick={() => handleUnenrollClick(student)}
                        disabled={unenrolling === student.enrollment_id}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {unenrolling === student.enrollment_id ? 'Unenrolling...' : 'Unenroll'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog.show && showConfirmDialog.student && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Confirm Unenrollment
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to unenroll <strong>{showConfirmDialog.student.first_name} {showConfirmDialog.student.last_name}</strong> from <strong>{showConfirmDialog.student.course_title}</strong>?
              <br /><br />
              <span className="text-red-600 dark:text-red-400">This action cannot be undone and will remove all their progress in this course.</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleUnenrollCancel}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUnenrollConfirm}
                disabled={unenrolling !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unenrolling !== null ? 'Unenrolling...' : 'Yes, Unenroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
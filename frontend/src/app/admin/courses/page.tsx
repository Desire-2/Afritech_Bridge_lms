"use client";

import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder for Course type - define based on your actual Course model
interface Course {
  id: string;
  title: string;
  instructorName: string; // Or instructorId and fetch name
  category: string;
  status: 'Draft' | 'Published';
  createdAt: string;
  studentCount: number;
}

// Placeholder data - replace with API calls
const placeholderCourses: Course[] = [
  {
    id: 'crs001',
    title: 'Introduction to Python Programming',
    instructorName: 'Dr. Ada Lovelace',
    category: 'Programming',
    status: 'Published',
    createdAt: '2023-01-10T09:00:00Z',
    studentCount: 150,
  },
  {
    id: 'crs002',
    title: 'Web Development Fundamentals',
    instructorName: 'Prof. Tim Berners-Lee',
    category: 'Web Development',
    status: 'Published',
    createdAt: '2023-02-01T11:30:00Z',
    studentCount: 220,
  },
  {
    id: 'crs003',
    title: 'Advanced Data Structures in Java',
    instructorName: 'Dr. Grace Hopper',
    category: 'Programming',
    status: 'Draft',
    createdAt: '2023-03-15T16:00:00Z',
    studentCount: 0,
  },
];

const CourseManagementPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/admin/courses
        // const response = await fetch('/api/admin/courses', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch courses');
        // const data = await response.json();
        // setCourses(data.courses);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setCourses(placeholderCourses);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching courses.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [authContext?.token]);

  const handleAddCourse = () => {
    console.log('Add new course clicked');
    // Navigate to add course page or open modal
  };

  const handleEditCourse = (courseId: string) => {
    console.log(`Edit course ${courseId} clicked`);
    // Navigate to edit course page or open modal
  };

  const handleDeleteCourse = (courseId: string) => {
    console.log(`Delete course ${courseId} clicked`);
    // Show confirmation and call API
  };

  if (loading) return <div className="text-center py-10">Loading courses...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Course Management</h1>
        <button
          onClick={handleAddCourse}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"
        >
          Add New Course
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No courses found.</td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.instructorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{course.studentCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${course.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(course.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleEditCourse(course.id)} className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                    <button onClick={() => handleDeleteCourse(course.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* TODO: Add pagination */}
      {/* TODO: Add modals/forms for Add/Edit Course */}
    </div>
  );
};

export default CourseManagementPage;


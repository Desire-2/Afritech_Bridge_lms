"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // To get courseId
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder types
interface CourseDetailsInstructorView {
  id: string;
  title: string;
  description: string;
  instructorName: string;
  category: string;
  status: 'Published' | 'Draft';
  modules: Array<{ id: string; title: string; lessonCount: number }>;
  enrolledStudents: Array<{ id: string; name: string; progress: number }>;
  announcements: Array<{ id: string; title: string; createdAt: string }>;
}

// Placeholder data - replace with API call to /api/instructor/courses/<course_id>/details
const placeholderCourseDetails: CourseDetailsInstructorView = {
  id: 'crs001',
  title: 'Introduction to Python Programming',
  description: 'A comprehensive introduction to Python for beginners, covering fundamental concepts, data structures, and an introduction to object-oriented programming.',
  instructorName: 'Dr. Ada Lovelace',
  category: 'Programming',
  status: 'Published',
  modules: [
    { id: 'mod01', title: 'Module 1: Getting Started', lessonCount: 5 },
    { id: 'mod02', title: 'Module 2: Data Types and Variables', lessonCount: 7 },
    { id: 'mod03', title: 'Module 3: Control Flow', lessonCount: 6 },
  ],
  enrolledStudents: [
    { id: 'std001', name: 'Alice Wonderland', progress: 75 },
    { id: 'std002', name: 'Bob The Builder', progress: 50 },
    { id: 'std003', name: 'Charlie Brown', progress: 90 },
  ],
  announcements: [
    { id: 'ann001', title: 'Welcome to the Course!', createdAt: '2023-01-10T10:00:00Z' },
    { id: 'ann002', title: 'Module 1 Quiz Next Week', createdAt: '2023-01-15T14:00:00Z' },
  ],
};

const InstructorCourseDetailsPage = () => {
  const params = useParams();
  const courseId = params.courseId as string;
  const [courseDetails, setCourseDetails] = useState<CourseDetailsInstructorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    if (!courseId || !authContext?.token) return;

    const fetchCourseDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/instructor/courses/${courseId}/details
        // const response = await fetch(`/api/instructor/courses/${courseId}/details`, {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch course details');
        // const data = await response.json();
        // setCourseDetails(data.course);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        // Simulate finding the course or returning a generic one if ID doesn't match placeholder
        if (courseId === placeholderCourseDetails.id) {
            setCourseDetails(placeholderCourseDetails);
        } else {
            // In a real app, the API would handle 404s
            setCourseDetails({...placeholderCourseDetails, id: courseId, title: `Course ${courseId} Details (Generic)` });
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching course details.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseDetails();
  }, [courseId, authContext?.token]);

  if (loading) return <div className="text-center py-10">Loading course details...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  if (!courseDetails) return <div className="text-center py-10">Course not found.</div>;

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Link href="/instructor/courses" legacyBehavior>
          <a className="text-blue-500 hover:text-blue-700">&larr; Back to My Courses</a>
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{courseDetails.title}</h1>
      <p className="text-sm text-gray-500 mb-1">Category: {courseDetails.category} | Status: 
        <span className={`ml-1 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${courseDetails.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {courseDetails.status}
        </span>
      </p>
      <p className="text-gray-600 mb-8">{courseDetails.description}</p>

      {/* Tabs for different sections */}
      {/* For simplicity, sections are shown directly. Could be tabbed UI. */}

      {/* Course Content Management Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Course Content (Modules & Lessons)</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {courseDetails.modules.map(module => (
            <div key={module.id} className="mb-3 pb-3 border-b last:border-b-0">
              <h3 className="text-lg font-medium text-gray-800">{module.title} ({module.lessonCount} lessons)</h3>
              {/* TODO: Link to edit module/lessons or display lessons */}
            </div>
          ))}
          <button className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150">
            Edit Course Content
          </button>
        </div>
      </section>

      {/* Student Roster Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Enrolled Students ({courseDetails.enrolledStudents.length})</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {courseDetails.enrolledStudents.map(student => (
              <li key={student.id} className="py-3 flex justify-between items-center">
                <span>{student.name}</span>
                <span className="text-sm text-gray-600">Progress: {student.progress}%</span>
                <Link href={`/instructor/courses/${courseId}/students/${student.id}/progress`} legacyBehavior>
                  <a className="text-blue-500 hover:underline text-sm">View Progress</a>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Announcements Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Announcements</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {courseDetails.announcements.map(ann => (
            <div key={ann.id} className="mb-3 pb-3 border-b last:border-b-0">
              <h3 className="text-lg font-medium text-gray-800">{ann.title}</h3>
              <p className="text-xs text-gray-500">Posted: {new Date(ann.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          <Link href={`/instructor/courses/${courseId}/announcements/new`} legacyBehavior>
            <a className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150">
              Create New Announcement
            </a>
          </Link>
        </div>
      </section>

      {/* TODO: Add sections for settings, grading overview for this course etc. */}
    </div>
  );
};

export default InstructorCourseDetailsPage;


"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // To get courseId
import { AuthContext } from '@/contexts/AuthContext';
import { CourseService } from '@/services/course.service';
import { Course, Announcement } from '@/types/api';

interface CourseDetailsInstructorView {
  id: number;
  title: string;
  description: string;
  instructorName: string;
  category?: string; // May not be in backend
  status: 'Published' | 'Draft';
  modules: Array<{ id: number; title: string; lessonCount?: number; lessons?: any[] }>;
  enrolled_students: Array<{ id: number; name: string; progress: number; username: string; enrollment_date: string; completed_at?: string }>;
  announcements: Array<{ id: number; title: string; content: string; created_at: string; instructor_name: string }>;
  enrollment_count: number;
  // Other fields from backend
}

// Placeholder data - replace with API call to /api/v1/courses/<course_id>/instructor-details
const placeholderCourseDetails: CourseDetailsInstructorView = {
  id: 1,
  title: 'Introduction to Python Programming',
  description: 'A comprehensive introduction to Python for beginners, covering fundamental concepts, data structures, and an introduction to object-oriented programming.',
  instructorName: 'Dr. Ada Lovelace',
  category: 'Programming',
  status: 'Published',
  modules: [
    { id: 1, title: 'Module 1: Getting Started', lessonCount: 5 },
    { id: 2, title: 'Module 2: Data Types and Variables', lessonCount: 7 },
    { id: 3, title: 'Module 3: Control Flow', lessonCount: 6 },
  ],
  enrolled_students: [
    { id: 1, name: 'Alice Wonderland', progress: 75, username: 'alice', enrollment_date: '2023-01-10T10:00:00Z' },
    { id: 2, name: 'Bob The Builder', progress: 50, username: 'bob', enrollment_date: '2023-01-11T10:00:00Z' },
    { id: 3, name: 'Charlie Brown', progress: 90, username: 'charlie', enrollment_date: '2023-01-12T10:00:00Z' },
  ],
  announcements: [
    { id: 1, title: 'Welcome to the Course!', content: 'Welcome everyone!', created_at: '2023-01-10T10:00:00Z', instructor_name: 'Dr. Ada Lovelace' },
    { id: 2, title: 'Module 1 Quiz Next Week', content: 'Quiz on Friday', created_at: '2023-01-15T14:00:00Z', instructor_name: 'Dr. Ada Lovelace' },
  ],
  enrollment_count: 3
};

const InstructorCourseDetailsPage = () => {
  const params = useParams();
  const courseId = params.courseId as string;
  const [courseDetails, setCourseDetails] = useState<CourseDetailsInstructorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  useEffect(() => {
    if (!courseId || !authContext?.token) return;

    const fetchCourseDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await CourseService.getCourseForInstructor(Number(courseId));
        setCourseDetails({
          id: data.id,
          title: data.title,
          description: data.description,
          instructorName: data.instructor_name || 'Unknown',
          category: data.target_audience || 'General',
          status: data.is_published ? 'Published' : 'Draft',
          modules: data.modules?.map((mod: any) => ({
            id: mod.id,
            title: mod.title,
            lessonCount: mod.lessons ? mod.lessons.length : 0
          })),
          enrolled_students: data.enrolled_students,
          announcements: data.announcements,
          enrollment_count: data.enrollment_count
        });
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching course details.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseDetails();
  }, [courseId, authContext?.token]);

  const createAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    try {
      const newAnnouncement = await CourseService.createAnnouncement({
        course_id: Number(courseId),
        title: announcementTitle,
        content: announcementContent,
      });
      // Update the course details with the new announcement
      if (courseDetails) {
        setCourseDetails({
          ...courseDetails,
          announcements: [newAnnouncement, ...courseDetails.announcements]
        });
      }
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setShowAnnouncementForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create announcement');
    }
  };

  const togglePublishStatus = async () => {
    if (!courseDetails) return;

    try {
      const endpoint = courseDetails.status === 'Published' ? 'unpublish' : 'publish';
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/v1/courses/${courseId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authContext?.token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to update course status');
      const data = await response.json() as any;
      setCourseDetails({
        ...courseDetails,
        status: data.course.is_published ? 'Published' : 'Draft'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update course status');
    }
  };

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
        <button
          onClick={togglePublishStatus}
          className={`ml-4 px-3 py-1 text-xs font-semibold rounded ${courseDetails.status === 'Published' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
        >
          {courseDetails.status === 'Published' ? 'Unpublish' : 'Publish'}
        </button>
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
          <Link href={`/instructor/courses/${courseId}/edit`} legacyBehavior>
            <a className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150">
              Edit Course Content
            </a>
          </Link>
        </div>
      </section>

      {/* Student Roster Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Enrolled Students ({courseDetails.enrollment_count})</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {courseDetails.enrolled_students.map((student: any) => (
              <li key={student.id} className="py-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{student.name}</span>
                  <span className="text-sm text-gray-600">@{student.username}</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress: {student.progress}%</span>
                    <span>Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${student.progress}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  {student.completed_at && (
                    <span className="text-sm text-green-600">Completed on {new Date(student.completed_at).toLocaleDateString()}</span>
                  )}
                  <Link href={`/instructor/courses/${courseId}/students/${student.id}/progress`} legacyBehavior>
                    <a className="text-blue-500 hover:underline text-sm">View Detailed Progress</a>
                  </Link>
                </div>
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
              <p className="text-gray-600 mb-2">{ann.content}</p>
              <p className="text-xs text-gray-500">Posted: {new Date(ann.created_at).toLocaleDateString()} by {ann.instructor_name}</p>
            </div>
          ))}
          {showAnnouncementForm ? (
            <div className="mt-4 p-4 border rounded">
              <input
                type="text"
                placeholder="Announcement Title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                className="w-full p-2 border rounded mb-2"
              />
              <textarea
                placeholder="Announcement Content"
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                className="w-full p-2 border rounded mb-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={createAnnouncement}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
                >
                  Post Announcement
                </button>
                <button
                  onClick={() => setShowAnnouncementForm(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAnnouncementForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"
              >
                Create New Announcement
              </button>
              <Link href={`/instructor/courses/${courseId}/announcements`} legacyBehavior>
                <a className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150">
                  Manage Announcements
                </a>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* TODO: Add sections for settings, grading overview for this course etc. */}
    </div>
  );
};

export default InstructorCourseDetailsPage;


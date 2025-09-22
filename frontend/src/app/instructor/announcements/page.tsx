"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder type
interface Announcement {
  id: string;
  title: string;
  contentSnippet: string;
  courseTitle: string; // Or courseId
  courseId: string;
  createdAt: string;
  updatedAt: string;
}

// Placeholder data - replace with API call to /api/instructor/announcements or /api/instructor/courses/<course_id>/announcements
const placeholderAnnouncements: Announcement[] = [
  {
    id: 'ann001',
    title: 'Midterm Exam Schedule Updated',
    contentSnippet: 'Please note that the midterm exam for Introduction to Python...',
    courseTitle: 'Introduction to Python Programming',
    courseId: 'crs001',
    createdAt: '2024-05-12T10:00:00Z',
    updatedAt: '2024-05-12T10:05:00Z',
  },
  {
    id: 'ann002',
    title: 'Project Submission Deadline Extended',
    contentSnippet: 'The deadline for the final project in Web Development Fundamentals has been extended...',
    courseTitle: 'Web Development Fundamentals',
    courseId: 'crs002',
    createdAt: '2024-05-10T15:30:00Z',
    updatedAt: '2024-05-10T15:30:00Z',
  },
  {
    id: 'ann003',
    title: 'Guest Lecture Next Week',
    contentSnippet: 'We will have a guest lecture on Advanced CSS techniques...',
    courseTitle: 'Web Development Fundamentals',
    courseId: 'crs002',
    createdAt: '2024-05-14T09:00:00Z',
    updatedAt: '2024-05-14T09:00:00Z',
  },
];

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/instructor/announcements
        // This might fetch all announcements for courses taught by the instructor.
        // Or, it might be better to select a course first, then view its announcements.
        // For this general page, let's assume it fetches all announcements by the instructor.
        // const response = await fetch('/api/instructor/announcements', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch announcements');
        // const data = await response.json();
        // setAnnouncements(data.announcements);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setAnnouncements(placeholderAnnouncements);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching announcements.');
      } finally {
        setLoading(false);
      }
    };

    if (authContext?.token) {
      fetchAnnouncements();
    }
  }, [authContext?.token]);

  const handleCreateAnnouncement = () => {
    console.log('Create new announcement clicked');
    // Navigate to a form page, e.g., /instructor/announcements/new
    // Or open a modal to select course and then create announcement
    alert('Placeholder: Navigate to create announcement form.');
  };

  const handleEditAnnouncement = (announcementId: string) => {
    console.log(`Edit announcement ${announcementId}`);
    // Navigate to edit page or open modal
    alert(`Placeholder: Edit announcement ID: ${announcementId}`);
  };

  const handleDeleteAnnouncement = (announcementId: string) => {
    console.log(`Delete announcement ${announcementId}`);
    // Show confirmation and call API
    alert(`Placeholder: Delete announcement ID: ${announcementId}`);
  };

  if (loading) return <div className="text-center py-10">Loading announcements...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Manage Announcements</h1>
        <button
          onClick={handleCreateAnnouncement}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"
        >
          Create New Announcement
        </button>
      </div>

      {announcements.length === 0 && !loading && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">You have not posted any announcements yet.</p>
        </div>
      )}

      {announcements.length > 0 && (
        <div className="space-y-6">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">{ann.title}</h2>
                  <p className="text-sm text-gray-500 mb-1">For Course: 
                    <Link href={`/instructor/courses/${ann.courseId}`} legacyBehavior>
                      <a className="text-blue-600 hover:underline ml-1">{ann.courseTitle}</a>
                    </Link>
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Posted: {new Date(ann.createdAt).toLocaleString()} 
                    {ann.createdAt !== ann.updatedAt && `(Edited: ${new Date(ann.updatedAt).toLocaleString()})`}
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">{ann.contentSnippet}</p>
                </div>
                <div className="flex-shrink-0 ml-4 mt-1">
                  <button 
                    onClick={() => handleEditAnnouncement(ann.id)} 
                    className="text-sm text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteAnnouncement(ann.id)} 
                    className="text-sm text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* TODO: Add pagination if list is long */}
      {/* TODO: Implement modal/form for creating/editing announcements */}
      {/* Consider a filter by course if many announcements are listed */}
    </div>
  );
};

export default AnnouncementsPage;


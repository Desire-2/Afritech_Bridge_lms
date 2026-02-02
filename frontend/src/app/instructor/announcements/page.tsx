"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { AnnouncementService, CourseService } from '@/services/course.service';
import { Announcement } from '@/types/api';
import AnnouncementModal from '@/components/instructor/AnnouncementModal';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Calendar, BookOpen } from 'lucide-react';

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    fetchAnnouncements();
  }, [authContext?.token]);

  const fetchAnnouncements = async () => {
    if (!authContext?.token) return;

    setLoading(true);
    setError(null);
    try {
      const data = await AnnouncementService.getInstructorAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError(err.message || 'An error occurred while fetching announcements.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = () => {
    setEditAnnouncement(null);
    setShowCreateModal(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditAnnouncement(announcement);
    setShowCreateModal(true);
  };

  const handleDeleteAnnouncement = async (announcementId: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await AnnouncementService.deleteAnnouncement(announcementId);
      // Remove from local state
      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
    } catch (err: any) {
      console.error('Error deleting announcement:', err);
      alert(`Failed to delete announcement: ${err.message}`);
    }
  };

  const handleModalSuccess = (announcement: Announcement) => {
    if (editingAnnouncement) {
      // Update existing announcement
      setAnnouncements(prev => 
        prev.map(ann => ann.id === announcement.id ? announcement : ann)
      );
    } else {
      // Add new announcement
      setAnnouncements(prev => [announcement, ...prev]);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAnnouncement(null);
  };

  const handleAnnouncementSuccess = (announcement: Announcement) => {
    if (editAnnouncement) {
      // Update existing announcement
      setAnnouncements(prev =>
        prev.map(ann => ann.id === announcement.id ? announcement : ann)
      );
    } else {
      // Add new announcement to the beginning
      setAnnouncements(prev => [announcement, ...prev]);
    }
    setShowCreateModal(false);
    setEditAnnouncement(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading announcements...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <Button 
            onClick={fetchAnnouncements}
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Manage Announcements
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create and manage announcements for your courses
          </p>
        </div>
        <Button
          onClick={handleCreateAnnouncement}
          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </div>

      {/* Empty State */}
      {announcements.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Announcements Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            You haven't posted any announcements yet. Create your first announcement to communicate with your students.
          </p>
          <Button
            onClick={handleCreateAnnouncement}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Create Your First Announcement
          </Button>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length > 0 && (
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                        {announcement.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <Link
                          href={`/instructor/courses/${announcement.course_id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          {announcement.course_title || announcement.course?.title || `Course ${announcement.course_id}`}
                        </Link>
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Posted: {formatDate(announcement.created_at)}</span>
                      </div>

                      {announcement.created_at !== announcement.updated_at && (
                        <div className="flex items-center gap-1">
                          <Edit2 className="h-4 w-4" />
                          <span>Edited: {formatDate(announcement.updated_at)}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {announcement.content.length > 300 ? (
                        <>
                          {announcement.content.substring(0, 300)}...
                          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 ml-1 hover:underline">
                            Read more
                          </button>
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap">{announcement.content}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      onClick={() => handleEditAnnouncement(announcement)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Announcement Modal */}
      <AnnouncementModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditAnnouncement(null);
        }}
        onSuccess={handleAnnouncementSuccess}
        editAnnouncement={editAnnouncement}
      />
    </div>
  );
};

export default AnnouncementsPage;


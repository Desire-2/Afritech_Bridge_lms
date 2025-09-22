"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Users, Clock, BookOpen, ChevronRight } from 'lucide-react';

interface ForumItem {
  id: string;
  title: string;
  description: string;
  threadCount: number;
  postCount: number;
  lastPostInfo?: {
    threadTitle: string;
    threadId: string;
    userName: string;
    userId: string;
    timestamp: string;
  };
}

interface ForumCategory {
  id: string;
  title: string;
  forums: ForumItem[];
}

const placeholderForumData: ForumCategory[] = [
  {
    id: 'cat_general',
    title: 'General Discussions',
    forums: [
      {
        id: 'forum_announcements',
        title: 'Platform Announcements',
        description: 'Stay updated with the latest news and announcements about Afritec Bridge.',
        threadCount: 5,
        postCount: 25,
        lastPostInfo: {
          threadTitle: 'New Feature: Dark Mode!',
          threadId: 'thread_darkmode',
          userName: 'Admin Team',
          userId: 'admin001',
          timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      },
      {
        id: 'forum_introductions',
        title: 'Introductions',
        description: 'New to the community? Introduce yourself here!',
        threadCount: 150,
        postCount: 780,
        lastPostInfo: {
          threadTitle: 'Hello from Nairobi!',
          threadId: 'thread_nairobi_intro',
          userName: 'AishaK',
          userId: 'user123',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      },
      {
        id: 'forum_feedback',
        title: 'Platform Feedback & Suggestions',
        description: 'Have ideas to improve Afritec Bridge? Share them here.',
        threadCount: 30,
        postCount: 120,
        lastPostInfo: {
          threadTitle: 'Suggestion: Mobile App',
          threadId: 'thread_mobile_app_suggestion',
          userName: 'TechSavvy',
          userId: 'user456',
          timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
      },
    ],
  },
  {
    id: 'cat_courses',
    title: 'Course-Specific Forums',
    forums: [
      {
        id: 'forum_python_beginners',
        title: 'Introduction to Python - Q&A',
        description: 'Ask questions and discuss topics related to the Python beginners course.',
        threadCount: 75,
        postCount: 450,
        lastPostInfo: {
          threadTitle: 'Help with list comprehensions',
          threadId: 'thread_python_listcomp',
          userName: 'CodeLearner22',
          userId: 'user789',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      },
      {
        id: 'forum_webdev_projects',
        title: 'Web Development - Project Ideas & Showcase',
        description: 'Share your web development project ideas or showcase your completed work.',
        threadCount: 40,
        postCount: 200,
        lastPostInfo: {
          threadTitle: 'My Portfolio Site Feedback',
          threadId: 'thread_webdev_portfolio',
          userName: 'DevGirl',
          userId: 'user101',
          timestamp: new Date(Date.now() - 86400000 * 0.5).toISOString(),
        },
      },
      {
        id: 'forum_datasci_resources',
        title: 'Data Science - Resources & Tools',
        description: 'Share useful resources, libraries, and tools for data science.',
        threadCount: 25,
        postCount: 90,
        lastPostInfo: {
          threadTitle: 'Great new library for visualization',
          threadId: 'thread_datasci_vizlib',
          userName: 'DataGuru',
          userId: 'user112',
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      },
    ],
  },
];

const ForumsHomePage = () => {
  const [forumCategories, setForumCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchForums = async () => {
      setLoading(true);
      setError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 700));
        setForumCategories(placeholderForumData);
      } catch (err: any) {
        setError(err.message || 'Failed to load forums.');
      } finally {
        setLoading(false);
      }
    };

    fetchForums();
  }, [token]);

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    const units: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const unit in units) {
      const interval = Math.floor(diffInSeconds / units[unit]);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'just now';
  };

  if (loading) return <div className="text-center py-20">Loading forums...</div>;
  if (error) return <div className="text-center py-20 text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-indigo-600" />
              Community Forums
            </h1>
            <p className="mt-2 text-gray-600">Connect, learn, and collaborate with fellow learners</p>
          </div>
          <div className="w-full md:w-64">
            <input
              type="text"
              placeholder="Search forums..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : forumCategories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No forums available yet</p>
          </div>
        ) : (
          forumCategories.map(category => (
            <section key={category.id} className="mb-8 bg-white rounded-xl shadow-sm">
              {/* Category Header */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  {category.title}
                </h2>
              </div>

              {/* Forums List */}
              <div className="divide-y divide-gray-100">
                {category.forums.map(forum => (
                  <div 
                    key={forum.id}
                    className="p-6 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <Link
                          href={`/forums/${forum.id}`}
                          className="text-lg font-semibold text-gray-800 hover:text-indigo-600 transition-colors flex items-center gap-2"
                        >
                          {forum.title}
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <p className="mt-1 text-gray-600 text-sm">{forum.description}</p>
                        
                        {/* Stats */}
                        <div className="flex gap-4 mt-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {forum.threadCount} threads
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {forum.postCount} posts
                          </span>
                        </div>
                      </div>

                      {/* Last Post */}
                      {forum.lastPostInfo && (
                        <div className="w-full md:w-64 text-sm">
                          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-indigo-600 text-sm font-medium">
                                  {forum.lastPostInfo.userName[0]}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/forums/${forum.id}/threads/${forum.lastPostInfo.threadId}#lastpost`}
                                className="font-medium text-gray-800 hover:text-indigo-600 truncate"
                              >
                                {forum.lastPostInfo.threadTitle}
                              </Link>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>by {forum.lastPostInfo.userName}</span>
                                <Clock className="w-3 h-3" />
                                <span>{formatRelativeTime(forum.lastPostInfo.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default ForumsHomePage;
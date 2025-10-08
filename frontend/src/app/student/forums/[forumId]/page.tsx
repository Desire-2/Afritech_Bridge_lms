"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';


interface ThreadItem {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
  replyCount: number;
  viewCount: number;
  createdTimestamp: string;
  lastPostTimestamp: string;
  lastPostUserName?: string;
  lastPostUserId?: string;
  isPinned: boolean;
  isLocked: boolean;
}

interface ForumDetails {
  id: string;
  title: string;
  description: string;
  threads: ThreadItem[];
  parentCategoryName?: string;
  parentCategoryId?: string;
}

// SVG Icons
const PinIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Placeholder Data
const placeholderForumDetails: ForumDetails = {
  id: 'forum_python_beginners',
  title: 'Introduction to Python - Q&A',
  description: 'Ask questions and discuss topics related to the Python beginners course.',
  parentCategoryName: 'Course-Specific Forums',
  parentCategoryId: 'cat_courses',
  threads: [
    {
      id: 'thread_python_listcomp',
      title: 'Help with list comprehensions in Python',
      authorName: 'CodeLearner22',
      authorId: 'user789',
      replyCount: 15,
      viewCount: 120,
      createdTimestamp: new Date(Date.now() - 3600000 * 2).toISOString(),  // 2 hours ago
      lastPostTimestamp: new Date(Date.now() - 3600000 * 1).toISOString(), // 1 hour ago
      lastPostUserName: 'PythonGuru',
      lastPostUserId: 'user एक्सपर्ट',
      isPinned: true,
      isLocked: false,
    },
    {
      id: 'thread_python_loops',
      title: 'Understanding for vs while loops - when to use which?',
      authorName: 'NewbieCoder',
      authorId: 'user007',
      replyCount: 8,
      viewCount: 95,
      createdTimestamp: new Date(Date.now() - 3600000 * 4).toISOString(),  // 4 hours ago
      lastPostTimestamp: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
      lastPostUserName: 'InstructorJane',
      lastPostUserId: 'instr001',
      isPinned: false,
      isLocked: false,
    },
    {
      id: 'thread_python_setup',
      title: 'Problem setting up Python environment on Windows',
      authorName: 'WinUserDev',
      authorId: 'user654',
      replyCount: 22,
      viewCount: 250,
      createdTimestamp: new Date(Date.now() - 86400000 * 1.1).toISOString(), // ~26.4 hours ago
      lastPostTimestamp: new Date(Date.now() - 86400000 * 1).toISOString(),  // 24 hours ago
      lastPostUserName: 'HelperBot',
      lastPostUserId: 'bot001',
      isPinned: false,
      isLocked: true,
    },
  ],
};

const ForumTopicPage = () => {
  const params = useParams();
  const forumId = params.forumId as string;
  const { token } = useAuth();

  const [forumDetails, setForumDetails] = useState<ForumDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId) return;

    const fetchForumThreads = async () => {
      try {
        setLoading(true);
        setError(null);
        await new Promise(resolve => setTimeout(resolve, 600));
        setForumDetails({ ...placeholderForumDetails, id: forumId });
      } catch (err: any) {
        setError(err.message || 'Failed to load forum threads.');
      } finally {
        setLoading(false);
      }
    };

    fetchForumThreads();
  }, [forumId, token]);

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    const units = [
      { name: 'year', seconds: 31536000 },
      { name: 'month', seconds: 2592000 },
      { name: 'week', seconds: 604800 },
      { name: 'day', seconds: 86400 },
      { name: 'hour', seconds: 3600 },
      { name: 'minute', seconds: 60 }
    ];

    for (const unit of units) {
      const interval = Math.floor(diffInSeconds / unit.seconds);
      if (interval >= 1) {
        return `${interval} ${unit.name}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'just now';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-6"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg p-4 shadow-sm"></div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="p-6 bg-red-50 rounded-lg border border-red-200 text-red-700 flex items-center gap-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>Error: {error}</div>
      </div>
    </div>
  );

  if (!forumDetails) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center py-20 text-gray-500">
        <div className="text-2xl mb-2">Forum not found</div>
        <Link href="/forums" className="text-blue-600 hover:underline">
          Return to forums list
        </Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto">
          <li className="flex items-center gap-2">
            <Link href="/forums" className="hover:text-gray-900 transition-colors">
              Forums
            </Link>
            <ChevronRight />
          </li>
          {forumDetails.parentCategoryId && (
            <li className="flex items-center gap-2">
              <Link
                href={`/forums/categories/${forumDetails.parentCategoryId}`}
                className="hover:text-gray-900 transition-colors"
              >
                {forumDetails.parentCategoryName}
              </Link>
              <ChevronRight />
            </li>
          )}
          <li className="text-gray-900 font-medium truncate" aria-current="page">
            {forumDetails.title}
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">{forumDetails.title}</h1>
            <p className="text-gray-600 max-w-3xl leading-relaxed">
              {forumDetails.description}
            </p>
          </div>
          <Link
            href={`/forums/${forumId}/threads/new`}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Thread
          </Link>
        </div>
      </div>

      {forumDetails.threads.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xl text-gray-500 mb-2">No threads found</p>
          <p className="text-gray-400">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 hidden sm:grid grid-cols-12 gap-4">
            <div className="col-span-6 text-sm font-medium text-gray-500">Thread</div>
            <div className="col-span-2 text-sm font-medium text-gray-500">Replies</div>
            <div className="col-span-2 text-sm font-medium text-gray-500">Views</div>
            <div className="col-span-2 text-sm font-medium text-gray-500">Last Post</div>
          </div>
          <ul className="divide-y divide-gray-100">
            {forumDetails.threads.map(thread => (
              <li
                key={thread.id}
                className="group p-6 hover:bg-gray-50 transition-colors duration-200 grid sm:grid-cols-12 gap-4"
              >
                <div className="sm:col-span-6 flex items-start gap-3">
                  <div className="flex-shrink-0 pt-1">
                    {thread.isPinned && (
                      <span className="text-yellow-500" title="Pinned Thread">
                        <PinIcon />
                      </span>
                    )}
                    {thread.isLocked && (
                      <span className="text-red-500" title="Locked Thread">
                        <LockIcon />
                      </span>
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/forums/${forumId}/threads/${thread.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                    >
                      {thread.title}
                    </Link>
                    <div className="mt-1 text-sm text-gray-500">
                      Started by{' '}
                      <Link
                        href={`/users/${thread.authorId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {thread.authorName}
                      </Link>
                      <span
                        className="mx-2"
                        title={formatTime(thread.createdTimestamp)}
                      >
                        {formatRelativeTime(thread.createdTimestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center">
                  <span className="text-gray-900 font-medium">
                    {thread.replyCount.toLocaleString()}
                  </span>
                </div>

                <div className="sm:col-span-2 flex items-center">
                  <span className="text-gray-900 font-medium">
                    {thread.viewCount.toLocaleString()}
                  </span>
                </div>

                <div className="sm:col-span-2">
                  {thread.lastPostUserName ? (
                    <div className="text-sm">
                      <Link
                        href={`/users/${thread.lastPostUserId}`}
                        className="text-blue-600 hover:underline line-clamp-1"
                      >
                        {thread.lastPostUserName}
                      </Link>
                      <div
                        className="text-gray-500 mt-1"
                        title={formatTime(thread.lastPostTimestamp)}
                      >
                        {formatRelativeTime(thread.lastPostTimestamp)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">No replies</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ForumTopicPage;
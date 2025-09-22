"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Pin, Lock, AlertCircle, Loader2 } from 'lucide-react';

/// Placeholder Types
interface ForumInfo {
  id: string;
  name: string;
  // For breadcrumbs
  parentCategoryName?: string;
  parentCategoryId?: string;
}

// Placeholder Data
const placeholderForumInfo: ForumInfo = {
  id: 'forum_python_beginners',
  name: 'Introduction to Python - Q&A',
  parentCategoryName: 'Course-Specific Forums',
  parentCategoryId: 'cat_courses',
};
const CreateNewThreadPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const forumId = params.forumId as string;

  const [forumInfo, setForumInfo] = useState<ForumInfo | null>(null);
  const [threadTitle, setThreadTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loadingForumInfo, setLoadingForumInfo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId) return;
    const fetchInfo = async () => {
      try {
        setLoadingForumInfo(true);
        // Simulated API call
        setTimeout(() => {
          setForumInfo({ ...placeholderForumInfo, id: forumId });
          setLoadingForumInfo(false);
        }, 300);
      } catch (err: any) {
        setError(err.message);
        setLoadingForumInfo(false);
      }
    };
    fetchInfo();
  }, [forumId]);

  const handleSubmitThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      setError('You must be logged in to create a thread');
      return;
    }
    
    if (!threadTitle.trim() || !postContent.trim() || !forumInfo) {
      setError('Title and content are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1200));
      const newThreadId = `thread_${Date.now()}`;
      router.push(`/forums/${forumInfo.id}/threads/${newThreadId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create thread');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingForumInfo) return <div className="text-center py-20">Loading forum information...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Breadcrumb Navigation */}
        <nav aria-label="breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            <li>
              <Link href="/forums" className="hover:text-gray-900 transition-colors flex items-center gap-1">
                <ChevronRight className="w-4 h-4 rotate-180" />
                Forums
              </Link>
            </li>
            {forumInfo?.parentCategoryId && (
              <>
                <li className="text-gray-400">/</li>
                <li>
                  <Link 
                    href={`/forums/categories/${forumInfo.parentCategoryId}`}
                    className="hover:text-gray-900 transition-colors"
                  >
                    {forumInfo.parentCategoryName}
                  </Link>
                </li>
              </>
            )}
            {forumInfo && (
              <>
                <li className="text-gray-400">/</li>
                <li>
                  <Link 
                    href={`/forums/${forumInfo.id}`}
                    className="hover:text-gray-900 transition-colors"
                  >
                    {forumInfo.name}
                  </Link>
                </li>
              </>
            )}
            <li className="text-gray-400">/</li>
            <li className="font-medium text-gray-900">New Thread</li>
          </ol>
        </nav>

        {/* Main Form Content */}
        <div className="space-y-1 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
            Create New Thread
          </h1>
          {forumInfo && (
            <p className="text-gray-600 text-lg">
              in <span className="font-medium text-gray-800">{forumInfo.name}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmitThread} className="bg-white rounded-xl shadow-lg p-6 space-y-6 border border-gray-100">
          {/* Thread Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Thread Title
            </label>
            <input 
              type="text"
              value={threadTitle}
              onChange={(e) => setThreadTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
              placeholder="What's your question or topic?"
              required
              disabled={submitting}
            />
          </div>

          {/* Post Content */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Message
            </label>
            <div className="relative">
              <textarea 
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400 resize-y min-h-[200px]"
                placeholder="Write your message here... (Markdown supported)"
                required
                disabled={submitting}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white px-2 rounded">
                {postContent.length}/5000
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Supports markdown formatting. Use # for headers, **bold**, and > for quotes
            </p>
          </div>

          {/* Moderator Options */}
          {(user?.role === 'admin' || user?.role === 'instructor') && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
              <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Pin className="w-4 h-4" />
                Moderator Controls
              </h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-blue-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)} 
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <span className="text-sm text-gray-700">Pin thread to top of forum</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-blue-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)} 
                    className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    disabled={submitting}
                  />
                  <span className="text-sm text-gray-700">Lock thread (disable replies)</span>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-gray-100">
            <Link 
              href={forumInfo ? `/forums/${forumInfo.id}` : '/forums'}
              className="w-full sm:w-auto text-center px-6 py-3 text-gray-700 hover:text-gray-900 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button 
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-lg shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={submitting || !threadTitle.trim() || !postContent.trim()}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Thread...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  Publish Thread
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNewThreadPage;
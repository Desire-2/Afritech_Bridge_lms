"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, AlertCircle, Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { ForumService } from '@/services/forum.service';
import { Button } from '@/components/ui/button';

const CreateNewThreadPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuth();
  const forumId = parseInt(params.forumId as string);

  const [forumInfo, setForumInfo] = useState<any>(null);
  const [threadTitle, setThreadTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [loadingForumInfo, setLoadingForumInfo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId || !token) return;
    fetchForumInfo();
  }, [forumId, token]);

  const fetchForumInfo = async () => {
    try {
      setLoadingForumInfo(true);
      const forum = await ForumService.getForumDetails(forumId);
      setForumInfo(forum);
    } catch (err: any) {
      setError(err.message || 'Failed to load forum information');
    } finally {
      setLoadingForumInfo(false);
    }
  };

  const handleSubmitThread = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !user) {
      setError('You must be logged in to create a thread');
      return;
    }
    
    if (!threadTitle.trim() || !postContent.trim()) {
      setError('Title and content are required.');
      return;
    }

    if (threadTitle.length > 200) {
      setError('Title must be less than 200 characters');
      return;
    }

    if (postContent.length > 5000) {
      setError('Content must be less than 5000 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newThread = await ForumService.createThread(forumId, {
        title: threadTitle,
        content: postContent
      });
      
      router.push(`/student/forums/${forumId}/threads/${newThread.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create thread');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingForumInfo) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-slate-300 text-lg">Loading forum information...</div>
        </div>
      </div>
    );
  }

  if (!forumInfo) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-red-900/50 rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-4">Forum not found</p>
          <Link href="/student/forums">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Back to Forums
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Breadcrumb Navigation */}
        <nav aria-label="breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
            <li>
              <Link href="/student/forums" className="hover:text-white transition-colors flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                Forums
              </Link>
            </li>
            <li>
              <ChevronRight className="w-4 h-4" />
            </li>
            <li>
              <Link 
                href={`/student/forums/${forumInfo.id}`}
                className="hover:text-white transition-colors"
              >
                {forumInfo.title}
              </Link>
            </li>
            <li>
              <ChevronRight className="w-4 h-4" />
            </li>
            <li className="font-medium text-white">New Thread</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/student/forums/${forumInfo.id}`}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {forumInfo.title}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Create New Thread
          </h1>
          {forumInfo.course_title && (
            <p className="text-slate-400">
              Course: <span className="text-indigo-400">{forumInfo.course_title}</span>
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitThread} className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
          {/* Thread Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Thread Title <span className="text-red-400">*</span>
            </label>
            <input 
              type="text"
              value={threadTitle}
              onChange={(e) => setThreadTitle(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-400"
              placeholder="What's your question or topic?"
              required
              disabled={submitting}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Be clear and descriptive</span>
              <span>{threadTitle.length}/200</span>
            </div>
          </div>

          {/* Post Content */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Your Message <span className="text-red-400">*</span>
            </label>
            <textarea 
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              rows={12}
              maxLength={5000}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-400 resize-y min-h-[200px]"
              placeholder="Write your message here... Provide as much detail as possible to help others understand your question or topic."
              required
              disabled={submitting}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Supports plain text and basic formatting</span>
              <span>{postContent.length}/5000</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-lg flex items-start gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-700">
            <Link href={`/student/forums/${forumInfo.id}`}>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                disabled={submitting}
              >
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
              disabled={submitting || !threadTitle.trim() || !postContent.trim()}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Thread...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Publish Thread
                </span>
              )}
            </Button>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-6 bg-indigo-900/20 border border-indigo-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Tips for Creating a Great Thread</h3>
          <ul className="text-sm text-slate-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-1">•</span>
              <span>Use a clear, descriptive title that summarizes your topic</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-1">•</span>
              <span>Provide enough context and details in your message</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-1">•</span>
              <span>Be respectful and constructive in your discussions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-1">•</span>
              <span>Search existing threads before posting to avoid duplicates</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreateNewThreadPage;

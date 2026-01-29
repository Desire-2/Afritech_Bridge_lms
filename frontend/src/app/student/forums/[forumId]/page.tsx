"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Clock, Plus, ChevronRight, AlertCircle, Loader2, ArrowLeft, Users, Pin } from 'lucide-react';
import { ForumService, Forum, ForumPost } from '@/services/forum.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ForumDetailPage = () => {
  const params = useParams();
  const { user, token } = useAuth();
  const forumId = parseInt(params.forumId as string);

  const [forum, setForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId || !token) {
      setLoading(false);
      return;
    }

    const fetchForum = async () => {
      setLoading(true);
      setError(null);
      try {
        const forumData = await ForumService.getForumDetails(forumId);
        setForum(forumData);
        setThreads(forumData.threads || []);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load forum');
      } finally {
        setLoading(false);
      }
    };

    fetchForum();
  }, [forumId, token]);

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    const units: { [key: string]: number } = {
      year: 31536000, month: 2592000, week: 604800,
      day: 86400, hour: 3600, minute: 60
    };

    for (const unit in units) {
      const interval = Math.floor(diffInSeconds / units[unit]);
      if (interval >= 1) return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-slate-300 text-lg">Loading forum...</div>
        </div>
      </div>
    );
  }

  if (error || !forum) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-red-900/50 rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-4">{error || 'Forum not found'}</p>
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
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
            <li>
              <Link href="/student/forums" className="hover:text-white transition-colors flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                Forums
              </Link>
            </li>
            <li><ChevronRight className="w-4 h-4" /></li>
            <li className="text-white font-medium">{forum.title}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/student/forums"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Forums
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{forum.title}</h1>
              {forum.description && (
                <p className="text-slate-400">{forum.description}</p>
              )}
              {forum.course_title && (
                <p className="text-sm text-indigo-400 mt-2">Course: {forum.course_title}</p>
              )}
            </div>
            
            {forum.is_enrolled !== false && (
              <Link href={`/student/forums/${forumId}/threads/new`}>
                <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  New Thread
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Threads</div>
            <div className="text-2xl font-bold text-white">{forum.thread_count}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Posts</div>
            <div className="text-2xl font-bold text-white">{forum.post_count}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 col-span-2 sm:col-span-1">
            <div className="text-slate-400 text-sm mb-1">Last Activity</div>
            <div className="text-sm font-medium text-white">
              {forum.last_post ? formatRelativeTime(forum.last_post.created_at) : 'No activity'}
            </div>
          </div>
        </div>

        {/* Threads List */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Discussions
            </h2>
          </div>

          {threads.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-4">No threads yet</p>
              {forum.is_enrolled !== false && (
                <Link href={`/student/forums/${forumId}/threads/new`}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Start the First Discussion
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/student/forums/${forumId}/threads/${thread.id}`}
                  className="block p-4 sm:p-6 hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex gap-4">
                    {/* Author Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-900/50 flex items-center justify-center border-2 border-indigo-700">
                        <span className="text-indigo-300 text-sm sm:text-base font-medium">
                          {thread.author_name?.[0] || 'U'}
                        </span>
                      </div>
                    </div>

                    {/* Thread Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors mb-1 flex items-center gap-2">
                        {thread.title}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                          {thread.author_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          {formatRelativeTime(thread.created_at)}
                        </span>
                        {thread.reply_count !== undefined && (
                          <Badge className="bg-slate-700 text-slate-300 border-slate-600">
                            {thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
                          </Badge>
                        )}
                      </div>

                      {/* Last Reply Info */}
                      {thread.last_reply && (
                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                          <span>Last reply by {thread.last_reply.author_name}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(thread.last_reply.created_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Enrollment Notice */}
        {forum.is_enrolled === false && forum.course_id && (
          <div className="mt-6 bg-amber-900/20 border border-amber-800/50 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Enrollment Required</h3>
                <p className="text-slate-300 mb-4">
                  You need to be enrolled in <span className="text-amber-400">{forum.course_title}</span> to participate in this forum.
                </p>
                <Link href={`/courses/${forum.course_id}`}>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    View Course
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForumDetailPage;

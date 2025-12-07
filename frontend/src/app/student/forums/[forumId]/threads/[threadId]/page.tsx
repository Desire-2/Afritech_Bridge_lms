"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Clock, User, Send, AlertCircle, Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import { ForumService, ForumPost } from '@/services/forum.service';
import { Button } from '@/components/ui/button';

const ThreadViewPage = () => {
  const params = useParams();
  const { user, token } = useAuth();
  const forumId = parseInt(params.forumId as string);
  const threadId = parseInt(params.threadId as string);

  const [thread, setThread] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    if (!forumId || !threadId || !token) return;
    fetchThread();
  }, [forumId, threadId, token]);

  const fetchThread = async () => {
    setLoading(true);
    setError(null);
    try {
      const threadData = await ForumService.getThreadDetails(threadId);
      setThread(threadData);
      setReplies((threadData as any).replies || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !user) return;

    setSubmittingReply(true);
    try {
      const newReply = await ForumService.createReply(threadId, {
        content: replyContent
      });
      setReplies([...replies, newReply]);
      setReplyContent('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

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
          <div className="text-slate-300 text-lg">Loading thread...</div>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-red-900/50 rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-4">{error || 'Thread not found'}</p>
          <Link href={`/student/forums/${forumId}`}>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Back to Forum
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
            <li>
              <Link href="/student/forums" className="hover:text-white transition-colors">
                <MessageSquare className="w-4 h-4 inline" /> Forums
              </Link>
            </li>
            <li><ChevronRight className="w-4 h-4" /></li>
            <li>
              <Link href={`/student/forums/${forumId}`} className="hover:text-white transition-colors">
                Forum
              </Link>
            </li>
            <li><ChevronRight className="w-4 h-4" /></li>
            <li className="text-white font-medium truncate">{thread.title}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/student/forums/${forumId}`}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Forum
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{thread.title}</h1>
        </div>

        {/* Original Post */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center border-2 border-indigo-700">
                <span className="text-indigo-300 text-lg font-medium">
                  {thread.author_name?.[0] || 'U'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold text-white">{thread.author_name}</span>
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(thread.created_at)}
                </span>
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 whitespace-pre-wrap">{thread.content}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Replies ({replies.length})
          </h2>
          
          {replies.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No replies yet. Be the first to respond!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {replies.map((reply) => (
                <div key={reply.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-slate-300 font-medium">
                          {reply.author_name?.[0] || 'U'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-white">{reply.author_name}</span>
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reply Form */}
        {user && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Post a Reply
            </h3>
            <form onSubmit={handleReplySubmit} className="space-y-4">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={6}
                maxLength={5000}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-slate-400 resize-y"
                placeholder="Write your reply..."
                required
                disabled={submittingReply}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{replyContent.length}/5000</span>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                  disabled={submittingReply || !replyContent.trim()}
                >
                  {submittingReply ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Posting...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Post Reply</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadViewPage;

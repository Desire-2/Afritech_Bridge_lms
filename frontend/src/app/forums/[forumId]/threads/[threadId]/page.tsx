"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface PostItem {
  id: string;
  authorName: string;
  authorId: string;
  authorAvatarUrl?: string;
  authorRole?: string;
  contentHtml: string;
  timestamp: string;
  isEdited?: boolean;
  editedTimestamp?: string;
}

interface ThreadDetails {
  id: string;
  title: string;
  forumId: string;
  forumName: string;
  posts: PostItem[];
  isLocked: boolean;
  isPinned: boolean;
  parentCategoryName?: string;
  parentCategoryId?: string;
}

const placeholderThreadDetails: ThreadDetails = {
  id: 'thread_python_listcomp',
  title: 'Help with list comprehensions in Python',
  forumId: 'forum_python_beginners',
  forumName: 'Introduction to Python - Q&A',
  parentCategoryName: 'Course-Specific Forums',
  parentCategoryId: 'cat_courses',
  isLocked: false,
  isPinned: true,
  posts: [
    // ... (keep the same post data)
  ],
};

const ThreadViewPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const forumId = params.forumId as string;
  const threadId = params.threadId as string;

  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const replyEditorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!forumId || !threadId) return;

    const fetchThreadPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 700));
        setThreadDetails({...placeholderThreadDetails, id: threadId, forumId });
      } catch (err: any) {
        setError(err.message || 'Failed to load thread.');
      } finally {
        setLoading(false);
      }
    };

    fetchThreadPosts();
  }, [forumId, threadId, token]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !user || !threadDetails) return;
    setSubmittingReply(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newPost: PostItem = {
        id: `post${Date.now()}`,
        authorName: `${user.first_name} ${user.last_name}`,
        authorId: user.id.toString(),
        authorAvatarUrl: user.profile_picture_url || '/placeholders/avatar_default.png',
        contentHtml: `<p>${replyContent.replace(/\n/g, '</p><p>')}</p>`,
        timestamp: new Date().toISOString(),
      };
      setThreadDetails(prev => prev ? ({ ...prev, posts: [...prev.posts, newPost] }) : null);
      setReplyContent('');
      setIsReplying(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-8"></div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl p-6 shadow-sm"></div>
          ))}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="p-6 bg-red-50 rounded-xl border border-red-200 text-red-700 flex items-center gap-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>Error: {error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="ml-auto text-red-900 hover:text-red-600 underline"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  if (!threadDetails) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center py-20 text-gray-500">
        <div className="text-2xl mb-2">Thread not found</div>
        <Link href="/forums" className="text-blue-600 hover:underline inline-flex items-center gap-1">
          <ChevronRight className="transform rotate-180" />
          Return to forums
        </Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Brand Header */}
      <div className="mb-8 flex items-center gap-3">
        <CompanyLogo />
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Afritec Bridge
        </span>
      </div>

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto">
          <li className="flex items-center gap-2">
            <Link href="/forums" className="hover:text-gray-900 transition-colors flex items-center gap-1">
              <HomeIcon className="w-4 h-4" />
              Forums
            </Link>
            <ChevronRight className="text-gray-400" />
          </li>
          {threadDetails.parentCategoryId && (
            <li className="flex items-center gap-2">
              <Link
                href={`/forums/categories/${threadDetails.parentCategoryId}`}
                className="hover:text-gray-900 transition-colors"
              >
                {threadDetails.parentCategoryName}
              </Link>
              <ChevronRight className="text-gray-400" />
            </li>
          )}
          <li className="flex items-center gap-2">
            <Link
              href={`/forums/${threadDetails.forumId}`}
              className="hover:text-gray-900 transition-colors"
            >
              {threadDetails.forumName}
            </Link>
            <ChevronRight className="text-gray-400" />
          </li>
          <li className="text-gray-900 font-medium truncate max-w-xs" aria-current="page">
            {threadDetails.title}
          </li>
        </ol>
      </nav>

      {/* Thread Header */}
      <div className="bg-white rounded-xl p-6 mb-8 shadow-sm border border-gray-100 relative">
        <div className="flex items-center gap-3 absolute top-4 right-6">
          {threadDetails.isPinned && (
            <span className="flex items-center gap-1 text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
              <PinIcon className="w-4 h-4" />
              Pinned
            </span>
          )}
          {threadDetails.isLocked && (
            <span className="flex items-center gap-1 text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full">
              <LockIcon className="w-4 h-4" />
              Locked
            </span>
          )}
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 break-words pr-20">
          {threadDetails.title}
        </h1>
        
        {!threadDetails.isLocked && (
          <button
            onClick={() => {
              setIsReplying(true);
              setTimeout(() => replyEditorRef.current?.focus(), 0);
            }}
            className="mt-4 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-lg transition-all transform hover:scale-[1.02]"
          >
            <ReplyIcon className="w-5 h-5" />
            Post Reply
          </button>
        )}
      </div>

      {/* Posts List */}
      <div className="space-y-6">
        {threadDetails.posts.map((post) => (
          <div
            key={post.id}
            id={`post-${post.id}`}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-200 hover:shadow-md relative"
          >
            {/* Author Badge */}
            <div className="absolute top-4 right-6 flex items-center gap-2">
              {post.authorRole === 'Instructor' && (
                <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Verified Instructor
                </span>
              )}
              {post.isEdited && (
                <span className="text-xs text-gray-500 italic" title={`Edited at ${formatTimestamp(post.editedTimestamp!)}`}>
                  Edited
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* Author Profile */}
              <div className="w-full sm:w-48 flex-shrink-0">
                <div className="flex sm:flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={post.authorAvatarUrl || '/placeholders/avatar_default.png'}
                      alt={`${post.authorName}'s avatar`}
                      className="w-16 h-16 rounded-full border-2 border-white shadow-lg"
                    />
                    {post.authorRole === 'Instructor' && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-white">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="sm:text-center">
                    <Link
                      href={`/users/${post.authorId}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition-colors block"
                    >
                      {post.authorName}
                    </Link>
                    <div className="text-xs text-gray-500 mt-1">
                      Joined 2 years ago
                    </div>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="flex-grow min-w-0">
                <div className="prose prose-sm sm:prose max-w-none break-words">
                  <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
                </div>

                {/* Post Actions */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Posted {formatRelativeTime(post.timestamp)}
                  </div>
                  {!threadDetails.isLocked && (
                    <button
                      onClick={() => {
                        setReplyContent(`> **${post.authorName}** wrote:\n${post.contentHtml}\n\n`);
                        setIsReplying(true);
                        setTimeout(() => replyEditorRef.current?.focus(), 0);
                      }}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ReplyIcon className="w-4 h-4" />
                      <span className="text-sm">Quote</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      {isReplying && !threadDetails.isLocked && (
        <div className="mt-8 bg-white rounded-xl shadow-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <ReplyIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Write Your Reply</h3>
          </div>
          
          <form onSubmit={handleReplySubmit}>
            <textarea
              ref={replyEditorRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={6}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm resize-y
                        prose max-w-none font-mono text-sm placeholder-gray-400"
              placeholder="**Start writing your reply here...**\n\n- You can use Markdown formatting\n- Add code snippets with ``` code blocks\n- Quote others using > quotes"
              required
              disabled={submittingReply}
            />
            
            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsReplying(false);
                  setReplyContent("");
                }}
                className="px-6 py-2.5 text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                disabled={submittingReply}
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                disabled={submittingReply || !replyContent.trim()}
              >
                {submittingReply ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Posting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    Publish Reply
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// SVG Components
const CompanyLogo = () => (
  <svg className="w-10 h-10 text-blue-600" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18ZM13.046 18L19.9742 42H6.11783L13.046 18ZM32 48L38.9282 72H25.0718L32 48Z" 
      fill="currentColor"/>
    <path d="M32 8L40 32H24L32 8ZM48 24L56 48H40L48 24ZM16 24L24 48H8L16 24ZM32 40L40 64H24L32 40Z" 
      fill="url(#logo-gradient)"/>
    <defs>
      <linearGradient id="logo-gradient" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7DD3FC"/>
        <stop offset="1" stopColor="#0EA5E9"/>
      </linearGradient>
    </defs>
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ReplyIcon = ({ className }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export default ThreadViewPage;
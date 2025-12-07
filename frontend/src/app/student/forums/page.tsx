"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquare, Users, Clock, BookOpen, ChevronRight, AlertCircle, 
  Search, Plus, TrendingUp, Award, Filter, Lock, Unlock 
} from 'lucide-react';
import { ForumService, Forum } from '@/services/forum.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ForumsHomePage = () => {
  const [generalForums, setGeneralForums] = useState<Forum[]>([]);
  const [courseForums, setCourseForums] = useState<Forum[]>([]);
  const [filteredGeneralForums, setFilteredGeneralForums] = useState<Forum[]>([]);
  const [filteredCourseForums, setFilteredCourseForums] = useState<Forum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<'all' | 'enrolled' | 'popular'>('all');
  const [stats, setStats] = useState({
    totalForums: 0,
    totalThreads: 0,
    totalPosts: 0,
    myPosts: 0
  });
  const { token, user } = useAuth();

  useEffect(() => {
    fetchForums();
  }, [token]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, filterOption, generalForums, courseForums]);

  const fetchForums = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const [forumsData, myPostsData] = await Promise.all([
        ForumService.getAllForums(),
        ForumService.getMyPosts().catch(() => ({ threads: [], replies: [], total_posts: 0 }))
      ]);

      setGeneralForums(forumsData.general_forums || []);
      setCourseForums(forumsData.course_forums || []);
      
      // Calculate stats
      const totalThreads = [...(forumsData.general_forums || []), ...(forumsData.course_forums || [])]
        .reduce((sum, forum) => sum + forum.thread_count, 0);
      const totalPosts = [...(forumsData.general_forums || []), ...(forumsData.course_forums || [])]
        .reduce((sum, forum) => sum + forum.post_count, 0);
      
      setStats({
        totalForums: forumsData.total_forums,
        totalThreads,
        totalPosts,
        myPosts: myPostsData.total_posts
      });
    } catch (err: any) {
      console.error('Error fetching forums:', err);
      setError(err.message || 'Failed to load forums.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let general = [...generalForums];
    let course = [...courseForums];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      general = general.filter(f => 
        f.title.toLowerCase().includes(query) || 
        f.description?.toLowerCase().includes(query)
      );
      course = course.filter(f => 
        f.title.toLowerCase().includes(query) || 
        f.description?.toLowerCase().includes(query) ||
        f.course_title?.toLowerCase().includes(query)
      );
    }

    // Apply filter option
    if (filterOption === 'enrolled') {
      course = course.filter(f => f.is_enrolled);
    } else if (filterOption === 'popular') {
      general = general.filter(f => f.thread_count >= 5);
      course = course.filter(f => f.thread_count >= 5);
    }

    setFilteredGeneralForums(general);
    setFilteredCourseForums(course);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

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

  const renderForumCard = (forum: Forum) => (
    <div 
      key={forum.id}
      className="p-6 hover:bg-slate-900/50 transition-colors group"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <Link
              href={`/student/forums/${forum.id}`}
              className="text-lg font-semibold text-white hover:text-indigo-400 transition-colors flex items-center gap-2 flex-1"
            >
              {forum.title}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 flex-shrink-0" />
            </Link>
            {forum.course_id && (
              forum.is_enrolled ? (
                <Badge className="bg-green-900/30 text-green-400 border-green-800">
                  <Unlock className="w-3 h-3 mr-1" />
                  Enrolled
                </Badge>
              ) : (
                <Badge className="bg-amber-900/30 text-amber-400 border-amber-800">
                  <Lock className="w-3 h-3 mr-1" />
                  Enroll Required
                </Badge>
              )
            )}
          </div>
          
          {forum.course_title && (
            <p className="text-sm text-indigo-400 mb-1">Course: {forum.course_title}</p>
          )}
          
          <p className="mt-1 text-slate-400 text-sm line-clamp-2">{forum.description}</p>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {forum.thread_count} {forum.thread_count === 1 ? 'thread' : 'threads'}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {forum.post_count} {forum.post_count === 1 ? 'post' : 'posts'}
            </span>
            {forum.thread_count >= 10 && (
              <Badge className="bg-orange-900/30 text-orange-400 border-orange-800 text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                Popular
              </Badge>
            )}
          </div>
        </div>

        {/* Last Post */}
        {forum.last_post && (
          <div className="w-full lg:w-72 text-sm">
            <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center border border-indigo-700">
                  <span className="text-indigo-400 text-sm font-medium">
                    {forum.last_post.author_name[0]}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate text-xs mb-1">
                  Latest: {forum.last_post.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">by {forum.last_post.author_name}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(forum.last_post.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <div className="text-slate-300 text-lg">Loading forums...</div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-red-900/50 rounded-xl p-8 text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <Button 
          onClick={fetchForums}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Try Again
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                  <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-400" />
                  Community Forums
                </h1>
                <p className="mt-2 text-slate-400 text-sm sm:text-base">Connect, learn, and collaborate with fellow learners</p>
              </div>
              
              {user && (
                <div className="flex flex-wrap gap-3">
                  {generalForums.length > 0 && (
                    <Link href={`/student/forums/${generalForums[0].id}/threads/new`}>
                      <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Thread
                      </Button>
                    </Link>
                  )}
                  <Link href="/student/forums/my-posts">
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white">
                      <Award className="w-4 h-4 mr-2" />
                      My Posts ({stats.myPosts})
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm mb-1">
                  <BookOpen className="w-4 h-4" />
                  Forums
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalForums}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm mb-1">
                  <MessageSquare className="w-4 h-4" />
                  Threads
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalThreads}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm mb-1">
                  <Users className="w-4 h-4" />
                  Posts
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalPosts}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm mb-1">
                  <Award className="w-4 h-4" />
                  My Posts
                </div>
                <p className="text-xl sm:text-2xl font-bold text-indigo-400">{stats.myPosts}</p>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search forums, threads, topics..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilterOption('all')}
                  variant={filterOption === 'all' ? 'default' : 'outline'}
                  className={filterOption === 'all' 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  All
                </Button>
                <Button
                  onClick={() => setFilterOption('enrolled')}
                  variant={filterOption === 'enrolled' ? 'default' : 'outline'}
                  className={filterOption === 'enrolled' 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Enrolled
                </Button>
                <Button
                  onClick={() => setFilterOption('popular')}
                  variant={filterOption === 'popular' ? 'default' : 'outline'}
                  className={filterOption === 'popular' 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Popular
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Forums Content */}
        {/* Forums Content */}
        {filteredGeneralForums.length === 0 && filteredCourseForums.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-dashed border-slate-700">
            <BookOpen className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <p className="text-xl text-slate-400 mb-2">
              {searchQuery ? 'No forums match your search' : 'No forums available yet'}
            </p>
            {searchQuery && (
              <Button 
                onClick={() => setSearchQuery('')}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* General Forums */}
            {filteredGeneralForums.length > 0 && (
              <section className="mb-6 sm:mb-8 bg-slate-800 rounded-xl shadow-sm border border-slate-700">
                <div className="p-4 sm:p-6 border-b border-slate-700">
                  <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    General Discussions
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">Open to all community members</p>
                </div>
                <div className="divide-y divide-slate-700">
                  {filteredGeneralForums.map(forum => renderForumCard(forum))}
                </div>
              </section>
            )}

            {/* Course Forums */}
            {filteredCourseForums.length > 0 && (
              <section className="mb-6 sm:mb-8 bg-slate-800 rounded-xl shadow-sm border border-slate-700">
                <div className="p-4 sm:p-6 border-b border-slate-700">
                  <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-400" />
                    Course-Specific Forums
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">Discussion spaces for enrolled courses</p>
                </div>
                <div className="divide-y divide-slate-700">
                  {filteredCourseForums.map(forum => renderForumCard(forum))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Help Text */}
        <div className="mt-8 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-800/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <MessageSquare className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Forum Guidelines</h3>
              <ul className="text-sm text-slate-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Be respectful and constructive in your discussions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Search before posting to avoid duplicate threads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Course forums require enrollment in the respective course</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Help others by sharing your knowledge and experience</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForumsHomePage;
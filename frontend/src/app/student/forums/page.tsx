"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquare, Users, Clock, BookOpen, ChevronRight, AlertCircle, 
  Search, Plus, TrendingUp, Award, Filter, Lock, Unlock, Bell, FileText
} from 'lucide-react';
import { ForumService, Forum } from '@/services/forum.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ForumsHomePage = () => {
  const [generalForums, setGeneralForums] = useState<Forum[]>([]);
  const [courseForums, setCourseForums] = useState<Forum[]>([]);
  const [categoryForums, setCategoryForums] = useState<Record<string, Forum[]>>({});
  const [filteredGeneralForums, setFilteredGeneralForums] = useState<Forum[]>([]);
  const [filteredCourseForums, setFilteredCourseForums] = useState<Forum[]>([]);
  const [filteredCategoryForums, setFilteredCategoryForums] = useState<Record<string, Forum[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<'all' | 'enrolled' | 'popular' | 'subscribed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [stats, setStats] = useState({
    totalForums: 0,
    totalThreads: 0,
    totalPosts: 0,
    myPosts: 0,
    notifications: 0
  });
  const { token, user } = useAuth();

  useEffect(() => {
    fetchForums();
  }, [token]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, filterOption, selectedCategory, generalForums, courseForums, categoryForums]);

  const fetchForums = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const [forumsData, myPostsData, notificationsData] = await Promise.all([
        ForumService.getAllForums(),
        ForumService.getUserPosts(),
        ForumService.getNotifications()
      ]);

      setGeneralForums(forumsData.general_forums || []);
      setCourseForums(forumsData.course_forums || []);
      setCategoryForums(forumsData.categories || {});

      // Calculate stats
      let totalThreads = 0;
      let totalPosts = 0;
      
      [...(forumsData.general_forums || []), ...(forumsData.course_forums || [])].forEach(forum => {
        totalThreads += forum.thread_count || 0;
        totalPosts += forum.post_count || 0;
      });

      Object.values(forumsData.categories || {}).forEach(categoryForums => {
        categoryForums.forEach(forum => {
          totalThreads += forum.thread_count || 0;
          totalPosts += forum.post_count || 0;
        });
      });

      setStats({
        totalForums: (forumsData.general_forums?.length || 0) + (forumsData.course_forums?.length || 0) + 
                     Object.values(forumsData.categories || {}).reduce((sum, forums) => sum + forums.length, 0),
        totalThreads,
        totalPosts,
        myPosts: myPostsData?.length || 0,
        notifications: notificationsData?.length || 0
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load forums');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filteredGeneral = [...generalForums];
    let filteredCourse = [...courseForums];
    let filteredCategories = { ...categoryForums };

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredGeneral = filteredGeneral.filter(forum =>
        forum.title.toLowerCase().includes(query) ||
        forum.description.toLowerCase().includes(query)
      );
      filteredCourse = filteredCourse.filter(forum =>
        forum.title.toLowerCase().includes(query) ||
        forum.description.toLowerCase().includes(query)
      );

      // Filter category forums
      const newFilteredCategories: Record<string, Forum[]> = {};
      Object.entries(filteredCategories).forEach(([categoryName, forums]) => {
        const filtered = forums.filter(forum =>
          forum.title.toLowerCase().includes(query) ||
          forum.description.toLowerCase().includes(query)
        );
        if (filtered.length > 0) {
          newFilteredCategories[categoryName] = filtered;
        }
      });
      filteredCategories = newFilteredCategories;
    }

    // Apply category filter
    if (selectedCategory) {
      filteredGeneral = [];
      filteredCourse = [];
      // Only show selected category
      if (filteredCategories[selectedCategory]) {
        filteredCategories = { [selectedCategory]: filteredCategories[selectedCategory] };
      } else {
        filteredCategories = {};
      }
    }

    // Apply filter option
    if (filterOption === 'enrolled') {
      // Only show course forums for enrolled courses
    } else if (filterOption === 'popular') {
      // Sort by activity
      filteredGeneral.sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
      filteredCourse.sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
      Object.keys(filteredCategories).forEach(cat => {
        filteredCategories[cat].sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
      });
    } else if (filterOption === 'subscribed') {
      // Only show subscribed forums
      filteredGeneral = filteredGeneral.filter(forum => forum.is_subscribed);
      filteredCourse = filteredCourse.filter(forum => forum.is_subscribed);
      Object.keys(filteredCategories).forEach(cat => {
        filteredCategories[cat] = filteredCategories[cat].filter(forum => forum.is_subscribed);
      });
    }

    setFilteredGeneralForums(filteredGeneral);
    setFilteredCourseForums(filteredCourse);
    setFilteredCategoryForums(filteredCategories);
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
        return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
      }
    }
    return 'just now';
  };

  const renderForumCard = (forum: Forum) => (
    <div key={forum.id} className="p-6 hover:bg-slate-900/50 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 mb-2 flex-1">
          <Link
            href={`/student/forums/${forum.id}`}
            className="text-lg font-semibold text-white hover:text-indigo-400 transition-colors flex items-center gap-2 flex-1"
          >
            {forum.title}
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 flex-shrink-0" />
          </Link>
          <div className="flex gap-2">
            {forum.is_public ? (
              <Badge className="bg-green-900/30 text-green-400 border-green-800">
                <Unlock className="w-3 h-3 mr-1" />
                Public
              </Badge>
            ) : (
              <Badge className="bg-amber-900/30 text-amber-400 border-amber-800">
                <Lock className="w-3 h-3 mr-1" />
                Private
              </Badge>
            )}
          </div>
        </div>
        
        {/* Action Buttons - Show on hover */}
        {user && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-4">
            <Link href={`/student/forums/${forum.id}/threads/new`}>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 text-white text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                New Thread
              </Button>
            </Link>
          </div>
        )}
      </div>
      {forum.course_title && (
        <p className="text-sm text-indigo-400 mb-1">Course: {forum.course_title}</p>
      )}
      <p className="mt-1 text-slate-400 text-sm line-clamp-2">{forum.description}</p>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-4 h-4" />
          {forum.thread_count} {forum.thread_count === 1 ? "thread" : "threads"}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {forum.post_count} {forum.post_count === 1 ? "post" : "posts"}
        </span>
        {forum.is_trending && (
          <Badge className="bg-orange-900/30 text-orange-400 border-orange-800 text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            Trending
          </Badge>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading forums...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <p className="text-xl text-red-400 mb-2">Failed to load forums</p>
              <p className="text-slate-400 mb-4">{error}</p>
              <Button onClick={fetchForums} className="bg-indigo-600 hover:bg-indigo-700">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Community Forums</h1>
              <p className="text-slate-400">Connect, discuss, and learn together</p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-indigo-400">{stats.totalForums}</div>
                <div className="text-slate-500">Forums</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{stats.totalThreads}</div>
                <div className="text-slate-500">Threads</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-400">{stats.totalPosts}</div>
                <div className="text-slate-500">Posts</div>
              </div>
              {stats.myPosts > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">{stats.myPosts}</div>
                  <div className="text-slate-500">My Posts</div>
                </div>
              )}
              {stats.notifications > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-400">{stats.notifications}</div>
                  <div className="text-slate-500">Notifications</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="text-white font-semibold">Quick Actions:</div>
                <div className="flex gap-2 text-sm text-slate-400">
                  <span>• Browse forums</span>
                  <span>• Join discussions</span>
                  <span>• Ask questions</span>
                  <span>• Share knowledge</span>
                </div>
              </div>
              
              {user && (
                <div className="flex flex-wrap gap-3">
                  {/* Create Thread - show if any forums are available */}
                  {(generalForums.length > 0 || courseForums.length > 0) && (
                    <>
                      {generalForums.length > 0 ? (
                        <Link href={`/student/forums/${generalForums[0].id}/threads/new`}>
                          <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Thread
                          </Button>
                        </Link>
                      ) : courseForums.length > 0 ? (
                        <Link href={`/student/forums/${courseForums[0].id}/threads/new`}>
                          <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Thread
                          </Button>
                        </Link>
                      ) : null}
                    </>
                  )}
                  
                  {/* If no forums at all, show a message or link to request forum creation */}
                  {generalForums.length === 0 && courseForums.length === 0 && Object.keys(categoryForums).length === 0 && (
                    <Button 
                      variant="outline" 
                      className="border-amber-600 text-amber-400 hover:bg-amber-900/20"
                      onClick={() => alert('No forums available yet. Contact an administrator to create forums.')}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Request Forum
                    </Button>
                  )}
                  
                  <Link href="/student/forums/my-posts">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <FileText className="w-4 h-4 mr-2" />
                      My Posts
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-8">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search forums, threads, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Filter Options */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setFilterOption('all')}
                  variant={filterOption === 'all' ? 'default' : 'outline'}
                  className={filterOption === 'all' 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  <Filter className="w-4 h-4 mr-2" />
                  All Forums
                </Button>
                <Button
                  onClick={() => setFilterOption('enrolled')}
                  variant={filterOption === 'enrolled' ? 'default' : 'outline'}
                  className={filterOption === 'enrolled' 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  My Courses
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
                <Button
                  onClick={() => setFilterOption('subscribed')}
                  variant={filterOption === 'subscribed' ? 'default' : 'outline'}
                  className={filterOption === 'subscribed' 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Subscribed
                </Button>
              </div>

              {/* Category Filter */}
              {Object.keys(categoryForums).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setSelectedCategory('')}
                    variant={selectedCategory === '' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedCategory === '' 
                      ? 'bg-slate-600 text-white hover:bg-slate-700' 
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }
                  >
                    All Categories
                  </Button>
                  {Object.keys(categoryForums).map((category) => (
                    <Button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      size="sm"
                      className={selectedCategory === category 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                      }
                    >
                      {category} ({categoryForums[category]?.length || 0})
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Forums Content */}
          <div className="space-y-6">
            {/* Empty State */}
            {filteredGeneralForums.length === 0 && 
             filteredCourseForums.length === 0 && 
             Object.keys(filteredCategoryForums).length === 0 ? (
              <div className="text-center py-16 bg-slate-800 rounded-xl border border-dashed border-slate-700">
                <BookOpen className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <p className="text-xl text-slate-400 mb-2">
                  {searchQuery ? "No forums match your search" : "No forums available yet"}
                </p>
                {searchQuery && (
                  <Button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('');
                    }}
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Clear Filters
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

                {/* Category Forums */}
                {Object.entries(filteredCategoryForums).map(([categoryName, forums]) => (
                  forums.length > 0 && (
                    <section key={categoryName} className="mb-6 sm:mb-8 bg-slate-800 rounded-xl shadow-sm border border-slate-700">
                      <div className="p-4 sm:p-6 border-b border-slate-700">
                        <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                          <FileText className="w-5 h-5 text-purple-400" />
                          {categoryName}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">{forums.length} forum{forums.length !== 1 ? "s" : ""} in this category</p>
                      </div>
                      <div className="divide-y divide-slate-700">
                        {forums.map(forum => renderForumCard(forum))}
                      </div>
                    </section>
                  )
                ))}

                {/* Course Forums */}
                {filteredCourseForums.length > 0 && (
                  <section className="mb-6 sm:mb-8 bg-slate-800 rounded-xl shadow-sm border border-slate-700">
                    <div className="p-4 sm:p-6 border-b border-slate-700">
                      <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-400" />
                        Course Forums
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
          </div>

          {/* Help Text */}
          <div className="mt-8 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-800/50 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Forum Guidelines</h3>
                <ul className="space-y-2 text-slate-300">
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
    </div>
  );
};

export default ForumsHomePage;
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquare, Users, Settings, Plus, Search, Filter, 
  Pin, Lock, Eye, AlertTriangle, CheckCircle, XCircle,
  Edit3, Trash2, MoreVertical, Calendar, TrendingUp,
  BookOpen, Shield, Bell, FileText, Clock, Database,
  Activity, BarChart3, Globe, Target, Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminForumService, AdminForumStats } from '@/services/admin-forum.service';
import { Forum, ForumPost } from '@/services/forum.service';

const AdminForumsPage = () => {
  const [forums, setForums] = useState<Forum[]>([]);
  const [pendingPosts, setPendingPosts] = useState<ForumPost[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked' | 'moderated'>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Forum | null>(null);
  const [stats, setStats] = useState<AdminForumStats>({
    totalForums: 0,
    totalThreads: 0,
    totalPosts: 0,
    totalUsers: 0,
    pendingPosts: 0,
    flaggedPosts: 0,
    dailyActivity: { posts: 0, threads: 0, users: 0 },
    topCategories: [],
    engagement: {
      avgPostsPerUser: 0,
      avgRepliesPerThread: 0,
      mostActiveUsers: []
    }
  });

  // Create forum form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: '',
    course_id: null,
    is_pinned: false,
    moderated: false,
    allow_anonymous: false
  });

  const { token, user } = useAuth();

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        forumsData,
        pendingData,
        flaggedData
      ] = await Promise.all([
        AdminForumService.getAllForums(),
        AdminForumService.getPendingPosts(),
        AdminForumService.getFlaggedPosts()
      ]);

      const allForums = forumsData.general_forums?.concat(forumsData.course_forums || []) || [];
      setForums(allForums);
      setPendingPosts(pendingData.pending_posts || []);
      setFlaggedPosts(flaggedData.flagged_posts || []);

      // Calculate comprehensive stats
      const totalThreads = allForums.reduce((sum, f) => sum + f.thread_count, 0);
      const totalPosts = allForums.reduce((sum, f) => sum + f.post_count, 0);
      
      // Group forums by category
      const categoryMap = new Map<string, number>();
      allForums.forEach(forum => {
        if (forum.category) {
          categoryMap.set(forum.category, (categoryMap.get(forum.category) || 0) + 1);
        }
      });
      
      const topCategories = Array.from(categoryMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalForums: allForums.length,
        totalThreads,
        totalPosts,
        totalUsers: 150, // This would come from a real API
        pendingPosts: pendingData.total_count || 0,
        flaggedPosts: flaggedData.total_count || 0,
        dailyActivity: {
          posts: 23, // Mock data - would come from analytics API
          threads: 8,
          users: 45
        },
        topCategories,
        engagement: {
          avgPostsPerUser: totalPosts > 0 ? Number((totalPosts / 150).toFixed(1)) : 0,
          avgRepliesPerThread: totalThreads > 0 ? Number((totalPosts / totalThreads).toFixed(1)) : 0,
          mostActiveUsers: [ // Mock data
            { name: 'John Doe', posts: 47 },
            { name: 'Jane Smith', posts: 32 },
            { name: 'Mike Johnson', posts: 28 }
          ]
        }
      });
    } catch (error) {
      console.error('Error fetching forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForum = async () => {
    try {
      await AdminForumService.createForum(createForm);
      setShowCreateDialog(false);
      setCreateForm({
        title: '',
        description: '',
        category: '',
        course_id: null,
        is_pinned: false,
        moderated: false,
        allow_anonymous: false
      });
      fetchData();
    } catch (error) {
      console.error('Error creating forum:', error);
    }
  };

  const handleDeleteForum = async (forum: Forum) => {
    try {
      await AdminForumService.deleteForum(forum.id);
      setShowDeleteDialog(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting forum:', error);
    }
  };

  const handleApprovePost = async (postId: number, approve: boolean) => {
    try {
      await AdminForumService.moderatePost(postId, approve);
      fetchData();
    } catch (error) {
      console.error('Error moderating post:', error);
    }
  };

  const handleToggleForumPin = async (forum: Forum) => {
    try {
      await AdminForumService.updateForum(forum.id, { is_pinned: !forum.is_pinned });
      fetchData();
    } catch (error) {
      console.error('Error pinning forum:', error);
    }
  };

  const handleToggleForumLock = async (forum: Forum) => {
    try {
      await AdminForumService.updateForum(forum.id, { is_locked: !forum.is_locked });
      fetchData();
    } catch (error) {
      console.error('Error locking forum:', error);
    }
  };

  const filteredForums = forums.filter(forum => {
    const matchesSearch = forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         forum.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         forum.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (filterStatus) {
      case 'active':
        return !forum.is_locked;
      case 'locked':
        return forum.is_locked;
      case 'moderated':
        return forum.moderated;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e293b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-slate-300 text-lg">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e293b]">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Shield className="w-8 h-8 text-indigo-400" />
                Forum Administration
              </h1>
              <p className="text-slate-400 mt-2">Complete forum management and analytics dashboard</p>
            </div>

            <div className="flex gap-3">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Forum
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Forum</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Create a new discussion forum with advanced settings.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          placeholder="Forum title"
                          value={createForm.title}
                          onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          placeholder="e.g., General, Technical, Announcements"
                          value={createForm.category}
                          onChange={(e) => setCreateForm({...createForm, category: e.target.value})}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Forum description and guidelines"
                        value={createForm.description}
                        onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="pinned"
                          checked={createForm.is_pinned}
                          onChange={(e) => setCreateForm({...createForm, is_pinned: e.target.checked})}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        <Label htmlFor="pinned">Pin forum</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="moderated"
                          checked={createForm.moderated}
                          onChange={(e) => setCreateForm({...createForm, moderated: e.target.checked})}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        <Label htmlFor="moderated">Require approval</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="anonymous"
                          checked={createForm.allow_anonymous}
                          onChange={(e) => setCreateForm({...createForm, allow_anonymous: e.target.checked})}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        <Label htmlFor="anonymous">Allow anonymous</Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateForum} disabled={!createForm.title.trim()}>
                      Create Forum
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Archive className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="forums" className="data-[state=active]:bg-slate-700">
              Forums ({stats.totalForums})
            </TabsTrigger>
            <TabsTrigger value="moderation" className="data-[state=active]:bg-slate-700">
              Moderation ({stats.pendingPosts + stats.flaggedPosts})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-700">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              {/* Key Metrics */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-200">Total Forums</CardTitle>
                  <BookOpen className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.totalForums}</div>
                  <p className="text-xs text-slate-400">Active community spaces</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-200">Total Posts</CardTitle>
                  <MessageSquare className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.totalPosts}</div>
                  <p className="text-xs text-slate-400">Including threads and replies</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-200">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
                  <p className="text-xs text-slate-400">Participating members</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-200">Needs Attention</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.pendingPosts + stats.flaggedPosts}</div>
                  <p className="text-xs text-slate-400">Pending moderation</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Categories */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-400" />
                    Top Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topCategories.map((category, index) => (
                      <div key={category.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center">
                            <span className="text-indigo-400 text-sm font-bold">{index + 1}</span>
                          </div>
                          <span className="text-slate-200">{category.name}</span>
                        </div>
                        <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                          {category.count} forums
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Engagement Stats */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    Engagement Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Avg Posts per User</span>
                      <span className="text-white font-bold">{stats.engagement.avgPostsPerUser}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Avg Replies per Thread</span>
                      <span className="text-white font-bold">{stats.engagement.avgRepliesPerThread}</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="text-slate-300 font-medium mb-2">Most Active Users</h4>
                      <div className="space-y-2">
                        {stats.engagement.mostActiveUsers.map((user, index) => (
                          <div key={user.name} className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">{user.name}</span>
                            <span className="text-slate-300 text-sm">{user.posts} posts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Forums Management Tab */}
          <TabsContent value="forums">
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search forums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Forums</SelectItem>
                    <SelectItem value="active">Active Forums</SelectItem>
                    <SelectItem value="locked">Locked Forums</SelectItem>
                    <SelectItem value="moderated">Moderated Forums</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Forums List */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
                {filteredForums.map((forum) => (
                  <div key={forum.id} className="p-6 hover:bg-slate-900/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            href={`/admin/forums/${forum.id}`}
                            className="text-lg font-semibold text-white hover:text-indigo-400"
                          >
                            {forum.title}
                          </Link>
                          {forum.is_pinned && (
                            <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                              <Pin className="w-3 h-3 mr-1" />
                              Pinned
                            </Badge>
                          )}
                          {forum.is_locked && (
                            <Badge variant="outline" className="border-red-600 text-red-400">
                              <Lock className="w-3 h-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                          {forum.moderated && (
                            <Badge variant="outline" className="border-purple-600 text-purple-400">
                              <Shield className="w-3 h-3 mr-1" />
                              Moderated
                            </Badge>
                          )}
                        </div>

                        {forum.category && (
                          <p className="text-sm text-indigo-400 mb-1">Category: {forum.category}</p>
                        )}

                        {forum.description && (
                          <p className="text-slate-400 text-sm mb-3 line-clamp-2">{forum.description}</p>
                        )}

                        <div className="flex items-center gap-6 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {forum.thread_count} threads
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {forum.post_count} posts
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {forum.view_count || 0} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(forum.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/forums/${forum.id}`} className="cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit Forum
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem onClick={() => handleToggleForumPin(forum)}>
                            <Pin className="w-4 h-4 mr-2" />
                            {forum.is_pinned ? 'Unpin' : 'Pin'} Forum
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleForumLock(forum)}>
                            <Lock className="w-4 h-4 mr-2" />
                            {forum.is_locked ? 'Unlock' : 'Lock'} Forum
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem 
                            onClick={() => setShowDeleteDialog(forum)}
                            className="text-red-400 focus:text-red-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Forum
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}

                {filteredForums.length === 0 && (
                  <div className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">No forums found matching your criteria</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Moderation Tab */}
          <TabsContent value="moderation">
            <div className="space-y-6">
              {/* Pending Posts */}
              {stats.pendingPosts > 0 && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      Pending Posts ({stats.pendingPosts})
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Posts awaiting moderation approval
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingPosts.slice(0, 5).map((post) => (
                        <div key={post.id} className="border border-slate-700 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-white">{post.title}</h4>
                              <p className="text-sm text-slate-400">
                                by {post.author_name} in {post.forum_title}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprovePost(post.id, true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprovePost(post.id, false)}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Flagged Posts */}
              {stats.flaggedPosts > 0 && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Flagged Posts ({stats.flaggedPosts})
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Posts reported by community members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {flaggedPosts.slice(0, 5).map((post) => (
                        <div key={post.id} className="border border-red-900/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-white">{post.title}</h4>
                              <p className="text-sm text-slate-400">
                                by {post.author_name} in {post.forum_title}
                              </p>
                              {post.flag_reason && (
                                <p className="text-sm text-red-400 mt-1">
                                  <strong>Reason:</strong> {post.flag_reason}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprovePost(post.id, true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Clear Flag
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprovePost(post.id, false)}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats.pendingPosts === 0 && stats.flaggedPosts === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
                  <p className="text-slate-400">No posts requiring moderation attention</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Daily Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">New Posts</span>
                      <span className="text-white font-bold">{stats.dailyActivity.posts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">New Threads</span>
                      <span className="text-white font-bold">{stats.dailyActivity.threads}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Active Users</span>
                      <span className="text-white font-bold">{stats.dailyActivity.users}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Active Forums</span>
                      <Badge variant="secondary" className="bg-green-900 text-green-200">
                        {forums.filter(f => !f.is_locked).length} / {forums.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Moderated Forums</span>
                      <Badge variant="secondary" className="bg-purple-900 text-purple-200">
                        {forums.filter(f => f.moderated).length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Categories</span>
                      <Badge variant="secondary" className="bg-blue-900 text-blue-200">
                        {stats.topCategories.length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Forum Dialog */}
        <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Forum</DialogTitle>
              <DialogDescription className="text-slate-400">
                Are you sure you want to delete "{showDeleteDialog?.title}"? This action cannot be undone and will remove all threads and posts in this forum.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => showDeleteDialog && handleDeleteForum(showDeleteDialog)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Forum
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminForumsPage;
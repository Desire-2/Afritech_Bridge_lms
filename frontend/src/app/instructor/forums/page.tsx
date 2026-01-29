"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MessageSquare, Users, Settings, Plus, Search, Filter, 
  Pin, Lock, Eye, AlertTriangle, CheckCircle, XCircle,
  Edit3, Trash2, MoreVertical, Calendar, TrendingUp,
  BookOpen, Shield, Bell, FileText, Clock
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
import { InstructorForumService, Forum, ForumPost } from '@/services/instructor-forum.service';

interface ForumStats {
  totalForums: number;
  myForums: number;
  pendingPosts: number;
  flaggedPosts: number;
}

const InstructorForumsPage = () => {
  const [forums, setForums] = useState<Forum[]>([]);
  const [pendingPosts, setPendingPosts] = useState<ForumPost[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'my-forums' | 'moderated'>('all');
  const [activeTab, setActiveTab] = useState('forums');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stats, setStats] = useState<ForumStats>({
    totalForums: 0,
    myForums: 0,
    pendingPosts: 0,
    flaggedPosts: 0
  });

  // Create forum form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: '',
    course_id: null,
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
        InstructorForumService.getAllForums(),
        InstructorForumService.getPendingPosts(),
        InstructorForumService.getFlaggedPosts()
      ]);

      setForums(forumsData.general_forums?.concat(forumsData.course_forums || []) || []);
      setPendingPosts(pendingData.pending_posts || []);
      setFlaggedPosts(flaggedData.flagged_posts || []);

      // Calculate stats
      const myForums = forumsData.general_forums?.concat(forumsData.course_forums || []).filter(f => f.created_by === user?.id) || [];
      setStats({
        totalForums: forumsData.total_forums || 0,
        myForums: myForums.length,
        pendingPosts: pendingData.total_count || 0,
        flaggedPosts: flaggedData.total_count || 0
      });
    } catch (error) {
      console.error('Error fetching forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForum = async () => {
    try {
      await InstructorForumService.createForum(createForm);
      setShowCreateDialog(false);
      setCreateForm({
        title: '',
        description: '',
        category: '',
        course_id: null,
        moderated: false,
        allow_anonymous: false
      });
      fetchData();
    } catch (error) {
      console.error('Error creating forum:', error);
    }
  };

  const handleApprovePost = async (postId: number, approve: boolean) => {
    try {
      await InstructorForumService.approvePost(postId, approve);
      fetchData();
    } catch (error) {
      console.error('Error moderating post:', error);
    }
  };

  const handlePinPost = async (postId: number, pinned: boolean) => {
    try {
      await InstructorForumService.pinPost(postId, pinned);
      fetchData();
    } catch (error) {
      console.error('Error pinning post:', error);
    }
  };

  const handleLockPost = async (postId: number, locked: boolean) => {
    try {
      await InstructorForumService.lockPost(postId, locked);
      fetchData();
    } catch (error) {
      console.error('Error locking post:', error);
    }
  };

  const filteredForums = forums.filter(forum => {
    const matchesSearch = forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         forum.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         forum.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (filterStatus) {
      case 'my-forums':
        return forum.created_by === user?.id;
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
          <div className="text-slate-300 text-lg">Loading forum management...</div>
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
                <MessageSquare className="w-8 h-8 text-indigo-400" />
                Forum Management
              </h1>
              <p className="text-slate-400 mt-2">Manage and moderate community discussions</p>
            </div>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Forum
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 text-white">
                <DialogHeader>
                  <DialogTitle>Create New Forum</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a new discussion forum for your courses or general topics.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
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
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Forum description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      placeholder="e.g., General, Technical, Assignments"
                      value={createForm.category}
                      onChange={(e) => setCreateForm({...createForm, category: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="moderated"
                      checked={createForm.moderated}
                      onChange={(e) => setCreateForm({...createForm, moderated: e.target.checked})}
                      className="rounded bg-slate-700 border-slate-600"
                    />
                    <Label htmlFor="moderated">Require post approval</Label>
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
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Forums</p>
                  <p className="text-2xl font-bold text-white">{stats.totalForums}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Settings className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">My Forums</p>
                  <p className="text-2xl font-bold text-white">{stats.myForums}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pending Posts</p>
                  <p className="text-2xl font-bold text-white">{stats.pendingPosts}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Flagged Posts</p>
                  <p className="text-2xl font-bold text-white">{stats.flaggedPosts}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="forums" className="data-[state=active]:bg-slate-700">
              Forums ({stats.totalForums})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-slate-700">
              Pending ({stats.pendingPosts})
            </TabsTrigger>
            <TabsTrigger value="flagged" className="data-[state=active]:bg-slate-700">
              Flagged ({stats.flaggedPosts})
            </TabsTrigger>
          </TabsList>

          {/* Forums Tab */}
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
                    <SelectItem value="my-forums">My Forums</SelectItem>
                    <SelectItem value="moderated">Moderated</SelectItem>
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
                            href={`/instructor/forums/${forum.id}`}
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
                          {forum.created_by === user?.id && (
                            <Badge variant="outline" className="border-green-600 text-green-400">
                              Owner
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
                            <Bell className="w-4 h-4" />
                            {forum.subscriber_count || 0} subscribers
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
                            <Link href={`/instructor/forums/${forum.id}`} className="cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {forum.created_by === user?.id && (
                            <>
                              <DropdownMenuItem>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit Forum
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                            </>
                          )}
                          <DropdownMenuItem>
                            <Pin className="w-4 h-4 mr-2" />
                            {forum.is_pinned ? 'Unpin' : 'Pin'} Forum
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Lock className="w-4 h-4 mr-2" />
                            {forum.is_locked ? 'Unlock' : 'Lock'} Forum
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

          {/* Pending Posts Tab */}
          <TabsContent value="pending">
            <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
              {pendingPosts.map((post) => (
                <div key={post.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{post.title}</h3>
                      <p className="text-sm text-slate-400 mb-2">
                        by {post.author_name} in {post.forum_title}
                      </p>
                      <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded border-l-4 border-yellow-500">
                        {post.content}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Posted {new Date(post.created_at).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprovePost(post.id, true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprovePost(post.id, false)}
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {pendingPosts.length === 0 && (
                <div className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-slate-400">No posts pending approval</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Flagged Posts Tab */}
          <TabsContent value="flagged">
            <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
              {flaggedPosts.map((post) => (
                <div key={post.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white">{post.title}</h3>
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Flagged
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">
                        by {post.author_name} in {post.forum_title}
                      </p>
                      {post.flag_reason && (
                        <p className="text-sm text-red-400 mb-2">
                          <strong>Flag reason:</strong> {post.flag_reason}
                        </p>
                      )}
                      <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded border-l-4 border-red-500">
                        {post.content}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Posted {new Date(post.created_at).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprovePost(post.id, true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Clear Flag
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprovePost(post.id, false)}
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove Post
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {flaggedPosts.length === 0 && (
                <div className="p-12 text-center">
                  <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-slate-400">No flagged posts requiring attention</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InstructorForumsPage;
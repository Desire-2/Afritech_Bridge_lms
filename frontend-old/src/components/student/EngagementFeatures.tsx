"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Heart, 
  Share2, 
  Bookmark, 
  Edit3, 
  Save, 
  Trash2,
  Reply,
  Send,
  Users,
  UserCircle,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Pin,
  Flag,
  MoreVertical,
  Highlighter,
  StickyNote,
  Quote,
  Link,
  Download,
  Eye,
  MessageCircle,
  Sparkles,
  Zap,
  Award,
  Target,
  Brain,
  Lightbulb,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Tag,
  Hash,
  AtSign,
  Smile,
  Image as ImageIcon,
  Paperclip,
  Mic,
  Video,
  Coffee,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface Note {
  id: string;
  content: string;
  timestamp: number;
  videoTimestamp?: number;
  pageNumber?: number;
  isHighlight: boolean;
  color: string;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionMessage {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role: 'student' | 'instructor' | 'ta';
    level: number;
  };
  timestamp: string;
  likes: number;
  replies: DiscussionMessage[];
  isLiked: boolean;
  isPinned: boolean;
  tags: string[];
  attachments?: { name: string; url: string; type: string }[];
  mentions?: string[];
  isEdited?: boolean;
  lessonTimestamp?: number;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members: Array<{
    id: string;
    name: string;
    avatar?: string;
    isOnline: boolean;
    role: 'member' | 'moderator' | 'admin';
  }>;
  isPublic: boolean;
  topic: string;
  activityLevel: 'low' | 'medium' | 'high';
}

interface EngagementFeaturesProps {
  lessonId: number;
  courseId: number;
  userId: string;
  onNoteCreate?: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDiscussionPost?: (content: string, mentions?: string[], tags?: string[]) => void;
}

const SmartNoteEditor: React.FC<{
  onSave: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  videoTimestamp?: number;
  selectedText?: string;
}> = ({ onSave, videoTimestamp, selectedText }) => {
  const [content, setContent] = useState(selectedText || '');
  const [tags, setTags] = useState<string[]>([]);
  const [color, setColor] = useState('#fef08a');
  const [isHighlight, setIsHighlight] = useState(!!selectedText);
  const [isPrivate, setIsPrivate] = useState(false);
  const [tagInput, setTagInput] = useState('');
  
  const colors = [
    { name: 'Yellow', value: '#fef08a', class: 'bg-yellow-200' },
    { name: 'Green', value: '#bbf7d0', class: 'bg-green-200' },
    { name: 'Blue', value: '#bfdbfe', class: 'bg-blue-200' },
    { name: 'Purple', value: '#ddd6fe', class: 'bg-purple-200' },
    { name: 'Pink', value: '#fce7f3', class: 'bg-pink-200' },
    { name: 'Orange', value: '#fed7aa', class: 'bg-orange-200' },
  ];

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleSave = () => {
    if (!content.trim()) return;
    
    onSave({
      content: content.trim(),
      timestamp: Date.now(),
      videoTimestamp,
      isHighlight,
      color,
      tags,
      isPrivate
    });
    
    setContent('');
    setTags([]);
    setIsHighlight(false);
    setIsPrivate(false);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Edit3 className="h-5 w-5" />
          <span>Smart Notes</span>
          {videoTimestamp && (
            <Badge variant="outline" className="text-xs">
              @{Math.floor(videoTimestamp / 60)}:{String(Math.floor(videoTimestamp % 60)).padStart(2, '0')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Write your note or highlight..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          
          {selectedText && (
            <div className="p-2 bg-muted/50 rounded text-sm border-l-4 border-blue-500">
              <div className="font-medium text-xs text-muted-foreground mb-1">HIGHLIGHTED TEXT:</div>
              "{selectedText}"
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium">Color:</span>
            {colors.map((colorOption) => (
              <button
                key={colorOption.value}
                className={`w-6 h-6 rounded-full border-2 ${colorOption.class} ${
                  color === colorOption.value ? 'border-gray-800' : 'border-gray-300'
                }`}
                onClick={() => setColor(colorOption.value)}
              />
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={isHighlight ? "default" : "outline"}
              size="sm"
              onClick={() => setIsHighlight(!isHighlight)}
            >
              <Highlighter className="h-4 w-4 mr-1" />
              Highlight
            </Button>
            
            <Button
              variant={isPrivate ? "default" : "outline"}
              size="sm"
              onClick={() => setIsPrivate(!isPrivate)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Private
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Add tags..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
              className="flex-1"
            />
            <Button size="sm" onClick={() => handleAddTag(tagInput)}>
              <Tag className="h-4 w-4" />
            </Button>
          </div>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                  <button
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                    className="ml-1 hover:text-red-500"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {content.length}/1000 characters
          </div>
          <Button onClick={handleSave} disabled={!content.trim()}>
            <Save className="h-4 w-4 mr-2" />
            Save Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DiscussionThread: React.FC<{
  messages: DiscussionMessage[];
  onReply: (messageId: string, content: string) => void;
  onLike: (messageId: string) => void;
  onPin: (messageId: string) => void;
  currentUser: string;
}> = ({ messages, onReply, onLike, onPin, currentUser }) => {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  const sortedMessages = [...messages].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'oldest':
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      case 'popular':
        return b.likes - a.likes;
      default:
        return 0;
    }
  });

  const handleReply = (messageId: string) => {
    if (!replyContent.trim()) return;
    onReply(messageId, replyContent);
    setReplyContent('');
    setReplyingTo(null);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'instructor': return 'text-blue-600';
      case 'ta': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'instructor': return 'Instructor';
      case 'ta': return 'TA';
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Discussion ({messages.length})</h3>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {sortedMessages.map((message) => (
          <motion.div
            key={message.id}
            className={`p-4 rounded-lg border ${message.isPinned ? 'bg-blue-50 border-blue-200' : 'bg-background'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={message.author.avatar} />
                <AvatarFallback>{message.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`font-medium text-sm ${getRoleColor(message.author.role)}`}>
                    {message.author.name}
                  </span>
                  {getRoleBadge(message.author.role) && (
                    <Badge variant="outline" className="text-xs">
                      {getRoleBadge(message.author.role)}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    Lvl {message.author.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
                  {message.isPinned && <Pin className="h-3 w-3 text-blue-500" />}
                  {message.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                </div>
                
                <div className="text-sm mb-2">{message.content}</div>
                
                {message.lessonTimestamp && (
                  <Badge variant="outline" className="text-xs mb-2">
                    @{Math.floor(message.lessonTimestamp / 60)}:{String(Math.floor(message.lessonTimestamp % 60)).padStart(2, '0')}
                  </Badge>
                )}
                
                {message.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {message.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {message.attachments && message.attachments.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {message.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center space-x-2 text-xs text-blue-600">
                        <Paperclip className="h-3 w-3" />
                        <span>{attachment.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLike(message.id)}
                    className={`text-xs ${message.isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
                  >
                    <Heart className={`h-3 w-3 mr-1 ${message.isLiked ? 'fill-current' : ''}`} />
                    {message.likes}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(message.id)}
                    className="text-xs text-muted-foreground"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                  
                  {message.author.role === 'instructor' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPin(message.id)}
                      className="text-xs text-muted-foreground"
                    >
                      <Pin className="h-3 w-3 mr-1" />
                      {message.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                  
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    <Share2 className="h-3 w-3 mr-1" />
                    Share
                  </Button>
                </div>
                
                {/* Replies */}
                {message.replies.length > 0 && (
                  <div className="mt-3 ml-4 space-y-2 border-l-2 border-muted pl-4">
                    {message.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={reply.author.avatar} />
                          <AvatarFallback className="text-xs">{reply.author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <span className="font-medium text-xs">{reply.author.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(reply.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs mt-1">{reply.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reply Input */}
                {replyingTo === message.id && (
                  <motion.div
                    className="mt-3 space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex justify-end space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleReply(message.id)}>
                        <Send className="h-3 w-3 mr-1" />
                        Reply
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const StudyGroupPanel: React.FC<{
  groups: StudyGroup[];
  onJoinGroup: (groupId: string) => void;
  onCreateGroup: (name: string, description: string, isPublic: boolean) => void;
}> = ({ groups, onJoinGroup, onCreateGroup }) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName, newGroupDescription, newGroupIsPublic);
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupIsPublic(true);
    setShowCreateDialog(false);
  };

  const getActivityIcon = (level: string) => {
    switch (level) {
      case 'high': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'low': return <TrendingUp className="h-4 w-4 text-gray-400" />;
      default: return <TrendingUp className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Study Groups</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">Create Group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Study Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <Textarea
                placeholder="Group description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newGroupIsPublic}
                  onChange={(e) => setNewGroupIsPublic(e.target.checked)}
                />
                <span className="text-sm">Public group</span>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateGroup}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <Card key={group.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{group.name}</h4>
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {getActivityIcon(group.activityLevel)}
                  <Badge variant={group.isPublic ? "secondary" : "outline"} className="text-xs">
                    {group.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-1">
                    {group.members.slice(0, 3).map((member) => (
                      <Avatar key={member.id} className="w-6 h-6 border-2 border-background">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="text-xs">{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {group.members.length} members
                  </span>
                  <div className="flex items-center space-x-1">
                    {group.members.filter(m => m.isOnline).length > 0 && (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600">
                          {group.members.filter(m => m.isOnline).length} online
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <Button size="sm" onClick={() => onJoinGroup(group.id)}>
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const EngagementFeatures: React.FC<EngagementFeaturesProps> = ({
  lessonId,
  courseId,
  userId,
  onNoteCreate,
  onDiscussionPost
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionMessage[]>([]);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newDiscussionContent, setNewDiscussionContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Load notes, discussions, and study groups
    setNotes([
      {
        id: '1',
        content: 'This concept about React hooks is really important',
        timestamp: Date.now() - 3600000,
        videoTimestamp: 120,
        isHighlight: true,
        color: '#fef08a',
        tags: ['important', 'react', 'hooks'],
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    setDiscussions([
      {
        id: '1',
        content: 'Can someone explain the difference between useState and useReducer?',
        author: {
          id: '1',
          name: 'Alice Johnson',
          role: 'student',
          level: 5
        },
        timestamp: new Date().toISOString(),
        likes: 3,
        replies: [],
        isLiked: false,
        isPinned: false,
        tags: ['question', 'react', 'hooks']
      }
    ]);

    setStudyGroups([
      {
        id: '1',
        name: 'React Beginners',
        description: 'Learning React fundamentals together',
        members: [
          { id: '1', name: 'Alice', isOnline: true, role: 'member' },
          { id: '2', name: 'Bob', isOnline: false, role: 'member' },
          { id: '3', name: 'Carol', isOnline: true, role: 'moderator' }
        ],
        isPublic: true,
        topic: 'React Development',
        activityLevel: 'high'
      }
    ]);
  }, [lessonId]);

  const handleCreateNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: Note = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setNotes([...notes, newNote]);
    onNoteCreate?.(noteData);
  };

  const handlePostDiscussion = () => {
    if (!newDiscussionContent.trim()) return;
    
    const newMessage: DiscussionMessage = {
      id: Date.now().toString(),
      content: newDiscussionContent,
      author: {
        id: userId,
        name: 'Current User',
        role: 'student',
        level: 3
      },
      timestamp: new Date().toISOString(),
      likes: 0,
      replies: [],
      isLiked: false,
      isPinned: false,
      tags: []
    };
    
    setDiscussions([newMessage, ...discussions]);
    setNewDiscussionContent('');
    setShowNewDiscussion(false);
    onDiscussionPost?.(newDiscussionContent);
  };

  const filteredNotes = notes.filter(note => 
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (filterTag === '' || note.tags.includes(filterTag))
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notes" className="flex items-center space-x-1">
            <StickyNote className="h-4 w-4" />
            <span>Notes</span>
          </TabsTrigger>
          <TabsTrigger value="discussion" className="flex items-center space-x-1">
            <MessageSquare className="h-4 w-4" />
            <span>Discussion</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>Study Groups</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center space-x-1">
            <Brain className="h-4 w-4" />
            <span>AI Tutor</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <SmartNoteEditor
            onSave={handleCreateNote}
            selectedText={selectedText}
          />
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Filter by tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tags</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="concept">Concept</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                className="p-4 rounded-lg border"
                style={{ backgroundColor: note.color }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {note.isHighlight && <Highlighter className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    {note.videoTimestamp && (
                      <Badge variant="outline" className="text-xs">
                        @{Math.floor(note.videoTimestamp / 60)}:{String(Math.floor(note.videoTimestamp % 60)).padStart(2, '0')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm mb-2">{note.content}</p>
                
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="discussion" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Course Discussion</h3>
            <Button onClick={() => setShowNewDiscussion(!showNewDiscussion)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              New Discussion
            </Button>
          </div>
          
          {showNewDiscussion && (
            <motion.div
              className="space-y-3 p-4 border rounded-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <Textarea
                placeholder="Start a discussion..."
                value={newDiscussionContent}
                onChange={(e) => setNewDiscussionContent(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowNewDiscussion(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePostDiscussion}>
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </motion.div>
          )}
          
          <DiscussionThread
            messages={discussions}
            onReply={(messageId, content) => console.log('Reply:', messageId, content)}
            onLike={(messageId) => console.log('Like:', messageId)}
            onPin={(messageId) => console.log('Pin:', messageId)}
            currentUser={userId}
          />
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <StudyGroupPanel
            groups={studyGroups}
            onJoinGroup={(groupId) => console.log('Join group:', groupId)}
            onCreateGroup={(name, description, isPublic) => console.log('Create group:', name, description, isPublic)}
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>AI Learning Assistant</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <Lightbulb className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  AI Tutor feature coming soon! Get personalized help with concepts, practice problems, and study recommendations.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EngagementFeatures;
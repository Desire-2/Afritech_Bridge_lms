"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Calendar, 
  Clock, 
  BookOpen, 
  ChevronRight, 
  X,
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { StudentService } from '@/services/student.service';
import { Announcement } from '@/types/api';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentAnnouncementsProps {
  className?: string;
  maxItems?: number;
  showHeader?: boolean;
}

const StudentAnnouncements: React.FC<StudentAnnouncementsProps> = ({ 
  className = '',
  maxItems = 5,
  showHeader = true
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await StudentService.getAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const openAnnouncementModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setIsModalOpen(true);
  };

  const closeAnnouncementModal = () => {
    setSelectedAnnouncement(null);
    setIsModalOpen(false);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const isRecent = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 7; // Consider announcements from the last 7 days as recent
  };

  const displayAnnouncements = announcements.slice(0, maxItems);

  return (
    <>
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <span>Announcements</span>
                {announcements.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {announcements.length}
                  </Badge>
                )}
              </div>
              {announcements.length > maxItems && (
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
        )}
        
        <CardContent className={showHeader ? 'pt-0' : ''}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Loading announcements...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-3">{error}</p>
                <Button 
                  onClick={fetchAnnouncements} 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && announcements.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Announcements
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                You don't have any announcements from your courses yet.
              </p>
            </div>
          )}

          {!loading && !error && displayAnnouncements.length > 0 && (
            <div className="space-y-4">
              <AnimatePresence>
                {displayAnnouncements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group cursor-pointer p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => openAnnouncementModal(announcement)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                            {announcement.title}
                          </h3>
                          {isRecent(announcement.created_at) && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                          <div className="flex items-center space-x-1">
                            <BookOpen className="w-3 h-3" />
                            <span className="truncate">{announcement.course_title || 'Course'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{getTimeAgo(announcement.created_at)}</span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {announcement.content.length > 100 
                            ? `${announcement.content.substring(0, 100)}...`
                            : announcement.content
                          }
                        </p>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors ml-2 flex-shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Announcement Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <DialogTitle className="text-xl font-semibold pr-8">
              Announcement Details
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeAnnouncementModal}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {selectedAnnouncement.title}
                  </h2>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4" />
                      <span>Course: <strong>{selectedAnnouncement.course_title || 'Unknown'}</strong></span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Posted: <strong>{new Date(selectedAnnouncement.created_at).toLocaleDateString()}</strong>
                      </span>
                    </div>
                    
                    {selectedAnnouncement.instructor_name && (
                      <div className="flex items-center space-x-2">
                        <span>By: <strong>{selectedAnnouncement.instructor_name}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                {/* Content */}
                <div className="prose dark:prose-invert max-w-none">
                  <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {selectedAnnouncement.content}
                  </div>
                </div>
                
                {selectedAnnouncement.updated_at !== selectedAnnouncement.created_at && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
                    Last updated: {new Date(selectedAnnouncement.updated_at).toLocaleDateString()} at {new Date(selectedAnnouncement.updated_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentAnnouncements;
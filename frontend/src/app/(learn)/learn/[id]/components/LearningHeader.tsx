import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Menu, X, BookOpen, Eye, Timer, Brain, HelpCircle, Bookmark, 
  Share2, Target, Zap, Trophy 
} from 'lucide-react';
import Link from 'next/link';

interface LearningHeaderProps {
  courseTitle: string;
  currentLessonTitle?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  timeSpent: number;
  engagementScore: number;
  currentLessonIndex: number;
  totalLessons: number;
  isBookmarked: boolean;
  focusMode: boolean;
  courseId: number;
  onBookmark: () => void;
  onShare: () => void;
  onToggleFocus: () => void;
  helpDialogOpen: boolean;
  setHelpDialogOpen: (open: boolean) => void;
}

export const LearningHeader: React.FC<LearningHeaderProps> = ({
  courseTitle,
  currentLessonTitle,
  sidebarOpen,
  setSidebarOpen,
  timeSpent,
  engagementScore,
  currentLessonIndex,
  totalLessons,
  isBookmarked,
  focusMode,
  courseId,
  onBookmark,
  onShare,
  onToggleFocus,
  helpDialogOpen,
  setHelpDialogOpen
}) => {
  return (
    <div className="bg-gray-900/95 border-b border-gray-800 shadow-lg sticky top-0 z-40 backdrop-blur-sm">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 hover:bg-blue-900/30 text-gray-300"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg md:text-xl font-bold text-white truncate">
                  {courseTitle}
                </h1>
                {currentLessonTitle && (
                  <p className="hidden sm:flex text-xs sm:text-sm text-gray-300 truncate items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {currentLessonTitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 flex-shrink-0">
            {/* Progress Indicators */}
            <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center space-x-2 px-2 lg:px-3 py-1 bg-blue-900/30 border border-blue-800 rounded-full">
                      <Timer className="h-3 w-3 lg:h-4 lg:w-4 text-blue-400" />
                      <span className="text-xs lg:text-sm font-medium text-blue-300">
                        {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Time spent on this lesson</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center space-x-2 px-2 lg:px-3 py-1 bg-green-900/30 border border-green-800 rounded-full">
                      <Brain className="h-3 w-3 lg:h-4 lg:w-4 text-green-400" />
                      <span className="text-xs lg:text-sm font-medium text-green-300">
                        {Math.round(engagementScore)}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Engagement score</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="hidden lg:flex items-center space-x-2">
                <span className="text-sm text-gray-300">
                  {currentLessonIndex + 1} / {totalLessons}
                </span>
                <Progress 
                  value={(currentLessonIndex + 1) / totalLessons * 100} 
                  className="w-16 lg:w-24 h-2"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={onBookmark}
                      className={`hover:bg-yellow-900/30 p-2 ${isBookmarked ? 'text-yellow-400' : 'text-gray-400'}`}
                    >
                      <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bookmark this lesson</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={onShare}
                      className="hidden sm:flex hover:bg-blue-900/30 text-gray-300 p-2"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share this lesson</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={onToggleFocus}
                      className={`hover:bg-purple-900/30 ${focusMode ? 'text-purple-400' : 'text-gray-300'}`}
                    >
                      <Target className={`h-4 w-4 ${focusMode ? 'text-purple-400' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle focus mode</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Help Dialog */}
              <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-gray-800 text-gray-300">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <Brain className="h-5 w-5 text-blue-600" />
                      <span>Enhanced Learning Interface Guide</span>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                        Automatic Progress Tracking
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li>• Your progress is tracked automatically as you read and interact</li>
                        <li>• Lessons complete automatically when you reach 80% reading progress</li>
                        <li>• Engagement score improves with active reading and interaction</li>
                        <li>• Time spent and scroll progress are saved continuously</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Target className="h-4 w-4 mr-2 text-blue-500" />
                        Focus Features
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li>• Use Focus Mode to hide distractions</li>
                        <li>• Bookmark important lessons for quick access</li>
                        <li>• Take notes that sync with your progress</li>
                        <li>• Share interesting lessons with peers</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Trophy className="h-4 w-4 mr-2 text-purple-500" />
                        Achievement System
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li>• Complete lessons to unlock next modules</li>
                        <li>• Maintain high engagement for bonus points</li>
                        <li>• Earn certificates upon course completion</li>
                        <li>• Track your learning velocity and skills</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button asChild variant="outline" size="sm" className="hover:bg-red-900/30 border-gray-700 text-gray-300">
                <Link href={`/courses/${courseId}`}>Exit Learning</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

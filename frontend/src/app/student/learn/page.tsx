"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Award, 
  Play, 
  Star,
  Target,
  BarChart3,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  progress: number;
  total_lessons: number;
  completed_lessons: number;
  estimated_duration: string;
  last_accessed: string;
  thumbnail_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  enrollment_count: number;
  current_lesson?: {
    id: number;
    title: string;
    type: string;
  };
}

const LearningDashboard = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (!isAuthenticated) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // For now, let's use mock data since we need to fix the API
        const mockCourses: Course[] = [
          {
            id: 1,
            title: "Introduction to Web Development",
            description: "Learn the basics of HTML, CSS, and JavaScript",
            instructor_name: "John Doe",
            progress: 45,
            total_lessons: 20,
            completed_lessons: 9,
            estimated_duration: "8 weeks",
            last_accessed: "2024-10-07T10:00:00Z",
            difficulty: "beginner",
            rating: 4.5,
            enrollment_count: 1250,
            current_lesson: {
              id: 10,
              title: "JavaScript Fundamentals",
              type: "video"
            }
          },
          {
            id: 2,
            title: "Advanced React Development",
            description: "Master React hooks, context, and state management",
            instructor_name: "Jane Smith",
            progress: 20,
            total_lessons: 15,
            completed_lessons: 3,
            estimated_duration: "6 weeks",
            last_accessed: "2024-10-06T14:30:00Z",
            difficulty: "advanced",
            rating: 4.8,
            enrollment_count: 890,
            current_lesson: {
              id: 4,
              title: "React Hooks Deep Dive",
              type: "text"
            }
          }
        ];
        
        setCourses(mockCourses);
      } catch (err: any) {
        console.error('Failed to fetch enrolled courses:', err);
        setError('Failed to load your courses');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolledCourses();
  }, [isAuthenticated]);

  const totalProgress = courses.length > 0 
    ? courses.reduce((sum, course) => sum + course.progress, 0) / courses.length 
    : 0;

  const completedCourses = courses.filter(course => course.progress === 100).length;
  const inProgressCourses = courses.filter(course => course.progress > 0 && course.progress < 100).length;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getLastAccessedText = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access your learning dashboard.</p>
          <Button asChild>
            <Link href="/auth/login">Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your learning journey...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
              <h2 className="text-xl font-semibold">Error</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Learning</h1>
              <p className="text-muted-foreground">
                Continue your educational journey and track your progress
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                  <p className="text-2xl font-bold">{courses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCourses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgressCourses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                  <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Courses Grid */}
        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">
              Start your learning journey by enrolling in a course
            </p>
            <Button asChild>
              <Link href="/student/courses">Browse Courses</Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                    ) : (
                      <BookOpen className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                        {course.difficulty}
                      </Badge>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{course.rating}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {course.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(course.progress)}%</span>
                      </div>
                      <Progress value={course.progress} className="h-2" />
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                        <span>Last: {getLastAccessedText(course.last_accessed)}</span>
                      </div>
                      
                      {course.current_lesson && (
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium mb-1">Continue with:</p>
                          <p className="text-sm text-muted-foreground">{course.current_lesson.title}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Button asChild className="flex-1">
                        <Link href={`/student/learn/${course.id}`}>
                          <Play className="h-4 w-4 mr-2" />
                          Continue Learning
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/student/courses/${course.id}`}>
                          <Target className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LearningDashboard;
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  progress: number;
  total_lessons: number;
  completed_lessons: number;
  estimated_duration: string;
  last_accessed: string;
  thumbnail_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  enrollment_count: number;
  current_lesson?: {
    id: number;
    title: string;
    type: string;
  };
  modules?: ModuleData[];
  suspension_status?: SuspensionStatus;
}

const ModuleCard = ({ 
  moduleData, 
  isLocked, 
  onRetake, 
  onContinue 
}: { 
  moduleData: ModuleData;
  isLocked: boolean;
  onRetake: (moduleId: number) => void;
  onContinue: (moduleId: number) => void;
}) => {
  const { module, progress, can_retake } = moduleData;
  
  // Use progression service for calculations
  const progressionValidation = ProgressionService.validateProgression(progress);
  const retakeEligibility = ProgressionService.checkRetakeEligibility(progress);
  const suspensionRisk = ProgressionService.assessSuspensionRisk(moduleData);
  const formattedScore = ProgressionService.formatScore(progressionValidation.currentScore);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'unlocked': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'locked': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'in_progress': return <Play className="h-5 w-5" />;
      case 'failed': return <XCircle className="h-5 w-5" />;
      case 'unlocked': return <Zap className="h-5 w-5" />;
      case 'locked': return <Lock className="h-5 w-5" />;
      default: return <Lock className="h-5 w-5" />;
    }
  };

  return (
    <Card className={`${isLocked ? 'opacity-60' : ''} hover:shadow-lg transition-shadow duration-200`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2 flex items-center space-x-2">
              {getStatusIcon(progress.status)}
              <span>{module.title}</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className={getStatusColor(progress.status)}>
                {progress.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {suspensionRisk.isAtRisk && (
                <Badge variant="destructive" className={ProgressionService.getRiskColorClass(suspensionRisk.riskLevel)}>
                  {suspensionRisk.riskLevel.toUpperCase()} RISK
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              Attempt {progress.attempts_count}/{progress.max_attempts}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {module.description}
        </p>
        
        {/* Score Breakdown */}
        {progress.status !== 'locked' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Score Breakdown:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(progressionValidation.breakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()} ({value.percentage}%):
                  </span>
                  <span className={value.current < 70 ? 'text-red-600' : 'text-green-600'}>
                    {ProgressionService.formatScore(value.current)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Cumulative Score:</span>
              <span className={`font-bold ${progressionValidation.canProceed ? 'text-green-600' : 'text-red-600'}`}>
                {formattedScore}
              </span>
            </div>
            
            <Progress 
              value={progressionValidation.currentScore} 
              className={`h-2 ${progressionValidation.canProceed ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`}
            />
            
            {!progressionValidation.canProceed && (
              <div className="text-xs text-muted-foreground">
                Need {ProgressionService.formatScore(progressionValidation.missingPoints)} more to proceed
              </div>
            )}
          </div>
        )}
        
        {/* Warnings and Recommendations */}
        {(progressionValidation.warnings.length > 0 || suspensionRisk.isAtRisk) && (
          <div className="space-y-2">
            {progressionValidation.warnings.map((warning, index) => (
              <Alert key={index} className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{warning}</AlertDescription>
              </Alert>
            ))}
            
            {suspensionRisk.isAtRisk && (
              <Alert className={`py-2 ${ProgressionService.getRiskColorClass(suspensionRisk.riskLevel)}`}>
                <Ban className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <div className="font-medium mb-1">Suspension Risk: {suspensionRisk.riskLevel.toUpperCase()}</div>
                  <ul className="text-xs space-y-1">
                    {suspensionRisk.reasons.map((reason, idx) => (
                      <li key={idx}>• {reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          {progress.status === 'locked' && (
            <Button disabled className="flex-1">
              <Lock className="h-4 w-4 mr-2" />
              Locked
            </Button>
          )}
          
          {(progress.status === 'unlocked' || progress.status === 'in_progress') && (
            <Button 
              className="flex-1"
              onClick={() => onContinue(module.id)}
            >
              <Play className="h-4 w-4 mr-2" />
              {progress.status === 'unlocked' ? 'Start Module' : 'Continue'}
            </Button>
          )}
          
          {progress.status === 'completed' && (
            <Button variant="outline" className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed ({formattedScore})
            </Button>
          )}
          
          {progress.status === 'failed' && retakeEligibility.canRetake && (
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => onRetake(module.id)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake ({retakeEligibility.remainingAttempts} left)
            </Button>
          )}
          
          {progress.status === 'failed' && !retakeEligibility.canRetake && (
            <Button disabled variant="destructive" className="flex-1">
              <Ban className="h-4 w-4 mr-2" />
              No Retakes Left
            </Button>
          )}
        </div>
        
        {/* Recommendations */}
        {progressionValidation.recommendations.length > 0 && progress.status !== 'completed' && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-xs font-medium mb-2 text-blue-800 dark:text-blue-200">
              Recommendations:
            </div>
            <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
              {progressionValidation.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SuspensionAlert = ({ 
  suspensionStatus, 
  onSubmitAppeal 
}: { 
  suspensionStatus: SuspensionStatus;
  onSubmitAppeal: (appealText: string) => void;
}) => {
  const [appealText, setAppealText] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);

  if (!suspensionStatus.is_suspended || !suspensionStatus.suspension_details) {
    return null;
  }

  const details = suspensionStatus.suspension_details;

  return (
    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <Ban className="h-4 w-4" />
      <AlertTitle className="text-red-800 dark:text-red-200">Course Suspension</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="text-red-700 dark:text-red-300">
          You have been suspended from this course due to: {details.reason}
        </div>
        
        <div className="text-sm space-y-1">
          <div>Failed Module: {details.failed_module_title}</div>
          <div>Suspension Date: {new Date(details.suspended_at).toLocaleDateString()}</div>
          <div>Total Attempts Made: {details.total_attempts_made}</div>
        </div>
        
        {details.can_submit_appeal && !details.appeal_submitted && (
          <div className="space-y-2">
            <div className="text-sm">
              Appeal Deadline: {details.appeal_deadline ? new Date(details.appeal_deadline).toLocaleDateString() : 'N/A'}
            </div>
            {!showAppealForm ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAppealForm(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit Appeal
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Explain why you believe the suspension should be reversed..."
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex space-x-2">
                  <Button 
                    size="sm"
                    onClick={() => {
                      onSubmitAppeal(appealText);
                      setShowAppealForm(false);
                      setAppealText('');
                    }}
                    disabled={!appealText.trim()}
                  >
                    Submit Appeal
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAppealForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {details.appeal_submitted && (
          <div className="space-y-1 text-sm">
            <div className="font-medium">Appeal Status: {details.review_status.toUpperCase()}</div>
            <div>Submitted: {details.appeal_submitted_at ? new Date(details.appeal_submitted_at).toLocaleDateString() : 'N/A'}</div>
            {details.review_status === 'pending' && (
              <div className="text-yellow-600 dark:text-yellow-400">
                Your appeal is under review. You will be notified of the decision.
              </div>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

const LearningDashboard = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title'>('recent');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showModuleView, setShowModuleView] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      const response = await StudentApiService.getEnrolledCourses();
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Failed to fetch enrolled courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseModules = async (courseId: number) => {
    try {
      const response = await StudentApiService.getCourseModules(courseId);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch course modules:', error);
      return null;
    }
  };

  const handleViewModules = async (course: Course) => {
    try {
      setLoading(true);
      const moduleData = await fetchCourseModules(course.id);
      if (moduleData) {
        setSelectedCourse({
          ...course,
          modules: moduleData.modules,
          suspension_status: moduleData.suspension_status
        });
        setShowModuleView(true);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetakeModule = async (moduleId: number) => {
    try {
      const response = await StudentApiService.retakeModule(moduleId);
      if (response.success) {
        // Refresh module data
        if (selectedCourse) {
          await handleViewModules(selectedCourse);
        }
      } else {
        alert(response.error || 'Failed to initiate retake');
      }
    } catch (error) {
      console.error('Failed to retake module:', error);
      alert('Failed to initiate retake');
    }
  };

  const handleContinueModule = (moduleId: number) => {
    if (selectedCourse) {
      window.location.href = `/student/learn/${selectedCourse.id}?module=${moduleId}`;
    }
  };

  const handleSubmitAppeal = async (appealText: string) => {
    if (!selectedCourse) return;
    
    try {
      const response = await StudentApiService.submitSuspensionAppeal(selectedCourse.id, appealText);
      if (response.success) {
        alert('Appeal submitted successfully');
        // Refresh the course data
        await handleViewModules(selectedCourse);
      } else {
        alert(response.error || 'Failed to submit appeal');
      }
    } catch (error) {
      console.error('Failed to submit appeal:', error);
      alert('Failed to submit appeal');
    }
  };

  const filteredAndSortedCourses = courses
    .filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'in-progress' && course.progress > 0 && course.progress < 100) ||
        (filterStatus === 'completed' && course.progress === 100);
      
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();
        case 'progress':
          return b.progress - a.progress;
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const totalProgress = courses.length > 0 
    ? courses.reduce((sum, course) => sum + course.progress, 0) / courses.length 
    : 0;

  const completedCourses = courses.filter(course => course.progress === 100).length;
  const inProgressCourses = courses.filter(course => course.progress > 0 && course.progress < 100).length;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getLastAccessedText = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading your learning journey...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Learning</h1>
              <p className="text-muted-foreground">
                Continue your educational journey and track your progress
              </p>
            </div>
            {showModuleView && selectedCourse && (
              <Button 
                variant="outline"
                onClick={() => setShowModuleView(false)}
              >
                ← Back to Courses
              </Button>
            )}
          </div>
        </motion.div>

        {showModuleView && selectedCourse ? (
          /* Module View */
          <div className="space-y-6">
            {/* Course Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{selectedCourse.title}</CardTitle>
                    <p className="text-muted-foreground mb-4">{selectedCourse.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span>Instructor: {selectedCourse.instructor_name}</span>
                      <Badge variant="secondary" className={getDifficultyColor(selectedCourse.difficulty)}>
                        {selectedCourse.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{Math.round(selectedCourse.progress)}%</div>
                    <div className="text-sm text-muted-foreground">Overall Progress</div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Suspension Alert */}
            {selectedCourse.suspension_status && (
              <SuspensionAlert 
                suspensionStatus={selectedCourse.suspension_status}
                onSubmitAppeal={handleSubmitAppeal}
              />
            )}

            {/* Modules Grid */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Course Modules</h2>
              
              {/* Overall Progress Summary */}
              {selectedCourse.modules && selectedCourse.modules.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Course Progress Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const progressSummary = ProgressionService.calculateCourseProgress(selectedCourse.modules);
                      const nextModule = ProgressionService.getNextUnlockableModule(selectedCourse.modules);
                      
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Overall Progress</div>
                            <div className="text-2xl font-bold">{Math.round(progressSummary.overallProgress)}%</div>
                            <Progress value={progressSummary.overallProgress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {progressSummary.completedModules}/{progressSummary.totalModules} modules completed
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Average Score</div>
                            <div className="text-2xl font-bold">
                              {ProgressionService.formatScore(progressSummary.averageScore)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              From completed modules
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Next Module</div>
                            <div className="text-lg font-medium">
                              {nextModule ? nextModule.module.title : 'All modules unlocked'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {nextModule ? 'Available to unlock' : 'Course progression complete'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedCourse.modules?.map((moduleData, index) => (
                  <ModuleCard
                    key={moduleData.module.id}
                    moduleData={moduleData}
                    isLocked={moduleData.progress.status === 'locked'}
                    onRetake={handleRetakeModule}
                    onContinue={handleContinueModule}
                  />
                ))}
              </div>
            </div>

            {/* Module Progression Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Progression Requirements</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Score Breakdown (80% required to proceed):</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Course Contribution: 10% (lesson completion, participation)</li>
                      <li>• Quizzes: 30% (knowledge checks throughout module)</li>
                      <li>• Assignments: 40% (hands-on projects and exercises)</li>
                      <li>• Final Assessment: 20% (comprehensive module evaluation)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Retake Policy:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Maximum 3 attempts per module</li>
                      <li>• Failed attempts reset all module content</li>
                      <li>• Final failure results in course suspension</li>
                      <li>• 30-day appeal window for suspensions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Course List View */
          <>
            {/* Stats Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                      <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                      <p className="text-2xl font-bold">{courses.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                      <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{completedCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                      <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold">{inProgressCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                      <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Progress</p>
                      <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Filters and Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col md:flex-row gap-4 mb-6"
            >
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recent</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Courses Grid/List */}
            {filteredAndSortedCourses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'Try adjusting your search terms' : 'Start your learning journey by enrolling in a course'}
                </p>
                <Button asChild>
                  <Link href="/student/courses">Browse Courses</Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {filteredAndSortedCourses.map((course, index) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    {viewMode === 'grid' ? (
                      <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">
                        <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="w-full h-full object-cover rounded-t-lg"
                            />
                          ) : (
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                              {course.difficulty}
                            </Badge>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{course.rating}</span>
                            </div>
                          </div>
                          
                          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                            {course.title}
                          </h3>
                          
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {course.description}
                          </p>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{Math.round(course.progress)}%</span>
                            </div>
                            <Progress value={course.progress} className="h-2" />
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                              <span>Last: {getLastAccessedText(course.last_accessed)}</span>
                            </div>
                            
                            {course.current_lesson && (
                              <div className="pt-2 border-t">
                                <p className="text-sm font-medium mb-1">Continue with:</p>
                                <p className="text-sm text-muted-foreground">{course.current_lesson.title}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-2 mt-4">
                            <Button 
                              onClick={() => handleViewModules(course)}
                              className="flex-1"
                            >
                              <Target className="h-4 w-4 mr-2" />
                              View Modules
                            </Button>
                            <Button asChild variant="outline">
                              <Link href={`/student/learn/${course.id}`}>
                                <Play className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="hover:shadow-md transition-shadow duration-200">
                        <CardContent className="p-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                              {course.thumbnail_url ? (
                                <img
                                  src={course.thumbnail_url}
                                  alt={course.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <BookOpen className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-lg mb-1">{course.title}</h3>
                                  <p className="text-sm text-muted-foreground">by {course.instructor_name}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                                    {course.difficulty}
                                  </Badge>
                                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span>{course.rating}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-6 mb-3">
                                <div className="flex items-center space-x-2">
                                  <Progress value={course.progress} className="w-32 h-2" />
                                  <span className="text-sm font-medium">{Math.round(course.progress)}%</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {course.completed_lessons}/{course.total_lessons} lessons
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Last: {getLastAccessedText(course.last_accessed)}
                                </span>
                              </div>
                              
                              {course.current_lesson && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  Next: {course.current_lesson.title}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button 
                                onClick={() => handleViewModules(course)}
                              >
                                <Target className="h-4 w-4 mr-2" />
                                Modules
                              </Button>
                              <Button asChild variant="outline">
                                <Link href={`/student/learn/${course.id}`}>
                                  <Play className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LearningDashboard;
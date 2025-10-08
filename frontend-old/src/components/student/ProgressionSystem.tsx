"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Trophy,
  Target,
  BarChart3,
  Clock,
  Users,
  MessageSquare,
  BookOpen,
  FileText,
  Star,
  TrendingUp,
  AlertCircle,
  PlayCircle,
  Pause,
  ArrowRight,
  Award,
  Flame
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ModuleProgressData {
  id: string;
  title: string;
  description: string;
  order: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'failed';
  
  // Score breakdown (80% total required to pass)
  course_contribution_score: number; // 10% - forums, help, tracking
  quiz_score: number; // 30% - knowledge checks
  assignment_score: number; // 40% - hands-on work
  final_assessment_score: number; // 20% - module assessment
  
  cumulative_score: number; // Total weighted score
  attempts_count: number;
  max_attempts: number;
  
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  unlocked_at?: string;
  
  lessons_total: number;
  lessons_completed: number;
  assignments_total: number;
  assignments_completed: number;
  quizzes_total: number;
  quizzes_completed: number;
  
  prerequisites_met: boolean;
  can_retake: boolean;
  next_module_id?: string;
}

interface ProgressionSystemProps {
  courseId: string;
  enrollmentId: string;
}

const ScoreBreakdownCard: React.FC<{ 
  title: string; 
  score: number; 
  maxScore: number; 
  weight: number; 
  color: string;
  icon: React.ReactNode;
  description: string;
}> = ({ title, score, maxScore, weight, color, icon, description }) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const weightedScore = (percentage * weight) / 100;

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${color}`}>
              {icon}
            </div>
            <div>
              <h4 className="font-medium text-sm">{title}</h4>
              <p className="text-xs text-muted-foreground">{weight}% of total</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{weightedScore.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/{weight}</div>
          </div>
        </div>
        
        <Progress value={percentage} className="h-2 mb-2" />
        
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{score.toFixed(1)}/{maxScore}</span>
          <span>{percentage.toFixed(1)}%</span>
        </div>
        
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const ModuleCard: React.FC<{
  module: ModuleProgressData;
  onStartModule: (moduleId: string) => void;
  onRetakeModule: (moduleId: string) => void;
  onViewDetails: (moduleId: string) => void;
}> = ({ module, onStartModule, onRetakeModule, onViewDetails }) => {
  const getStatusIcon = () => {
    switch (module.status) {
      case 'locked':
        return <Lock className="h-5 w-5 text-gray-400" />;
      case 'unlocked':
        return <Unlock className="h-5 w-5 text-blue-500" />;
      case 'in_progress':
        return <PlayCircle className="h-5 w-5 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Lock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (module.status) {
      case 'locked':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Locked</Badge>;
      case 'unlocked':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-600">Ready</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-600">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getActionButton = () => {
    if (module.status === 'locked') {
      return (
        <Button disabled variant="outline" className="w-full">
          <Lock className="h-4 w-4 mr-2" />
          Locked
        </Button>
      );
    }

    if (module.status === 'unlocked') {
      return (
        <Button onClick={() => onStartModule(module.id)} className="w-full">
          <PlayCircle className="h-4 w-4 mr-2" />
          Start Module
        </Button>
      );
    }

    if (module.status === 'in_progress') {
      return (
        <Button onClick={() => onViewDetails(module.id)} className="w-full">
          <ArrowRight className="h-4 w-4 mr-2" />
          Continue
        </Button>
      );
    }

    if (module.status === 'completed') {
      return (
        <Button onClick={() => onViewDetails(module.id)} variant="outline" className="w-full">
          <Trophy className="h-4 w-4 mr-2" />
          Review
        </Button>
      );
    }

    if (module.status === 'failed' && module.can_retake) {
      return (
        <Button onClick={() => onRetakeModule(module.id)} variant="destructive" className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          Retake ({module.max_attempts - module.attempts_count} left)
        </Button>
      );
    }

    return (
      <Button disabled variant="outline" className="w-full">
        <XCircle className="h-4 w-4 mr-2" />
        No Retakes Left
      </Button>
    );
  };

  const isPassing = module.cumulative_score >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`h-full transition-all duration-300 ${
        module.status === 'completed' ? 'border-green-200 bg-green-50/50' :
        module.status === 'failed' ? 'border-red-200 bg-red-50/50' :
        module.status === 'in_progress' ? 'border-orange-200 bg-orange-50/50' :
        module.status === 'unlocked' ? 'border-blue-200 bg-blue-50/50' :
        'border-gray-200'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Module {module.order}</p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {module.description}
          </p>

          {/* Progress Overview */}
          {(module.status === 'in_progress' || module.status === 'completed' || module.status === 'failed') && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Overall Score</span>
                <span className={`font-medium ${
                  isPassing ? 'text-green-600' : 'text-red-600'
                }`}>
                  {module.cumulative_score.toFixed(1)}% / 80%
                </span>
              </div>
              <Progress 
                value={module.cumulative_score} 
                className="h-2"
                max={100}
              />
              
              {/* Mini score breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Contribution:</span>
                  <span>{((module.course_contribution_score * 0.10)).toFixed(1)}/10</span>
                </div>
                <div className="flex justify-between">
                  <span>Quizzes:</span>
                  <span>{((module.quiz_score * 0.30)).toFixed(1)}/30</span>
                </div>
                <div className="flex justify-between">
                  <span>Assignments:</span>
                  <span>{((module.assignment_score * 0.40)).toFixed(1)}/40</span>
                </div>
                <div className="flex justify-between">
                  <span>Assessment:</span>
                  <span>{((module.final_assessment_score * 0.20)).toFixed(1)}/20</span>
                </div>
              </div>
            </div>
          )}

          {/* Content Progress */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-medium">{module.lessons_completed}/{module.lessons_total}</div>
              <div className="text-xs text-muted-foreground">Lessons</div>
            </div>
            <div>
              <div className="text-sm font-medium">{module.quizzes_completed}/{module.quizzes_total}</div>
              <div className="text-xs text-muted-foreground">Quizzes</div>
            </div>
            <div>
              <div className="text-sm font-medium">{module.assignments_completed}/{module.assignments_total}</div>
              <div className="text-xs text-muted-foreground">Assignments</div>
            </div>
          </div>

          {/* Attempt Warning */}
          {module.status === 'failed' && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                Failed attempt {module.attempts_count}/{module.max_attempts}. 
                {module.can_retake ? ` ${module.max_attempts - module.attempts_count} retakes remaining.` : ' No retakes left.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Prerequisites Check */}
          {module.status === 'locked' && !module.prerequisites_met && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                Complete previous modules with 80% score to unlock.
              </AlertDescription>
            </Alert>
          )}

          {getActionButton()}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ProgressionSystem: React.FC<ProgressionSystemProps> = ({ courseId, enrollmentId }) => {
  const [modules, setModules] = useState<ModuleProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<ModuleProgressData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { user } = useAuth();

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchModuleProgress = async () => {
      setLoading(true);
      try {
        // Simulated API call
        const mockModules: ModuleProgressData[] = [
          {
            id: '1',
            title: 'Introduction to Web Development',
            description: 'Learn the basics of HTML, CSS, and web development fundamentals.',
            order: 1,
            status: 'completed',
            course_contribution_score: 85, // Out of 100
            quiz_score: 90,
            assignment_score: 88,
            final_assessment_score: 92,
            cumulative_score: 88.5, // Weighted average
            attempts_count: 1,
            max_attempts: 3,
            completed_at: '2024-01-15T10:30:00Z',
            unlocked_at: '2024-01-01T09:00:00Z',
            lessons_total: 8,
            lessons_completed: 8,
            assignments_total: 3,
            assignments_completed: 3,
            quizzes_total: 5,
            quizzes_completed: 5,
            prerequisites_met: true,
            can_retake: true,
            next_module_id: '2'
          },
          {
            id: '2',
            title: 'JavaScript Fundamentals',
            description: 'Master JavaScript syntax, variables, functions, and basic programming concepts.',
            order: 2,
            status: 'in_progress',
            course_contribution_score: 78,
            quiz_score: 75,
            assignment_score: 82,
            final_assessment_score: 0, // Not taken yet
            cumulative_score: 62.8, // Below passing
            attempts_count: 1,
            max_attempts: 3,
            started_at: '2024-01-16T09:00:00Z',
            unlocked_at: '2024-01-15T10:30:00Z',
            lessons_total: 12,
            lessons_completed: 8,
            assignments_total: 4,
            assignments_completed: 2,
            quizzes_total: 6,
            quizzes_completed: 4,
            prerequisites_met: true,
            can_retake: true,
            next_module_id: '3'
          },
          {
            id: '3',
            title: 'DOM Manipulation & Events',
            description: 'Learn to interact with web pages using JavaScript DOM manipulation and event handling.',
            order: 3,
            status: 'locked',
            course_contribution_score: 0,
            quiz_score: 0,
            assignment_score: 0,
            final_assessment_score: 0,
            cumulative_score: 0,
            attempts_count: 0,
            max_attempts: 3,
            lessons_total: 10,
            lessons_completed: 0,
            assignments_total: 3,
            assignments_completed: 0,
            quizzes_total: 4,
            quizzes_completed: 0,
            prerequisites_met: false, // Current module not passed yet
            can_retake: true,
            next_module_id: '4'
          },
          {
            id: '4',
            title: 'Asynchronous JavaScript',
            description: 'Understand promises, async/await, and handling asynchronous operations.',
            order: 4,
            status: 'locked',
            course_contribution_score: 0,
            quiz_score: 0,
            assignment_score: 0,
            final_assessment_score: 0,
            cumulative_score: 0,
            attempts_count: 0,
            max_attempts: 3,
            lessons_total: 8,
            lessons_completed: 0,
            assignments_total: 2,
            assignments_completed: 0,
            quizzes_total: 3,
            quizzes_completed: 0,
            prerequisites_met: false,
            can_retake: true,
            next_module_id: '5'
          }
        ];

        setModules(mockModules);
      } catch (error) {
        console.error('Failed to fetch module progress:', error);
        toast.error('Failed to load module progress');
      } finally {
        setLoading(false);
      }
    };

    fetchModuleProgress();
  }, [courseId, enrollmentId]);

  const handleStartModule = async (moduleId: string) => {
    try {
      // API call to start module
      console.log('Starting module:', moduleId);
      toast.success('Module started! Good luck with your learning.');
      
      // Update local state
      setModules(prev => 
        prev.map(module => 
          module.id === moduleId 
            ? { ...module, status: 'in_progress', started_at: new Date().toISOString() }
            : module
        )
      );
    } catch (error) {
      console.error('Failed to start module:', error);
      toast.error('Failed to start module');
    }
  };

  const handleRetakeModule = async (moduleId: string) => {
    try {
      // API call to retake module
      console.log('Retaking module:', moduleId);
      toast.success('Module reset for retake. All progress will restart.');
      
      // Reset module progress
      setModules(prev => 
        prev.map(module => 
          module.id === moduleId 
            ? { 
                ...module, 
                status: 'in_progress',
                course_contribution_score: 0,
                quiz_score: 0,
                assignment_score: 0,
                final_assessment_score: 0,
                cumulative_score: 0,
                attempts_count: module.attempts_count + 1,
                lessons_completed: 0,
                assignments_completed: 0,
                quizzes_completed: 0,
                started_at: new Date().toISOString()
              }
            : module
        )
      );
    } catch (error) {
      console.error('Failed to retake module:', error);
      toast.error('Failed to retake module');
    }
  };

  const handleViewDetails = (moduleId: string) => {
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      setSelectedModule(module);
      setDetailsDialogOpen(true);
    }
  };

  const overallProgress = modules.length > 0 
    ? (modules.filter(m => m.status === 'completed').length / modules.length) * 100 
    : 0;

  const completedModules = modules.filter(m => m.status === 'completed').length;
  const failedModules = modules.filter(m => m.status === 'failed').length;
  const inProgressModules = modules.filter(m => m.status === 'in_progress').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Progress</h1>
          <p className="text-muted-foreground">
            Complete each module with 80% or higher to proceed
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="bg-blue-50 text-blue-800">
            <Target className="h-4 w-4 mr-1" />
            80% Required
          </Badge>
          <Badge variant="outline" className="bg-orange-50 text-orange-800">
            <RotateCcw className="h-4 w-4 mr-1" />
            3 Attempts Max
          </Badge>
        </div>
      </div>

      {/* Overall Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Course Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completedModules}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{inProgressModules}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{failedModules}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{modules.length - completedModules - inProgressModules - failedModules}</div>
              <div className="text-sm text-muted-foreground">Locked</div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span className="font-medium">{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onStartModule={handleStartModule}
              onRetakeModule={handleRetakeModule}
              onViewDetails={handleViewDetails}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Module Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>{selectedModule?.title} - Score Breakdown</span>
            </DialogTitle>
            <DialogDescription>
              Detailed scoring breakdown for this module
            </DialogDescription>
          </DialogHeader>

          {selectedModule && (
            <div className="space-y-6">
              {/* Overall Score */}
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${
                      selectedModule.cumulative_score >= 80 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedModule.cumulative_score.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground">
                      {selectedModule.cumulative_score >= 80 ? 'Passing Grade' : 'Below Passing Grade'}
                    </div>
                    <Progress 
                      value={selectedModule.cumulative_score} 
                      className="h-3 mt-4"
                      max={100}
                    />
                    <div className="text-sm text-muted-foreground mt-2">
                      80% required to pass
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Score Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ScoreBreakdownCard
                  title="Course Contribution"
                  score={selectedModule.course_contribution_score}
                  maxScore={100}
                  weight={10}
                  color="bg-blue-100"
                  icon={<Users className="h-4 w-4 text-blue-600" />}
                  description="Forum participation, peer help, completion tracking"
                />
                
                <ScoreBreakdownCard
                  title="Quizzes"
                  score={selectedModule.quiz_score}
                  maxScore={100}
                  weight={30}
                  color="bg-green-100"
                  icon={<FileText className="h-4 w-4 text-green-600" />}
                  description="Knowledge checks, multiple attempts with best score"
                />
                
                <ScoreBreakdownCard
                  title="Assignments & Projects"
                  score={selectedModule.assignment_score}
                  maxScore={100}
                  weight={40}
                  color="bg-purple-100"
                  icon={<BookOpen className="h-4 w-4 text-purple-600" />}
                  description="Hands-on practical work and real-world projects"
                />
                
                <ScoreBreakdownCard
                  title="Final Assessment"
                  score={selectedModule.final_assessment_score}
                  maxScore={100}
                  weight={20}
                  color="bg-orange-100"
                  icon={<Award className="h-4 w-4 text-orange-600" />}
                  description="Comprehensive module assessment"
                />
              </div>

              {/* Attempt History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Attempt History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Attempt</div>
                      <div className="font-medium">{selectedModule.attempts_count} of {selectedModule.max_attempts}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Retakes Remaining</div>
                      <div className="font-medium">{selectedModule.max_attempts - selectedModule.attempts_count}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="font-medium capitalize">{selectedModule.status.replace('_', ' ')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProgressionSystem;
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, XCircle, Clock, Lock, Sparkles, Target, BookOpen, Award } from 'lucide-react';
import { EnhancedModuleUnlockService } from '@/services/enhancedModuleUnlockService';
import { cn } from '@/lib/utils';

interface ModuleUnlockErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetModuleId: number; // The module we're trying to unlock
  errorInfo: {
    mainError: string;
    failedLessons: Array<{
      id: number;
      title: string;
      order: number;
      requirements: string[];
      lessonScore: number;
    }>;
    previousModule?: {
      id: number;
      title: string;
      order: number;
    };
    validationErrors: string[];
    lessonsChecked: number;
    lessonsPassed: number;
    moduleScore: number;
    actionRequired: string;
  };
}

export const ModuleUnlockErrorDialog: React.FC<ModuleUnlockErrorDialogProps> = ({
  open,
  onOpenChange,
  targetModuleId,
  errorInfo,
}) => {
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch eligibility data when dialog opens
  useEffect(() => {
    const fetchEligibility = async () => {
      if (!open || !targetModuleId) return;
      
      try {
        setLoading(true);
        console.log('📊 Fetching eligibility for target module:', targetModuleId);
        const elig = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(targetModuleId);
        console.log('📊 Eligibility data received:', elig);
        setEligibility(elig);
      } catch (error) {
        console.error('❌ Failed to fetch eligibility:', error);
        setEligibility(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEligibility();
  }, [open, targetModuleId]);

  // Calculate display values from eligibility data
  const displayData = React.useMemo(() => {
    if (!eligibility) {
      return {
        completionPercentage: 0,
        totalLessons: errorInfo.failedLessons.length,
        passedLessons: 0,
        remainingLessons: errorInfo.failedLessons.length,
        moduleScore: errorInfo.moduleScore || 0,
        requiredScore: 80,
        previousModule: errorInfo.previousModule,
        recommendations: [],
        lessonRequirements: null
      };
    }

    const lessonReq = eligibility.lesson_requirements || {};
    const totalLessons = lessonReq.total_count || 0;
    const passedLessons = lessonReq.passed_count || 0;
    const remainingLessons = totalLessons - passedLessons;
    const completionPercentage = totalLessons > 0 ? (passedLessons / totalLessons) * 100 : 0;

    return {
      completionPercentage,
      totalLessons,
      passedLessons,
      remainingLessons,
      moduleScore: eligibility.total_score || 0,
      requiredScore: eligibility.required_score || 80,
      previousModule: eligibility.previous_module || errorInfo.previousModule,
      recommendations: eligibility.recommendations || [],
      lessonRequirements: lessonReq
    };
  }, [eligibility, errorInfo]);

  console.log('🎨 Display data calculated:', displayData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-red-50 via-white to-orange-50">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <Lock className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
                Module Locked
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                  Action Required
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-red-700 font-medium mt-1">
                {errorInfo.mainError}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {/* Previous Module Context */}
          {displayData.previousModule && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span>
                Complete <span className="font-semibold">{displayData.previousModule.title}</span> to unlock this module
              </span>
            </div>
          )}

          {/* Creative Progress Overview - Using Eligibility Data */}
          <div className="relative p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10">
              <Sparkles className="h-32 w-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  <span className="font-semibold">
                    {displayData.previousModule ? `${displayData.previousModule.title}` : 'Module Progress'}
                  </span>
                </div>
                <div className="text-right">
                  {loading ? (
                    <div className="text-sm">Loading...</div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{displayData.completionPercentage.toFixed(0)}%</div>
                      <div className="text-xs text-blue-100">Lessons Complete</div>
                    </>
                  )}
                </div>
              </div>
              
              <Progress 
                value={displayData.completionPercentage} 
                className="h-3 bg-white/20"
              />
              
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{displayData.passedLessons} / {displayData.totalLessons} Lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  <span>{displayData.remainingLessons} Remaining</span>
                </div>
              </div>
              
              {/* Module Score */}
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    <span className="text-sm">Module Score</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{displayData.moduleScore.toFixed(1)}%</div>
                    <div className="text-xs text-blue-100">Need {displayData.requiredScore}%</div>
                  </div>
                </div>
                <Progress 
                  value={Math.min(100, displayData.moduleScore)} 
                  className="h-2 bg-white/20 mt-2"
                />
              </div>
            </div>
          </div>

          {/* Recommendations from Eligibility */}
          {displayData.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-100 to-yellow-100 border-l-4 border-amber-500 rounded-r-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 text-lg">
                    Next Steps
                  </h3>
                  <p className="text-sm text-amber-700">
                    Complete these tasks to unlock the next module
                  </p>
                </div>
              </div>

              <div className="bg-white border border-amber-200 rounded-xl p-4">
                <ul className="space-y-2">
                  {displayData.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                      <div className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                        <span className="text-xs font-bold text-amber-700">{idx + 1}</span>
                      </div>
                      <span className="leading-tight">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Incomplete Lessons Checklist */}
          {errorInfo.failedLessons.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-100 to-orange-100 border-l-4 border-red-500 rounded-r-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 animate-pulse" />
                <div className="flex-1">\n                  <h3 className="font-bold text-red-900 text-lg">
                    Complete These Lessons to Unlock
                  </h3>
                  <p className="text-sm text-red-700">
                    {errorInfo.failedLessons.length} lesson{errorInfo.failedLessons.length !== 1 ? 's' : ''} need{errorInfo.failedLessons.length === 1 ? 's' : ''} your attention
                  </p>
                </div>
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {errorInfo.failedLessons.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {errorInfo.failedLessons.map((lesson, idx) => {
                  const categorized = EnhancedModuleUnlockService.categorizeRequirements(lesson.requirements);
                  const totalRequirements = lesson.requirements.length;
                  const lessonProgress = (lesson.lessonScore / 80) * 100;
                  
                  return (
                    <div
                      key={idx}
                      className="group relative p-5 bg-white border-2 border-red-200 hover:border-red-300 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      {/* Lesson Header with Animated Icon */}
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="relative w-12 h-12 bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform">
                            {idx + 1}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                              <XCircle className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="font-bold text-gray-900 text-base leading-tight">
                              {lesson.title}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "flex-shrink-0 font-mono text-sm px-2 py-1",
                                lesson.lessonScore >= 80 
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : lesson.lessonScore >= 60
                                  ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                              )}
                            >
                              {lesson.lessonScore.toFixed(0)}% / 80%
                            </Badge>
                          </div>

                          {/* Progress Bar for Lesson */}
                          <div className="mb-3">
                            <Progress 
                              value={lessonProgress} 
                              className="h-2"
                            />
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                              <span>Lesson Progress</span>
                              <span>{lessonProgress.toFixed(0)}%</span>
                            </div>
                          </div>

                          {/* Requirements Checklist */}
                          <div className="space-y-2 bg-gradient-to-r from-red-50 to-orange-50 p-3 rounded-lg border border-red-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">
                                📋 To-Do Checklist
                              </span>
                              <span className="text-xs text-red-700 font-medium">
                                {totalRequirements} item{totalRequirements !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Quiz Requirements */}
                            {categorized.quizzes.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-purple-100 rounded flex items-center justify-center">
                                    📝
                                  </div>
                                  <span>Quiz Tasks</span>
                                </div>
                                {categorized.quizzes.map((req, i) => (
                                  <div key={i} className="flex items-start gap-2 ml-6 text-sm">
                                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 border-2 border-red-400 rounded"></div>
                                    <span className="text-gray-700 leading-tight">{req}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Assignment Requirements */}
                            {categorized.assignments.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                                    📋
                                  </div>
                                  <span>Assignment Tasks</span>
                                </div>
                                {categorized.assignments.map((req, i) => (
                                  <div key={i} className="flex items-start gap-2 ml-6 text-sm">
                                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 border-2 border-red-400 rounded"></div>
                                    <span className="text-gray-700 leading-tight">{req}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reading Requirements */}
                            {categorized.reading.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center">
                                    📖
                                  </div>
                                  <span>Reading Tasks</span>
                                </div>
                                {categorized.reading.map((req, i) => (
                                  <div key={i} className="flex items-start gap-2 ml-6 text-sm">
                                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 border-2 border-red-400 rounded"></div>
                                    <span className="text-gray-700 leading-tight">{req}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Score Requirements */}
                            {categorized.scores.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-orange-800 flex items-center gap-1.5">
                                  <div className="w-5 h-5 bg-orange-100 rounded flex items-center justify-center">
                                    📊
                                  </div>
                                  <span>Score Goals</span>
                                </div>
                                {categorized.scores.map((req, i) => (
                                  <div key={i} className="flex items-start gap-2 ml-6 text-sm">
                                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 border-2 border-red-400 rounded"></div>
                                    <span className="text-gray-700 leading-tight">{req}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Other Requirements */}
                            {categorized.other.length > 0 && (
                              <div className="space-y-1.5">
                                {categorized.other.map((req, i) => (
                                  <div key={i} className="flex items-start gap-2 ml-3 text-sm">
                                    <div className="flex-shrink-0 w-4 h-4 mt-0.5 border-2 border-red-400 rounded"></div>
                                    <span className="text-gray-700 leading-tight">{req}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivational Tip */}
          {displayData.previousModule && (
            <div className="relative p-4 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-2 border-amber-300 rounded-xl overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10">
                <Sparkles className="h-24 w-24 text-amber-600" />
              </div>
              <div className="relative z-10 flex items-start gap-3">
                <div className="flex-shrink-0 text-3xl">💡</div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900 mb-1">Pro Tip</h4>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Focus on completing <span className="font-semibold">Module {displayData.previousModule.order}: "{displayData.previousModule.title}"</span> first. 
                    Once you finish all required tasks, the next module will automatically unlock!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t-2 border-gray-200">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Complete tasks to unlock and continue your learning journey</span>
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="min-w-[120px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
            >
              Got It!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModuleUnlockErrorDialog;

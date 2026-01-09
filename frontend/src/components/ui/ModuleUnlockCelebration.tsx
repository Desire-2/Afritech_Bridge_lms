import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Star, 
  Sparkles, 
  ChevronRight, 
  Award,
  GraduationCap,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface ModuleUnlockCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  celebrationType: 'module_unlock' | 'course_completion' | 'achievement';
  celebrationMessage: string;
  celebrationSubtext: string;
  nextAction: string;
  completedModule?: {
    title: string;
    score: number;
    order: number;
  };
  nextModule?: {
    title: string;
    order: number;
  };
  courseCompletion?: {
    overallScore: number;
    totalModules: number;
    completionDate: string;
  };
  onContinue: () => void;
  onViewCertificate?: () => void;
}

export const ModuleUnlockCelebration: React.FC<ModuleUnlockCelebrationProps> = ({
  isOpen,
  onClose,
  celebrationType,
  celebrationMessage,
  celebrationSubtext,
  nextAction,
  completedModule,
  nextModule,
  courseCompletion,
  onContinue,
  onViewCertificate
}) => {
  
  // Trigger confetti effect when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        // Different confetti patterns for different celebration types
        if (celebrationType === 'course_completion') {
          // Big celebration for course completion
          confetti({
            particleCount: 200,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
          });
          
          setTimeout(() => {
            confetti({
              particleCount: 100,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
            });
          }, 250);
          
          setTimeout(() => {
            confetti({
              particleCount: 100,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#45B7D1', '#96CEB4', '#FFEAA7']
            });
          }, 500);
        } else {
          // Moderate celebration for module unlock
          confetti({
            particleCount: 100,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B']
          });
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, celebrationType]);

  const getCelebrationIcon = () => {
    switch (celebrationType) {
      case 'course_completion':
        return <GraduationCap className=\"h-16 w-16 text-yellow-500\" />;
      case 'module_unlock':
        return <Trophy className=\"h-16 w-16 text-blue-500\" />;
      default:
        return <Award className=\"h-16 w-16 text-green-500\" />;
    }
  };

  const getBackgroundGradient = () => {
    switch (celebrationType) {
      case 'course_completion':
        return 'from-yellow-50 via-orange-50 to-red-50';
      case 'module_unlock':
        return 'from-blue-50 via-indigo-50 to-purple-50';
      default:
        return 'from-green-50 via-emerald-50 to-teal-50';
    }
  };

  const getBorderColor = () => {
    switch (celebrationType) {
      case 'course_completion':
        return 'border-yellow-200';
      case 'module_unlock':
        return 'border-blue-200';
      default:
        return 'border-green-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        \"max-w-md mx-auto bg-gradient-to-br border-2 shadow-2xl\",
        getBackgroundGradient(),
        getBorderColor()
      )}>
        <DialogHeader className=\"text-center space-y-4\">
          {/* Animated Icon */}
          <div className=\"flex justify-center\">
            <div className=\"relative\">
              {getCelebrationIcon()}
              <div className=\"absolute -top-1 -right-1\">
                <Sparkles className=\"h-6 w-6 text-yellow-400 animate-pulse\" />
              </div>
            </div>
          </div>
          
          {/* Main Message */}
          <DialogTitle className=\"text-2xl font-bold text-gray-900\">
            {celebrationMessage}
          </DialogTitle>
          
          {/* Subtext */}
          <DialogDescription className=\"text-lg text-gray-700\">
            {celebrationSubtext}
          </DialogDescription>
        </DialogHeader>

        {/* Content based on celebration type */}
        <div className=\"space-y-4 py-4\">
          {completedModule && (
            <div className=\"bg-white/60 rounded-lg p-4 space-y-2\">
              <div className=\"flex items-center justify-between\">
                <span className=\"font-semibold text-gray-700\">Completed Module</span>
                <Badge variant=\"default\" className=\"bg-green-100 text-green-800\">
                  Module {completedModule.order}
                </Badge>
              </div>
              <div className=\"text-sm text-gray-600\">{completedModule.title}</div>
              <div className=\"flex items-center justify-between text-sm\">
                <span>Your Score:</span>
                <span className=\"font-bold text-green-600\">{completedModule.score.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {nextModule && (
            <div className=\"bg-white/60 rounded-lg p-4 space-y-2\">
              <div className=\"flex items-center justify-between\">
                <span className=\"font-semibold text-gray-700\">Next Challenge</span>
                <Badge variant=\"outline\" className=\"border-blue-300 text-blue-700\">
                  Module {nextModule.order}
                </Badge>
              </div>
              <div className=\"text-sm text-gray-600\">{nextModule.title}</div>
              <div className=\"flex items-center text-sm text-blue-600\">
                <Target className=\"h-4 w-4 mr-1\" />
                <span>Ready to start!</span>
              </div>
            </div>
          )}

          {courseCompletion && (
            <div className=\"bg-white/60 rounded-lg p-4 space-y-3\">
              <div className=\"text-center\">
                <div className=\"text-2xl font-bold text-yellow-600 mb-1\">
                  {courseCompletion.overallScore.toFixed(1)}%
                </div>
                <div className=\"text-sm text-gray-600\">Overall Course Score</div>
              </div>
              
              <div className=\"grid grid-cols-2 gap-4 text-center\">
                <div>
                  <div className=\"text-lg font-bold text-gray-800\">{courseCompletion.totalModules}</div>
                  <div className=\"text-xs text-gray-600\">Modules Completed</div>
                </div>
                <div>
                  <div className=\"text-lg font-bold text-gray-800\">
                    {new Date(courseCompletion.completionDate).toLocaleDateString()}
                  </div>
                  <div className=\"text-xs text-gray-600\">Completion Date</div>
                </div>
              </div>
            </div>
          )}

          {/* Achievement Badges */}
          <div className=\"flex justify-center space-x-2\">
            {celebrationType === 'course_completion' && (
              <>
                <Badge variant=\"default\" className=\"bg-yellow-100 text-yellow-800\">
                  <Star className=\"h-3 w-3 mr-1\" />
                  Course Complete
                </Badge>
                <Badge variant=\"default\" className=\"bg-purple-100 text-purple-800\">
                  <Award className=\"h-3 w-3 mr-1\" />
                  Certificate Earned
                </Badge>
              </>
            )}
            {celebrationType === 'module_unlock' && (
              <Badge variant=\"default\" className=\"bg-blue-100 text-blue-800\">
                <Trophy className=\"h-3 w-3 mr-1\" />
                Module Unlocked
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className=\"space-y-2\">
          {celebrationType === 'course_completion' && onViewCertificate ? (
            <div className=\"space-y-2\">
              <Button
                onClick={onViewCertificate}
                className=\"w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 text-lg\"
                size=\"lg\"
              >
                <GraduationCap className=\"mr-2 h-5 w-5\" />
                View Certificate
              </Button>
              <Button
                onClick={onContinue}
                variant=\"outline\"
                className=\"w-full\"
              >
                Continue Exploring
              </Button>
            </div>
          ) : (
            <Button
              onClick={onContinue}
              className={cn(
                \"w-full font-semibold py-3 text-lg shadow-lg\",
                celebrationType === 'course_completion' 
                  ? \"bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600\" 
                  : \"bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600\",
                \"text-white\"
              )}
              size=\"lg\"
            >
              <ChevronRight className=\"mr-2 h-5 w-5\" />
              {nextAction}
            </Button>
          )}
        </div>
        
        {/* Skip/Close Option */}
        <div className=\"text-center\">
          <Button
            variant=\"ghost\"
            onClick={onClose}
            className=\"text-gray-500 hover:text-gray-700 text-sm\"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModuleUnlockCelebration;
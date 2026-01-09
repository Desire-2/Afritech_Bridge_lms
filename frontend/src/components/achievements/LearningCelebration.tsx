import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Flame, Medal, Crown, Target, X, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import Link from 'next/link';

// Types for learning celebrations
interface LearningAchievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  tier: string;
  rarity: string;
  points: number;
  xp_bonus: number;
}

interface LearningCelebrationData {
  type: 'achievement' | 'level_up' | 'streak_milestone' | 'lesson_complete' | 'quiz_perfect' | 'fast_completion';
  achievement?: LearningAchievement;
  level_data?: {
    new_level: number;
    previous_level: number;
    xp_earned: number;
  };
  streak_data?: {
    days: number;
    milestone: boolean;
    reward_points: number;
  };
  lesson_data?: {
    title: string;
    score: number;
    time_spent: number;
    perfect_score: boolean;
    fast_completion: boolean;
  };
  points_earned: number;
}

interface LearningCelebrationProps {
  isVisible: boolean;
  data: LearningCelebrationData | null;
  onClose: () => void;
  onContinue?: () => void;
  compact?: boolean;
}

// Icon mapping
const ICON_MAP = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  medal: Medal,
  crown: Crown,
  target: Target
};

// Color schemes
const TIER_COLORS = {
  bronze: 'from-orange-400 to-orange-600',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-cyan-400 to-cyan-600',
  diamond: 'from-purple-400 to-purple-600'
};

const LearningCelebration: React.FC<LearningCelebrationProps> = ({
  isVisible,
  data,
  onClose,
  onContinue,
  compact = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isVisible && data) {
      // Trigger confetti based on celebration type
      const particleCount = {
        achievement: data.achievement?.rarity === 'legendary' ? 150 : 
                    data.achievement?.rarity === 'epic' ? 100 : 
                    data.achievement?.rarity === 'rare' ? 80 : 60,
        level_up: 120,
        streak_milestone: 100,
        lesson_complete: 60,
        quiz_perfect: 80,
        fast_completion: 70
      };

      confetti({
        particleCount: particleCount[data.type] || 60,
        spread: 100,
        startVelocity: 30,
        colors: getConfettiColors(data),
        origin: { x: 0.5, y: 0.6 }
      });

      // Show appropriate toast
      showCelebrationToast(data);
    }
  }, [isVisible, data]);

  const getConfettiColors = (data: LearningCelebrationData): string[] => {
    switch (data.type) {
      case 'achievement':
        return data.achievement?.rarity === 'legendary' ? ['#FFD700', '#FFA500', '#FF6B6B'] :
               data.achievement?.rarity === 'epic' ? ['#8B5CF6', '#A855F7'] :
               data.achievement?.rarity === 'rare' ? ['#3B82F6', '#1D4ED8'] :
               ['#10B981', '#059669'];
      case 'level_up':
        return ['#8B5CF6', '#A855F7', '#C084FC'];
      case 'streak_milestone':
        return ['#F97316', '#EA580C', '#DC2626'];
      default:
        return ['#3B82F6', '#10B981'];
    }
  };

  const showCelebrationToast = (data: LearningCelebrationData) => {
    switch (data.type) {
      case 'achievement':
        toast.success(`🏆 Achievement Unlocked: ${data.achievement?.title}`, {
          description: `+${data.points_earned} points earned!`
        });
        break;
      case 'level_up':
        toast.success(`🎊 Level Up! Now Level ${data.level_data?.new_level}`, {
          description: `+${data.level_data?.xp_earned} XP earned!`
        });
        break;
      case 'streak_milestone':
        toast.success(`🔥 ${data.streak_data?.days} Day Streak Milestone!`, {
          description: `+${data.streak_data?.reward_points} bonus points!`
        });
        break;
      case 'lesson_complete':
        if (data.lesson_data?.perfect_score) {
          toast.success(`⭐ Perfect Score on ${data.lesson_data.title}!`);
        } else if (data.lesson_data?.fast_completion) {
          toast.success(`⚡ Lightning Fast Completion!`);
        } else {
          toast.success(`✅ Lesson Completed: ${data.lesson_data?.title}`);
        }
        break;
    }
  };

  if (!isVisible || !data) return null;

  if (compact) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {renderCelebrationIcon(data)}
                  <div>
                    <h4 className="font-semibold text-purple-800">
                      {getCelebrationTitle(data)}
                    </h4>
                    <p className="text-sm text-purple-600">
                      +{data.points_earned} points earned!
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0 text-purple-500 hover:text-purple-700"
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={onClose}>
                  Continue
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href="/student/achievements">
                    View All
                    <ChevronRight size={14} className="ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="relative max-w-lg w-full"
        >
          {renderFullCelebrationCard(data)}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  function renderCelebrationIcon(data: LearningCelebrationData) {
    const size = compact ? 24 : 40;
    
    switch (data.type) {
      case 'achievement':
        const IconComponent = ICON_MAP[data.achievement?.icon as keyof typeof ICON_MAP] || Trophy;
        const tierColors = TIER_COLORS[data.achievement?.tier as keyof typeof TIER_COLORS] || TIER_COLORS.bronze;
        return (
          <div className={`p-2 rounded-full bg-gradient-to-br ${tierColors} text-white`}>
            <IconComponent size={size} />
          </div>
        );
      case 'level_up':
        return (
          <div className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Crown size={size} />
          </div>
        );
      case 'streak_milestone':
        return (
          <div className="p-2 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <Flame size={size} />
          </div>
        );
      default:
        return (
          <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <Star size={size} />
          </div>
        );
    }
  }

  function getCelebrationTitle(data: LearningCelebrationData): string {
    switch (data.type) {
      case 'achievement':
        return data.achievement?.title || 'Achievement Unlocked!';
      case 'level_up':
        return `Level ${data.level_data?.new_level} Reached!`;
      case 'streak_milestone':
        return `${data.streak_data?.days} Day Streak!`;
      case 'lesson_complete':
        return data.lesson_data?.perfect_score ? 'Perfect Score!' : 'Lesson Complete!';
      case 'quiz_perfect':
        return 'Perfect Quiz Score!';
      case 'fast_completion':
        return 'Lightning Fast!';
      default:
        return 'Great Job!';
    }
  }

  function renderFullCelebrationCard(data: LearningCelebrationData) {
    return (
      <Card className={`${getCelebrationCardStyles(data)} shadow-2xl border-2`}>
        <CardContent className="p-8 text-center">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
          >
            <X size={16} />
          </Button>

          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-6"
          >
            {renderCelebrationIcon(data)}
          </motion.div>

          {/* Title and Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {getCelebrationTitle(data)}
            </h2>
            {renderCelebrationDescription(data)}
          </motion.div>

          {/* Badges and Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-6"
          >
            {renderCelebrationBadges(data)}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex gap-3 justify-center"
          >
            <Button
              onClick={onClose}
              variant="outline"
              className="px-6"
            >
              Continue Learning
            </Button>
            <Button
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6"
              asChild
            >
              <Link href="/student/achievements">
                View Achievements
                <ChevronRight size={16} className="ml-2" />
              </Link>
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  function getCelebrationCardStyles(data: LearningCelebrationData): string {
    switch (data.type) {
      case 'achievement':
        const tier = data.achievement?.tier || 'bronze';
        const tierColor = {
          bronze: 'from-orange-50 to-orange-100 border-orange-200',
          silver: 'from-gray-50 to-gray-100 border-gray-200',
          gold: 'from-yellow-50 to-yellow-100 border-yellow-200',
          platinum: 'from-cyan-50 to-cyan-100 border-cyan-200',
          diamond: 'from-purple-50 to-purple-100 border-purple-200'
        };
        return `bg-gradient-to-br ${tierColor[tier as keyof typeof tierColor]}`;
      case 'level_up':
        return 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200';
      case 'streak_milestone':
        return 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200';
      default:
        return 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200';
    }
  }

  function renderCelebrationDescription(data: LearningCelebrationData) {
    switch (data.type) {
      case 'achievement':
        return (
          <div>
            <p className="text-gray-600 mb-2">{data.achievement?.description}</p>
            <div className="text-lg font-semibold text-purple-700">
              +{data.points_earned} points earned! 🎉
            </div>
          </div>
        );
      case 'level_up':
        return (
          <div>
            <p className="text-gray-600 mb-2">
              You've advanced from Level {data.level_data?.previous_level} to Level {data.level_data?.new_level}!
            </p>
            <div className="text-lg font-semibold text-purple-700">
              +{data.level_data?.xp_earned} XP earned! ⭐
            </div>
          </div>
        );
      case 'streak_milestone':
        return (
          <div>
            <p className="text-gray-600 mb-2">
              Incredible! You've maintained a {data.streak_data?.days}-day learning streak!
            </p>
            <div className="text-lg font-semibold text-orange-700">
              +{data.streak_data?.reward_points} bonus points! 🔥
            </div>
          </div>
        );
      default:
        return (
          <div className="text-lg font-semibold text-green-700">
            +{data.points_earned} points earned! ✨
          </div>
        );
    }
  }

  function renderCelebrationBadges(data: LearningCelebrationData) {
    switch (data.type) {
      case 'achievement':
        return (
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
              {data.achievement?.tier}
            </Badge>
            <Badge variant="outline">
              {data.achievement?.rarity}
            </Badge>
            <Badge variant="outline">
              +{data.achievement?.points} points
            </Badge>
            {data.achievement?.xp_bonus && (
              <Badge variant="outline" className="text-purple-600">
                +{data.achievement.xp_bonus} XP
              </Badge>
            )}
          </div>
        );
      case 'level_up':
        return (
          <div className="p-4 bg-purple-100 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-2">Level Progress</h4>
            <div className="text-sm text-purple-600">
              You're now Level {data.level_data?.new_level}! Keep learning to unlock more features.
            </div>
          </div>
        );
      default:
        return null;
    }
  }
};

// Hook for triggering celebrations in learning interface
export const useLearningCelebrations = () => {
  const [celebration, setCelebration] = useState<LearningCelebrationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showCelebration = (data: LearningCelebrationData) => {
    setCelebration(data);
    setIsVisible(true);
  };

  const hideCelebration = () => {
    setIsVisible(false);
    setTimeout(() => setCelebration(null), 300); // Wait for animation to complete
  };

  // Predefined celebration triggers
  const triggerAchievement = (achievement: LearningAchievement, points: number) => {
    showCelebration({
      type: 'achievement',
      achievement,
      points_earned: points
    });
  };

  const triggerLevelUp = (newLevel: number, previousLevel: number, xpEarned: number) => {
    showCelebration({
      type: 'level_up',
      level_data: { new_level: newLevel, previous_level: previousLevel, xp_earned: xpEarned },
      points_earned: xpEarned
    });
  };

  const triggerStreakMilestone = (days: number, rewardPoints: number) => {
    showCelebration({
      type: 'streak_milestone',
      streak_data: { days, milestone: true, reward_points: rewardPoints },
      points_earned: rewardPoints
    });
  };

  const triggerLessonComplete = (lessonTitle: string, score: number, timeSpent: number, pointsEarned: number) => {
    const perfectScore = score >= 100;
    const fastCompletion = timeSpent > 0 && timeSpent < 300; // Less than 5 minutes

    showCelebration({
      type: perfectScore ? 'quiz_perfect' : fastCompletion ? 'fast_completion' : 'lesson_complete',
      lesson_data: {
        title: lessonTitle,
        score,
        time_spent: timeSpent,
        perfect_score: perfectScore,
        fast_completion: fastCompletion
      },
      points_earned: pointsEarned
    });
  };

  return {
    celebration,
    isVisible,
    showCelebration,
    hideCelebration,
    triggerAchievement,
    triggerLevelUp,
    triggerStreakMilestone,
    triggerLessonComplete,
    CelebrationComponent: () => (
      <LearningCelebration
        isVisible={isVisible}
        data={celebration}
        onClose={hideCelebration}
      />
    )
  };
};

export default LearningCelebration;
export type { LearningCelebrationData, LearningAchievement };
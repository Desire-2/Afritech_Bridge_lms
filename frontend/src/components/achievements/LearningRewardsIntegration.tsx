import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Zap, 
  Target, 
  Star,
  Medal,
  Crown,
  Award,
  Flame,
  Gift,
  CheckCircle,
  X,
  Share2,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// Types
interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  tier: string;
  rarity: string;
  points: number;
  xp_bonus: number;
}

interface UnlockedAchievement {
  achievement: Achievement;
  earned_at: string;
  context_data: any;
}

interface LevelUpData {
  new_level: number;
  previous_level: number;
  xp_earned: number;
  rewards?: string[];
}

interface StreakMilestone {
  days: number;
  reward_points: number;
  special_message: string;
}

interface BadgeEarned {
  id: number;
  name: string;
  description: string;
  icon_url?: string;
  points: number;
}

// Icon mapping
const ICON_MAP = {
  trophy: Trophy,
  zap: Zap,
  target: Target,
  star: Star,
  medal: Medal,
  crown: Crown,
  award: Award,
  flame: Flame,
  gift: Gift,
  sparkles: Sparkles,
  trending: TrendingUp
};

// Color schemes for different tiers
const TIER_COLORS = {
  bronze: {
    gradient: 'from-orange-400 to-orange-600',
    bg: 'from-orange-50 to-orange-100',
    border: 'border-orange-200',
    text: 'text-orange-800'
  },
  silver: {
    gradient: 'from-gray-300 to-gray-500',
    bg: 'from-gray-50 to-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-800'
  },
  gold: {
    gradient: 'from-yellow-400 to-yellow-600',
    bg: 'from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    text: 'text-yellow-800'
  },
  platinum: {
    gradient: 'from-cyan-400 to-cyan-600',
    bg: 'from-cyan-50 to-cyan-100',
    border: 'border-cyan-200',
    text: 'text-cyan-800'
  },
  diamond: {
    gradient: 'from-purple-400 to-purple-600',
    bg: 'from-purple-50 to-purple-100',
    border: 'border-purple-200',
    text: 'text-purple-800'
  }
};

const RARITY_EFFECTS = {
  common: { particles: 20, colors: ['#3B82F6', '#10B981'] },
  uncommon: { particles: 40, colors: ['#10B981', '#059669'] },
  rare: { particles: 60, colors: ['#3B82F6', '#1D4ED8'] },
  epic: { particles: 80, colors: ['#8B5CF6', '#7C3AED'] },
  legendary: { particles: 120, colors: ['#F59E0B', '#D97706', '#DC2626'] }
};

interface LearningRewardsIntegrationProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const LearningRewardsIntegration: React.FC<LearningRewardsIntegrationProps> = ({
  isVisible = false,
  onClose
}) => {
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [levelUp, setLevelUp] = useState<LevelUpData | null>(null);
  const [streakMilestone, setStreakMilestone] = useState<StreakMilestone | null>(null);
  const [badges, setBadges] = useState<BadgeEarned[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showQueue, setShowQueue] = useState(false);

  // Calculate total rewards to show
  const totalRewards = achievements.length + (levelUp ? 1 : 0) + (streakMilestone ? 1 : 0) + badges.length;

  useEffect(() => {
    if (totalRewards > 0) {
      setShowQueue(true);
    }
  }, [totalRewards]);

  // Trigger confetti effect
  const triggerConfetti = (rarity: string = 'common') => {
    const effect = RARITY_EFFECTS[rarity as keyof typeof RARITY_EFFECTS] || RARITY_EFFECTS.common;
    
    confetti({
      particleCount: effect.particles,
      spread: 100,
      startVelocity: 30,
      colors: effect.colors,
      origin: { x: 0.5, y: 0.6 },
      gravity: 1.2,
      drift: 0.1,
      ticks: 200
    });
  };

  // Show achievement celebration
  const showAchievementCelebration = (achievement: UnlockedAchievement) => {
    triggerConfetti(achievement.achievement.rarity);
    toast.success(`Achievement Unlocked: ${achievement.achievement.title}`, {
      description: `+${achievement.achievement.points} points earned!`,
      duration: 5000,
    });
  };

  // Show level up celebration
  const showLevelUpCelebration = (data: LevelUpData) => {
    triggerConfetti('epic');
    toast.success(`Level Up! Now Level ${data.new_level}`, {
      description: `+${data.xp_earned} XP earned!`,
      duration: 5000,
    });
  };

  // Show streak milestone celebration
  const showStreakCelebration = (milestone: StreakMilestone) => {
    triggerConfetti('rare');
    toast.success(`${milestone.days} Day Streak!`, {
      description: milestone.special_message,
      duration: 5000,
    });
  };

  // Show badge earned celebration
  const showBadgeCelebration = (badge: BadgeEarned) => {
    triggerConfetti('uncommon');
    toast.success(`Badge Earned: ${badge.name}`, {
      description: `+${badge.points} points earned!`,
      duration: 5000,
    });
  };

  const handleNext = () => {
    if (currentIndex === 0 && achievements.length > 0) {
      showAchievementCelebration(achievements[0]);
      setAchievements(prev => prev.slice(1));
    } else if (currentIndex === 0 && levelUp) {
      showLevelUpCelebration(levelUp);
      setLevelUp(null);
    } else if (currentIndex === 0 && streakMilestone) {
      showStreakCelebration(streakMilestone);
      setStreakMilestone(null);
    } else if (currentIndex === 0 && badges.length > 0) {
      showBadgeCelebration(badges[0]);
      setBadges(prev => prev.slice(1));
    }

    if (totalRewards <= 1) {
      setShowQueue(false);
      onClose?.();
    }
  };

  const handleShare = async (achievement: Achievement) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Achievement Unlocked!',
          text: `I just unlocked the "${achievement.title}" achievement! 🏆`,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(`I just unlocked the "${achievement.title}" achievement! 🏆`);
        toast.success('Achievement shared to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  const getCurrentReward = () => {
    if (achievements.length > 0) return { type: 'achievement', data: achievements[0] };
    if (levelUp) return { type: 'levelup', data: levelUp };
    if (streakMilestone) return { type: 'streak', data: streakMilestone };
    if (badges.length > 0) return { type: 'badge', data: badges[0] };
    return null;
  };

  if (!showQueue || totalRewards === 0) {
    return null;
  }

  const currentReward = getCurrentReward();
  if (!currentReward) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative max-w-md w-full"
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowQueue(false);
              onClose?.();
            }}
            className="absolute -top-12 right-0 text-white hover:text-gray-300"
          >
            <X size={20} />
          </Button>

          {/* Reward Cards */}
          {currentReward.type === 'achievement' && (
            <AchievementRewardCard
              achievement={currentReward.data as UnlockedAchievement}
              onNext={handleNext}
              onShare={() => handleShare((currentReward.data as UnlockedAchievement).achievement)}
              totalRemaining={totalRewards - 1}
            />
          )}

          {currentReward.type === 'levelup' && (
            <LevelUpRewardCard
              levelData={currentReward.data as LevelUpData}
              onNext={handleNext}
              totalRemaining={totalRewards - 1}
            />
          )}

          {currentReward.type === 'streak' && (
            <StreakRewardCard
              streakData={currentReward.data as StreakMilestone}
              onNext={handleNext}
              totalRemaining={totalRewards - 1}
            />
          )}

          {currentReward.type === 'badge' && (
            <BadgeRewardCard
              badge={currentReward.data as BadgeEarned}
              onNext={handleNext}
              totalRemaining={totalRewards - 1}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Individual reward card components
const AchievementRewardCard: React.FC<{
  achievement: UnlockedAchievement;
  onNext: () => void;
  onShare: () => void;
  totalRemaining: number;
}> = ({ achievement, onNext, onShare, totalRemaining }) => {
  const IconComponent = ICON_MAP[achievement.achievement.icon as keyof typeof ICON_MAP] || Trophy;
  const tierColors = TIER_COLORS[achievement.achievement.tier as keyof typeof TIER_COLORS] || TIER_COLORS.bronze;

  useEffect(() => {
    triggerConfetti(achievement.achievement.rarity);
  }, [achievement.achievement.rarity]);

  return (
    <Card className={`bg-gradient-to-br ${tierColors.bg} ${tierColors.border} border-2 shadow-2xl`}>
      <CardContent className="p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br ${tierColors.gradient} text-white flex items-center justify-center shadow-lg`}
        >
          <IconComponent size={40} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Achievement Unlocked! 🎉</h2>
          <h3 className={`text-xl font-semibold mb-2 ${tierColors.text}`}>
            {achievement.achievement.title}
          </h3>
          <p className="text-gray-600 mb-4">{achievement.achievement.description}</p>

          <div className="flex justify-center gap-2 mb-6">
            <Badge className={`${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
              {achievement.achievement.tier}
            </Badge>
            <Badge variant="outline">
              +{achievement.achievement.points} points
            </Badge>
            {achievement.achievement.xp_bonus > 0 && (
              <Badge variant="outline" className="text-purple-600">
                +{achievement.achievement.xp_bonus} XP
              </Badge>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={onShare} variant="outline" size="sm">
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
            <Button onClick={onNext} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              {totalRemaining > 0 ? `Next (${totalRemaining} more)` : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};

const LevelUpRewardCard: React.FC<{
  levelData: LevelUpData;
  onNext: () => void;
  totalRemaining: number;
}> = ({ levelData, onNext, totalRemaining }) => {
  useEffect(() => {
    triggerConfetti('epic');
  }, []);

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 border-2 shadow-2xl">
      <CardContent className="p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg"
        >
          <Crown size={40} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Level Up! 🎊</h2>
          <h3 className="text-2xl font-semibold mb-2 text-purple-800">
            Level {levelData.new_level}
          </h3>
          <p className="text-gray-600 mb-4">
            You've earned {levelData.xp_earned} XP and reached a new level!
          </p>

          {levelData.rewards && levelData.rewards.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 mb-2">Rewards Unlocked:</h4>
              <ul className="text-sm text-gray-600">
                {levelData.rewards.map((reward, index) => (
                  <li key={index} className="flex items-center justify-center gap-2">
                    <Gift size={14} />
                    {reward}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={onNext} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
            {totalRemaining > 0 ? `Next (${totalRemaining} more)` : 'Continue'}
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
};

const StreakRewardCard: React.FC<{
  streakData: StreakMilestone;
  onNext: () => void;
  totalRemaining: number;
}> = ({ streakData, onNext, totalRemaining }) => {
  useEffect(() => {
    triggerConfetti('rare');
  }, []);

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 border-2 shadow-2xl">
      <CardContent className="p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shadow-lg"
        >
          <Flame size={40} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Streak Milestone! 🔥</h2>
          <h3 className="text-xl font-semibold mb-2 text-orange-800">
            {streakData.days} Day Streak
          </h3>
          <p className="text-gray-600 mb-4">{streakData.special_message}</p>

          <Badge className="bg-orange-100 text-orange-800 border-orange-200 mb-6">
            +{streakData.reward_points} bonus points
          </Badge>

          <div>
            <Button onClick={onNext} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              {totalRemaining > 0 ? `Next (${totalRemaining} more)` : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};

const BadgeRewardCard: React.FC<{
  badge: BadgeEarned;
  onNext: () => void;
  totalRemaining: number;
}> = ({ badge, onNext, totalRemaining }) => {
  useEffect(() => {
    triggerConfetti('uncommon');
  }, []);

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 border-2 shadow-2xl">
      <CardContent className="p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center shadow-lg"
        >
          {badge.icon_url ? (
            <img src={badge.icon_url} alt={badge.name} className="w-10 h-10 object-contain" />
          ) : (
            <Medal size={40} />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Badge Earned! 🏅</h2>
          <h3 className="text-xl font-semibold mb-2 text-green-800">
            {badge.name}
          </h3>
          <p className="text-gray-600 mb-4">{badge.description}</p>

          <Badge className="bg-green-100 text-green-800 border-green-200 mb-6">
            +{badge.points} points
          </Badge>

          <div>
            <Button onClick={onNext} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
              {totalRemaining > 0 ? `Next (${totalRemaining} more)` : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default LearningRewardsIntegration;
export type { 
  Achievement, 
  UnlockedAchievement, 
  LevelUpData, 
  StreakMilestone, 
  BadgeEarned 
};
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Star, 
  Sparkles, 
  Crown, 
  Award,
  Zap,
  Target,
  Flame,
  X,
  Share2,
  Download
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

// Enhanced icon mapping
const CELEBRATION_ICONS = {
  trophy: Trophy,
  star: Star,
  crown: Crown,
  award: Award,
  zap: Zap,
  target: Target,
  flame: Flame,
  sparkles: Sparkles
};

// Tier-based celebration effects
const TIER_CELEBRATIONS = {
  bronze: {
    confetti: { colors: ['#CD7F32', '#D2691E', '#A0522D'] },
    particles: 50,
    spread: 50,
    emoji: '🥉',
    sound: 'achievement_bronze'
  },
  silver: {
    confetti: { colors: ['#C0C0C0', '#A8A8A8', '#808080'] },
    particles: 75,
    spread: 60,
    emoji: '🥈',
    sound: 'achievement_silver'
  },
  gold: {
    confetti: { colors: ['#FFD700', '#FFA500', '#FF8C00'] },
    particles: 100,
    spread: 70,
    emoji: '🥇',
    sound: 'achievement_gold'
  },
  platinum: {
    confetti: { colors: ['#E5E4E2', '#00CED1', '#4682B4'] },
    particles: 125,
    spread: 80,
    emoji: '💎',
    sound: 'achievement_platinum'
  },
  diamond: {
    confetti: { colors: ['#B57EDC', '#FF69B4', '#DA70D6'] },
    particles: 150,
    spread: 90,
    emoji: '💜',
    sound: 'achievement_diamond'
  },
  legendary: {
    confetti: { colors: ['#FF1493', '#FF4500', '#FFD700', '#00FF00', '#0080FF'] },
    particles: 200,
    spread: 100,
    emoji: '🌟',
    sound: 'achievement_legendary'
  }
};

interface Achievement {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tier: string;
  rarity: string;
  points_value: number;
  earned_at?: string;
}

interface NewRewards {
  achievements: Achievement[];
  levelUp?: {
    new_level: number;
    previous_level: number;
    xp_earned: number;
    rewards?: string[];
  };
  streakMilestone?: {
    days: number;
    reward_points: number;
    special_message: string;
  };
  badges?: any[];
  points_earned: number;
}

interface AchievementCelebrationProps {
  rewards: NewRewards | null;
  isVisible: boolean;
  onClose: () => void;
  onShare?: (achievementId: number, method: string) => void;
}

const AchievementCelebration: React.FC<AchievementCelebrationProps> = ({
  rewards,
  isVisible,
  onClose,
  onShare
}) => {
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [celebrationStage, setCelebrationStage] = useState<'achievements' | 'levelup' | 'streak' | 'complete'>('achievements');
  
  useEffect(() => {
    if (isVisible && rewards) {
      // Start celebration sequence
      setCelebrationStage('achievements');
      setCurrentAchievementIndex(0);
      triggerInitialCelebration();
    }
  }, [isVisible, rewards]);

  const triggerInitialCelebration = () => {
    // Full screen confetti burst
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
    });

    // Multiple confetti bursts
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { x: 0.2, y: 0.8 }
      });
    }, 300);

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { x: 0.8, y: 0.8 }
      });
    }, 600);
  };

  const triggerAchievementCelebration = (achievement: Achievement) => {
    const tierCelebration = TIER_CELEBRATIONS[achievement.tier as keyof typeof TIER_CELEBRATIONS] || TIER_CELEBRATIONS.bronze;
    
    // Tier-specific confetti
    confetti({
      particleCount: tierCelebration.particles,
      spread: tierCelebration.spread,
      origin: { y: 0.7 },
      colors: tierCelebration.confetti.colors
    });

    // Play achievement sound (if available)
    if (typeof window !== 'undefined' && 'Audio' in window) {
      try {
        const audio = new Audio(`/sounds/${tierCelebration.sound}.mp3`);
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Silently fail if audio can't be played
        });
      } catch (error) {
        // Silently fail if audio is not available
      }
    }
  };

  const nextAchievement = () => {
    if (!rewards?.achievements) return;
    
    if (currentAchievementIndex < rewards.achievements.length - 1) {
      setCurrentAchievementIndex(prev => prev + 1);
      triggerAchievementCelebration(rewards.achievements[currentAchievementIndex + 1]);
    } else if (rewards.levelUp) {
      setCelebrationStage('levelup');
      // Level up celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#9333EA', '#EC4899', '#F59E0B']
      });
    } else if (rewards.streakMilestone) {
      setCelebrationStage('streak');
      // Streak celebration
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#EF4444', '#F97316', '#EAB308']
      });
    } else {
      setCelebrationStage('complete');
    }
  };

  const shareAchievement = async (achievement: Achievement, method: string) => {
    try {
      const achievementUrl = `${window.location.origin}/achievements/${achievement.id}`;
      const shareText = `🎉 I just unlocked "${achievement.title}"! ${achievement.description}`;

      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(shareText + '\n' + achievementUrl);
          toast.success('Achievement copied to clipboard!');
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(achievementUrl)}`, '_blank');
          break;
        case 'download':
          await downloadCelebrationImage(achievement);
          break;
      }

      onShare?.(achievement.id, method);
    } catch (error) {
      toast.error('Failed to share achievement');
    }
  };

  const downloadCelebrationImage = async (achievement: Achievement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 800;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Achievement celebration text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 ACHIEVEMENT UNLOCKED! 🎉', canvas.width / 2, 150);

    ctx.font = 'bold 48px Arial';
    ctx.fillText(achievement.title, canvas.width / 2, 300);

    ctx.font = '32px Arial';
    ctx.fillStyle = '#f0f0f0';
    ctx.fillText(achievement.description, canvas.width / 2, 380);

    ctx.font = '24px Arial';
    ctx.fillText(`Tier: ${achievement.tier.toUpperCase()} • Points: ${achievement.points_value}`, canvas.width / 2, 450);

    const date = new Date().toLocaleDateString();
    ctx.font = '20px Arial';
    ctx.fillText(`Earned on: ${date}`, canvas.width / 2, 500);

    // Download
    const link = document.createElement('a');
    link.download = `${achievement.title.replace(/\s+/g, '_')}_celebration.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast.success('Celebration image downloaded!');
  };

  if (!isVisible || !rewards) return null;

  const currentAchievement = rewards.achievements?.[currentAchievementIndex];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative max-w-2xl w-full"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute -top-4 -right-4 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full h-10 w-10"
            onClick={onClose}
          >
            <X className="h-5 w-5 text-white" />
          </Button>

          {/* Achievement Celebration */}
          {celebrationStage === 'achievements' && currentAchievement && (
            <Card className="overflow-hidden bg-gradient-to-br from-white to-gray-50 border-4 border-yellow-400 shadow-2xl">
              <CardContent className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="relative inline-block">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-500/50 border-4 border-white">
                      {React.createElement(
                        CELEBRATION_ICONS[currentAchievement.icon as keyof typeof CELEBRATION_ICONS] || Trophy,
                        { className: "h-16 w-16 text-white drop-shadow-xl" }
                      )}
                    </div>
                    <motion.div
                      className="absolute -top-2 -right-2 text-4xl"
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                    >
                      ✨
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-4"
                >
                  <div>
                    <motion.h1
                      className="text-4xl font-bold text-gray-800 mb-2"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Achievement Unlocked!
                    </motion.h1>
                    <h2 className="text-2xl font-semibold text-yellow-600 mb-3">
                      {currentAchievement.title}
                    </h2>
                  </div>

                  <p className="text-lg text-gray-600 max-w-lg mx-auto">
                    {currentAchievement.description}
                  </p>

                  <div className="flex justify-center gap-3 flex-wrap">
                    <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white">
                      {currentAchievement.tier.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{currentAchievement.category}</Badge>
                    <Badge variant="secondary">{currentAchievement.points_value} points</Badge>
                  </div>

                  <div className="pt-6 space-y-3">
                    <div className="flex justify-center gap-3">
                      <Button
                        onClick={() => shareAchievement(currentAchievement, 'copy')}
                        variant="outline"
                        size="sm"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                      <Button
                        onClick={() => shareAchievement(currentAchievement, 'download')}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>

                    <div className="flex justify-center">
                      {rewards.achievements && rewards.achievements.length > 1 && (
                        <div className="text-sm text-gray-500 mb-2">
                          Achievement {currentAchievementIndex + 1} of {rewards.achievements.length}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={nextAchievement}
                      className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700"
                      size="lg"
                    >
                      {currentAchievementIndex < rewards.achievements.length - 1
                        ? 'Next Achievement'
                        : rewards.levelUp
                        ? 'Level Up!'
                        : rewards.streakMilestone
                        ? 'Streak Milestone!'
                        : 'Awesome!'
                      }
                    </Button>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          )}

          {/* Level Up Celebration */}
          {celebrationStage === 'levelup' && rewards.levelUp && (
            <Card className="overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 border-4 border-purple-500 shadow-2xl">
              <CardContent className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                  className="mb-6"
                >
                  <Crown className="h-24 w-24 text-purple-600 mx-auto" />
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4"
                >
                  <h1 className="text-4xl font-bold text-purple-800">Level Up!</h1>
                  <div className="text-6xl font-bold text-purple-600">
                    {rewards.levelUp.new_level}
                  </div>
                  <p className="text-lg text-purple-700">
                    You've reached level {rewards.levelUp.new_level}!
                  </p>
                  <p className="text-sm text-purple-600">
                    +{rewards.levelUp.xp_earned} XP earned
                  </p>

                  {rewards.levelUp.rewards && rewards.levelUp.rewards.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-semibold text-purple-700 mb-2">Level Rewards:</h3>
                      <div className="flex flex-wrap justify-center gap-2">
                        {rewards.levelUp.rewards.map((reward, index) => (
                          <Badge key={index} variant="secondary">
                            {reward}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      if (rewards.streakMilestone) {
                        setCelebrationStage('streak');
                      } else {
                        setCelebrationStage('complete');
                      }
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 mt-6"
                    size="lg"
                  >
                    {rewards.streakMilestone ? 'Continue' : 'Awesome!'}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          )}

          {/* Streak Milestone Celebration */}
          {celebrationStage === 'streak' && rewards.streakMilestone && (
            <Card className="overflow-hidden bg-gradient-to-br from-orange-100 to-red-100 border-4 border-orange-500 shadow-2xl">
              <CardContent className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                  className="mb-6"
                >
                  <Flame className="h-24 w-24 text-orange-600 mx-auto" />
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4"
                >
                  <h1 className="text-4xl font-bold text-orange-800">Streak Milestone!</h1>
                  <div className="text-6xl font-bold text-orange-600">
                    {rewards.streakMilestone.days}
                  </div>
                  <p className="text-lg text-orange-700">
                    {rewards.streakMilestone.special_message}
                  </p>
                  <p className="text-sm text-orange-600">
                    +{rewards.streakMilestone.reward_points} bonus points
                  </p>

                  <Button
                    onClick={() => setCelebrationStage('complete')}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 mt-6"
                    size="lg"
                  >
                    Keep the Streak Going!
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {celebrationStage === 'complete' && (
            <Card className="overflow-hidden bg-gradient-to-br from-green-100 to-blue-100 border-4 border-green-500 shadow-2xl">
              <CardContent className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                  className="mb-6"
                >
                  <Sparkles className="h-24 w-24 text-green-600 mx-auto" />
                </motion.div>

                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="space-y-4"
                >
                  <h1 className="text-4xl font-bold text-green-800">Congratulations!</h1>
                  <p className="text-lg text-green-700">
                    You earned {rewards.points_earned} total points in this session!
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {rewards.achievements && rewards.achievements.length > 0 && (
                      <div className="bg-white/50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-600">
                          {rewards.achievements.length}
                        </div>
                        <div className="text-sm text-yellow-700">Achievement{rewards.achievements.length !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                    
                    {rewards.levelUp && (
                      <div className="bg-white/50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">
                          {rewards.levelUp.new_level}
                        </div>
                        <div className="text-sm text-purple-700">New Level</div>
                      </div>
                    )}

                    {rewards.streakMilestone && (
                      <div className="bg-white/50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-orange-600">
                          {rewards.streakMilestone.days}
                        </div>
                        <div className="text-sm text-orange-700">Day Streak</div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={onClose}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 mt-6"
                    size="lg"
                  >
                    Continue Learning
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementCelebration;
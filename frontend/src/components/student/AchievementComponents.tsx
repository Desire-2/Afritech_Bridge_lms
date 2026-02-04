"use client";

// Achievement Display Components - Beautiful UI for gamification features
// Includes badges, achievement cards, progress rings, and celebration modals

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Award, Star, Zap, Target, Flame, TrendingUp, Crown,
  Medal, Sparkles, Gift, Lock, Share2, Eye, CheckCircle, Circle,
  ChevronRight, X, Clock, Users, BarChart3, Calendar, Heart, Brain
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Achievement, UserAchievement, LearningStreak, StudentPoints } from '@/services/achievementApi';

// ==================== Achievement Badge Component ====================

interface AchievementBadgeProps {
  achievement: Achievement;
  earned?: boolean;
  earnedData?: UserAchievement;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDetails?: boolean;
  onClick?: () => void;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  earned = false,
  earnedData,
  size = 'md',
  showDetails = false,
  onClick
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const rarityColors = {
    common: 'from-gray-400 to-gray-600',
    uncommon: 'from-green-400 to-green-600',
    rare: 'from-blue-400 to-blue-600',
    epic: 'from-purple-400 to-purple-600',
    legendary: 'from-yellow-400 via-orange-500 to-red-500'
  };

  const tierColors = {
    bronze: 'from-amber-600 to-amber-800',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-300 to-cyan-500',
    diamond: 'from-blue-300 via-purple-300 to-pink-300'
  };

  const getIcon = (iconName: string) => {
    const icons: { [key: string]: any } = {
      trophy: Trophy,
      award: Award,
      star: Star,
      zap: Zap,
      target: Target,
      flame: Flame,
      crown: Crown,
      medal: Medal,
      sparkles: Sparkles,
      gift: Gift,
      heart: Heart,
      brain: Brain
    };
    return icons[iconName] || Trophy;
  };

  const IconComponent = getIcon(achievement.icon);
  const gradientColor = rarityColors[achievement.rarity as keyof typeof rarityColors] || rarityColors.common;
  const isLocked = !earned && achievement.is_hidden;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={`relative ${onClick ? 'cursor-pointer' : ''}`}
          >
            <div
              className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradientColor} 
                ${earned ? 'shadow-lg' : 'opacity-40 grayscale'} 
                flex items-center justify-center relative overflow-hidden`}
            >
              {/* Animated shine effect for earned achievements */}
              {earned && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                />
              )}
              
              {isLocked ? (
                <Lock className={`${iconSizes[size]} text-white/70`} />
              ) : (
                <IconComponent className={`${iconSizes[size]} text-white`} />
              )}

              {/* Tier badge */}
              {earned && size !== 'sm' && (
                <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${tierColors[achievement.tier as keyof typeof tierColors]} 
                  flex items-center justify-center text-[10px] font-bold text-white shadow-md`}>
                  {achievement.tier[0].toUpperCase()}
                </div>
              )}

              {/* Times earned badge for repeatable achievements */}
              {earned && earnedData && achievement.is_repeatable && earnedData.times_earned > 1 && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-600 
                  flex items-center justify-center text-xs font-bold text-white shadow-md">
                  {earnedData.times_earned}
                </div>
              )}
            </div>

            {/* Showcased indicator */}
            {earnedData?.is_showcased && (
              <div className="absolute -top-2 -left-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              </div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-800 border-slate-700">
          <div className="max-w-xs">
            <div className="font-bold text-sm text-slate-100">{achievement.title}</div>
            <div className="text-xs text-slate-300 mt-1">{achievement.description}</div>
            {earned && earnedData && (
              <div className="text-xs text-emerald-400 mt-2">
                Earned {new Date(earnedData.earned_at).toLocaleDateString()}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200">
                {achievement.points} pts
              </Badge>
              <Badge variant="outline" className="text-xs capitalize bg-slate-700 border-slate-600 text-slate-200">
                {achievement.rarity}
              </Badge>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ==================== Achievement Card Component ====================

interface AchievementCardProps {
  achievement: Achievement;
  earned?: boolean;
  earnedData?: UserAchievement;
  onShare?: () => void;
  onShowcase?: (showcase: boolean) => void;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement,
  earned = false,
  earnedData,
  onShare,
  onShowcase
}) => {
  const rarityColors = {
    common: 'border-gray-300 bg-gray-50',
    uncommon: 'border-green-300 bg-green-50',
    rare: 'border-blue-300 bg-blue-50',
    epic: 'border-purple-300 bg-purple-50',
    legendary: 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50'
  };

  return (
    <Card className={`${rarityColors[achievement.rarity as keyof typeof rarityColors]} 
      border-2 transition-all hover:shadow-lg ${!earned && 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Achievement Badge */}
          <div className="flex-shrink-0">
            <AchievementBadge
              achievement={achievement}
              earned={earned}
              earnedData={earnedData}
              size="lg"
            />
          </div>

          {/* Achievement Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{achievement.title}</h3>
                <p className="text-sm text-gray-600 capitalize">
                  {achievement.category} • {achievement.tier} Tier
                </p>
              </div>
              {earned && (
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
              )}
            </div>

            <p className="text-sm text-gray-700 mb-3">{achievement.description}</p>

            {/* Stats and Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-bold">
                  <Trophy className="h-3 w-3 mr-1" />
                  {achievement.points} pts
                </Badge>
                {achievement.xp_bonus > 0 && (
                  <Badge variant="outline" className="font-bold">
                    <Zap className="h-3 w-3 mr-1" />
                    +{achievement.xp_bonus} XP
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize text-xs">
                  {achievement.rarity}
                </Badge>
              </div>

              {earned && earnedData && (
                <div className="flex items-center gap-2">
                  {onShowcase && (
                    <Button
                      size="sm"
                      variant={earnedData.is_showcased ? "default" : "outline"}
                      onClick={() => onShowcase(!earnedData.is_showcased)}
                    >
                      <Star className={`h-3 w-3 ${earnedData.is_showcased ? 'fill-white' : ''}`} />
                    </Button>
                  )}
                  {onShare && (
                    <Button size="sm" variant="outline" onClick={onShare}>
                      <Share2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Additional Info */}
            {earned && earnedData && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
                <span>Earned {new Date(earnedData.earned_at).toLocaleDateString()}</span>
                {earnedData.times_earned > 1 && (
                  <span className="font-semibold text-purple-600">
                    Earned {earnedData.times_earned}x
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== Streak Display Component ====================

interface StreakDisplayProps {
  streak: LearningStreak;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  streak,
  size = 'md',
  showDetails = true
}) => {
  const sizeClasses = {
    sm: { container: 'p-3', flame: 'h-8 w-8', text: 'text-2xl' },
    md: { container: 'p-4', flame: 'h-12 w-12', text: 'text-3xl' },
    lg: { container: 'p-6', flame: 'h-16 w-16', text: 'text-4xl' }
  };

  const getStreakColor = (days: number) => {
    if (days >= 100) return 'from-purple-500 to-pink-500';
    if (days >= 60) return 'from-blue-500 to-purple-500';
    if (days >= 30) return 'from-green-500 to-blue-500';
    if (days >= 7) return 'from-yellow-500 to-orange-500';
    return 'from-orange-400 to-red-500';
  };

  return (
    <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-red-50">
      <CardContent className={sizeClasses[size].container}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Learning Streak
          </h3>
          {streak.streak_freezes_available > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">
                    <Heart className="h-3 w-3 mr-1" />
                    {streak.streak_freezes_available} Freeze{streak.streak_freezes_available > 1 ? 's' : ''}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Streak Freezes protect your streak if you miss a day
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center justify-center">
          <motion.div
            className={`relative ${sizeClasses[size].container} rounded-full 
              bg-gradient-to-br ${getStreakColor(streak.current_streak)} shadow-xl`}
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <Flame className={`${sizeClasses[size].flame} text-white`} />
            
            {/* Animated particles */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                style={{
                  top: '50%',
                  left: '50%'
                }}
                animate={{
                  y: [-20, -40],
                  x: [0, (i - 2) * 10],
                  opacity: [1, 0],
                  scale: [1, 0]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>
        </div>

        <div className="text-center mt-4">
          <motion.div
            className={`font-bold ${sizeClasses[size].text} text-transparent bg-clip-text 
              bg-gradient-to-r ${getStreakColor(streak.current_streak)}`}
            animate={{
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity
            }}
          >
            {streak.current_streak} Day{streak.current_streak !== 1 ? 's' : ''}
          </motion.div>
          <p className="text-sm text-gray-600 mt-1">Current Streak</p>
        </div>

        {showDetails && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Longest Streak:</span>
              <span className="font-semibold text-gray-900">{streak.longest_streak} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Active Days:</span>
              <span className="font-semibold text-gray-900">{streak.total_active_days}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Lessons Completed:</span>
              <span className="font-semibold text-gray-900">{streak.total_lessons_completed}</span>
            </div>

            {/* Milestones */}
            {streak.milestones_reached.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600 mb-2">Milestones Reached:</p>
                <div className="flex flex-wrap gap-1">
                  {streak.milestones_reached.map((milestone) => (
                    <Badge key={milestone} variant="secondary" className="text-xs">
                      {milestone} 🔥
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Points & Level Display ====================

interface PointsLevelDisplayProps {
  points: StudentPoints;
  compact?: boolean;
}

export const PointsLevelDisplay: React.FC<PointsLevelDisplayProps> = ({
  points,
  compact = false
}) => {
  const levelProgress = (points.total_xp / (points.total_xp + points.xp_to_next_level)) * 100;

  const getLevelColor = (level: number) => {
    if (level >= 50) return 'from-purple-500 to-pink-500';
    if (level >= 30) return 'from-blue-500 to-purple-500';
    if (level >= 15) return 'from-green-500 to-blue-500';
    if (level >= 5) return 'from-yellow-500 to-orange-500';
    return 'from-gray-400 to-gray-600';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getLevelColor(points.current_level)} 
          flex items-center justify-center shadow-lg`}>
          <span className="text-white font-bold text-lg">{points.current_level}</span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-semibold text-gray-900">{points.total_points.toLocaleString()} pts</span>
            <span className="text-gray-600">Level {points.current_level}</span>
          </div>
          <Progress value={levelProgress} className="h-2" />
          <div className="text-xs text-gray-500 mt-1">
            {points.total_xp} / {points.xp_to_next_level} XP to next level
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Level & Points</h3>
            <p className="text-sm text-gray-600">Your progression</p>
          </div>
          {points.global_rank && (
            <Badge variant="secondary" className="font-bold">
              <Crown className="h-3 w-3 mr-1" />
              Rank #{points.global_rank}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-6 mb-6">
          <motion.div
            className={`w-24 h-24 rounded-full bg-gradient-to-br ${getLevelColor(points.current_level)} 
              flex items-center justify-center shadow-2xl relative overflow-hidden`}
            animate={{
              boxShadow: [
                '0 10px 40px rgba(0,0,0,0.1)',
                '0 10px 60px rgba(59, 130, 246, 0.5)',
                '0 10px 40px rgba(0,0,0,0.1)'
              ]
            }}
            transition={{
              duration: 3,
              repeat: Infinity
            }}
          >
            <span className="text-white font-bold text-3xl relative z-10">{points.current_level}</span>
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>

          <div className="flex-1">
            <div className="mb-2">
              <div className="flex justify-between text-sm font-semibold mb-1">
                <span>Level {points.current_level}</span>
                <span>Level {points.current_level + 1}</span>
              </div>
              <Progress value={levelProgress} className="h-3" />
              <div className="text-xs text-gray-600 mt-1 text-center">
                {points.total_xp} / {points.xp_to_next_level} XP
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
                {points.total_points.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
          </div>
        </div>

        {/* Points Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Lessons:</span>
            <span className="font-semibold">{points.lesson_points}</span>
          </div>
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Quizzes:</span>
            <span className="font-semibold">{points.quiz_points}</span>
          </div>
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Assignments:</span>
            <span className="font-semibold">{points.assignment_points}</span>
          </div>
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Streaks:</span>
            <span className="font-semibold">{points.streak_points}</span>
          </div>
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Achievements:</span>
            <span className="font-semibold">{points.achievement_points}</span>
          </div>
          <div className="flex justify-between p-2 bg-white rounded-lg">
            <span className="text-gray-600">Bonus:</span>
            <span className="font-semibold">{points.bonus_points}</span>
          </div>
        </div>

        {/* Multiplier */}
        {points.point_multiplier > 1.0 && points.multiplier_expires_at && (
          <div className="mt-4 p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg border border-yellow-300">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <div className="font-semibold text-yellow-800">
                  {points.point_multiplier}x Point Boost Active!
                </div>
                <div className="text-xs text-yellow-700">
                  Expires: {new Date(points.multiplier_expires_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Achievement Unlocked Modal ====================

interface AchievementUnlockedModalProps {
  achievement: UserAchievement;
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementUnlockedModal: React.FC<AchievementUnlockedModalProps> = ({
  achievement,
  isOpen,
  onClose
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className="mb-6"
          >
            <AchievementBadge
              achievement={achievement.achievement}
              earned={true}
              earnedData={achievement}
              size="xl"
            />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 mb-2"
          >
            Achievement Unlocked!
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {achievement.achievement.title}
            </h3>
            <p className="text-gray-600 mb-4">{achievement.achievement.description}</p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <Badge variant="secondary" className="font-bold">
                <Trophy className="h-3 w-3 mr-1" />
                +{achievement.achievement.points} pts
              </Badge>
              {achievement.achievement.xp_bonus > 0 && (
                <Badge variant="outline" className="font-bold">
                  <Zap className="h-3 w-3 mr-1" />
                  +{achievement.achievement.xp_bonus} XP
                </Badge>
              )}
              <Badge className="capitalize">
                {achievement.achievement.rarity}
              </Badge>
            </div>

            {achievement.achievement.unlock_message && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                <p className="text-sm text-blue-800">{achievement.achievement.unlock_message}</p>
              </div>
            )}

            <Button onClick={onClose} className="w-full" size="lg">
              Awesome!
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

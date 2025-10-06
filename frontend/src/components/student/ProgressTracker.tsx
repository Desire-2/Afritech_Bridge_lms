"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Star, 
  Flame, 
  Target, 
  Clock, 
  BookOpen, 
  Award, 
  Zap,
  TrendingUp,
  CheckCircle,
  Circle,
  Medal,
  Crown,
  Sparkles,
  Calendar,
  Brain,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  unlockedAt?: string;
}

interface LearningStreak {
  current: number;
  longest: number;
  lastStudied: string;
}

interface LearningStats {
  totalTimeSpent: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  averageScore: number;
  coursesEnrolled: number;
  certificatesEarned: number;
}

interface ProgressTrackerProps {
  courseProgress: number;
  moduleProgress: number;
  lessonProgress: number;
  timeSpent: number;
  streak: LearningStreak;
  stats: LearningStats;
  achievements: Achievement[];
  onAchievementClick?: (achievement: Achievement) => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  courseProgress,
  moduleProgress,
  lessonProgress,
  timeSpent,
  streak,
  stats,
  achievements,
  onAchievementClick
}) => {
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [animateXP, setAnimateXP] = useState(false);

  const xpToNextLevel = 1000;
  const currentXP = Math.floor(stats.totalTimeSpent * 2 + stats.lessonsCompleted * 50 + stats.quizzesCompleted * 100);
  const currentLevel = Math.floor(currentXP / xpToNextLevel) + 1;
  const xpProgress = (currentXP % xpToNextLevel) / xpToNextLevel * 100;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStreakIcon = () => {
    if (streak.current >= 30) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (streak.current >= 14) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (streak.current >= 7) return <Flame className="h-5 w-5 text-orange-500" />;
    return <Flame className="h-5 w-5 text-red-500" />;
  };

  const getAchievementBadgeColor = (type: string) => {
    switch (type) {
      case 'platinum': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'gold': return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 'silver': return 'bg-gradient-to-r from-gray-300 to-gray-500';
      case 'bronze': return 'bg-gradient-to-r from-amber-600 to-amber-800';
      default: return 'bg-gradient-to-r from-blue-500 to-purple-500';
    }
  };

  useEffect(() => {
    // Check for new achievements
    const unlockedAchievements = achievements.filter(a => a.unlocked && a.unlockedAt);
    const recentAchievement = unlockedAchievements.find(a => {
      const unlockTime = new Date(a.unlockedAt!).getTime();
      const now = new Date().getTime();
      return (now - unlockTime) < 5000; // Show if unlocked in last 5 seconds
    });

    if (recentAchievement && !newAchievement) {
      setNewAchievement(recentAchievement);
      setShowAchievementModal(true);
      setTimeout(() => {
        setShowAchievementModal(false);
        setNewAchievement(null);
      }, 4000);
    }
  }, [achievements, newAchievement]);

  useEffect(() => {
    // Animate XP gain
    if (currentXP > 0) {
      setAnimateXP(true);
      setTimeout(() => setAnimateXP(false), 1000);
    }
  }, [currentXP]);

  return (
    <div className="space-y-6">
      {/* Course Progress Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Course Progress</h3>
              <p className="text-sm text-muted-foreground">Keep up the great work!</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{Math.round(courseProgress)}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Course</span>
                <span>{Math.round(courseProgress)}%</span>
              </div>
              <Progress value={courseProgress} className="h-3" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Current Module</span>
                <span>{Math.round(moduleProgress)}%</span>
              </div>
              <Progress value={moduleProgress} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Current Lesson</span>
                <span>{Math.round(lessonProgress)}%</span>
              </div>
              <Progress value={lessonProgress} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level and XP */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                  {currentLevel}
                </div>
                {animateXP && (
                  <motion.div
                    className="absolute -top-2 -right-2 text-xs bg-green-500 text-white px-2 py-1 rounded-full"
                    initial={{ scale: 0, y: 0 }}
                    animate={{ scale: 1, y: -20 }}
                    exit={{ opacity: 0 }}
                  >
                    +XP
                  </motion.div>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Level {currentLevel}</h3>
                <p className="text-sm text-muted-foreground">{currentXP.toLocaleString()} XP</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Next Level</div>
              <div className="text-lg font-semibold">{(xpToNextLevel - (currentXP % xpToNextLevel)).toLocaleString()} XP</div>
            </div>
          </div>
          
          <Progress value={xpProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Level {currentLevel}</span>
            <span>Level {currentLevel + 1}</span>
          </div>
        </CardContent>
      </Card>

      {/* Learning Streak */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStreakIcon()}
              <div>
                <h3 className="font-semibold">Learning Streak</h3>
                <p className="text-sm text-muted-foreground">
                  {streak.current} {streak.current === 1 ? 'day' : 'days'} in a row
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-500">{streak.current}</div>
              <div className="text-sm text-muted-foreground">
                Best: {streak.longest}
              </div>
            </div>
          </div>
          
          {streak.current >= 7 && (
            <motion.div
              className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  You're on fire! Keep the streak going!
                </span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <div className="text-lg font-semibold">{formatTime(timeSpent)}</div>
            <div className="text-sm text-muted-foreground">Time Spent</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-lg font-semibold">{stats.lessonsCompleted}</div>
            <div className="text-sm text-muted-foreground">Lessons Done</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <div className="text-lg font-semibold">{stats.averageScore}%</div>
            <div className="text-sm text-muted-foreground">Avg Score</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-lg font-semibold">{stats.certificatesEarned}</div>
            <div className="text-sm text-muted-foreground">Certificates</div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Achievements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {achievements.slice(0, 8).map((achievement) => (
              <motion.div
                key={achievement.id}
                className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  achievement.unlocked 
                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 scale-100 hover:scale-105' 
                    : 'bg-muted/50 grayscale opacity-60'
                }`}
                onClick={() => onAchievementClick?.(achievement)}
                whileHover={{ scale: achievement.unlocked ? 1.05 : 1 }}
                whileTap={{ scale: achievement.unlocked ? 0.95 : 1 }}
              >
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center ${
                    achievement.unlocked ? getAchievementBadgeColor(achievement.type) : 'bg-gray-300'
                  }`}>
                    <div className="text-white text-sm">
                      {achievement.icon}
                    </div>
                  </div>
                  <div className="text-xs font-medium truncate">{achievement.title}</div>
                  {achievement.progress !== undefined && (
                    <div className="mt-1">
                      <Progress 
                        value={(achievement.progress / (achievement.maxProgress || 1)) * 100} 
                        className="h-1" 
                      />
                    </div>
                  )}
                </div>
                
                {achievement.unlocked && (
                  <div className="absolute -top-1 -right-1">
                    <CheckCircle className="h-4 w-4 text-green-500 bg-white rounded-full" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          <Button variant="outline" className="w-full mt-4">
            View All Achievements
          </Button>
        </CardContent>
      </Card>

      {/* Achievement Notification */}
      <AnimatePresence>
        {showAchievementModal && newAchievement && (
          <motion.div
            className="fixed top-4 right-4 z-50"
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
          >
            <Card className="w-80 bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-xl">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    {newAchievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Achievement Unlocked!</div>
                    <div className="text-lg font-bold">{newAchievement.title}</div>
                    <div className="text-sm opacity-90">{newAchievement.description}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {newAchievement.type.charAt(0).toUpperCase() + newAchievement.type.slice(1)}
                  </Badge>
                  <div className="flex space-x-1">
                    <Sparkles className="h-4 w-4" />
                    <Sparkles className="h-4 w-4" />
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProgressTracker;
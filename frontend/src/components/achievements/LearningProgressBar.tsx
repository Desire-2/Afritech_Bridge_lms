import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Flame, Medal, Crown, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';

interface LearningProgressBarProps {
  courseProgress?: number;
  moduleProgress?: number;
  lessonProgress?: number;
  currentStreak?: number;
  totalPoints?: number;
  level?: number;
  xpProgress?: number;
}

const LearningProgressBar: React.FC<LearningProgressBarProps> = ({
  courseProgress = 0,
  moduleProgress = 0,
  lessonProgress = 0,
  currentStreak = 0,
  totalPoints = 0,
  level = 1,
  xpProgress = 0
}) => {
  const { getQuickStats } = useAchievementSystem();
  const stats = getQuickStats();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Main Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Course Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Course Progress</span>
            <span className="font-medium">{courseProgress}%</span>
          </div>
          <Progress value={courseProgress} className="h-2" />
        </div>

        {/* Module Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Module Progress</span>
            <span className="font-medium">{moduleProgress}%</span>
          </div>
          <Progress value={moduleProgress} className="h-2" />
        </div>

        {/* Lesson Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Lesson Progress</span>
            <span className="font-medium">{lessonProgress}%</span>
          </div>
          <Progress value={lessonProgress} className="h-2" />
        </div>
      </div>

      {/* Achievement Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Level */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200"
        >
          <Crown className="h-5 w-5 text-purple-600" />
          <div>
            <div className="font-bold text-purple-800">Lv.{stats.current_level}</div>
            <div className="text-xs text-purple-600">{xpProgress}% to next</div>
          </div>
        </motion.div>

        {/* Points */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200"
        >
          <Star className="h-5 w-5 text-yellow-600" />
          <div>
            <div className="font-bold text-yellow-800">{stats.total_points.toLocaleString()}</div>
            <div className="text-xs text-yellow-600">Points</div>
          </div>
        </motion.div>

        {/* Streak */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200"
        >
          <Flame className="h-5 w-5 text-orange-600" />
          <div>
            <div className="font-bold text-orange-800">{stats.current_streak}</div>
            <div className="text-xs text-orange-600">Day Streak</div>
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200"
        >
          <Trophy className="h-5 w-5 text-green-600" />
          <div>
            <div className="font-bold text-green-800">{stats.earned_count}</div>
            <div className="text-xs text-green-600">Earned</div>
          </div>
        </motion.div>

        {/* Global Rank */}
        {stats.global_rank && (
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200"
          >
            <Medal className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-bold text-blue-800">#{stats.global_rank}</div>
              <div className="text-xs text-blue-600">Global</div>
            </div>
          </motion.div>
        )}

        {/* Completion Rate */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200"
        >
          <Target className="h-5 w-5 text-indigo-600" />
          <div>
            <div className="font-bold text-indigo-800">{stats.completion_rate}%</div>
            <div className="text-xs text-indigo-600">Complete</div>
          </div>
        </motion.div>
      </div>

      {/* Level Progress Bar */}
      {xpProgress > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-purple-700 font-medium">Level {stats.current_level} Progress</span>
            <span className="text-purple-600">{xpProgress}% to Level {stats.current_level + 1}</span>
          </div>
          <Progress value={xpProgress} className="h-3 bg-purple-200" />
        </div>
      )}
    </div>
  );
};

export default LearningProgressBar;
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Medal, 
  Crown, 
  Star, 
  Flame, 
  Target, 
  Award,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

// Types for achievement data
interface ProfileAchievement {
  id: number;
  title: string;
  icon: string;
  tier: string;
  earned_at: string;
  is_showcased: boolean;
}

interface ProfileAchievementData {
  showcased_achievements: ProfileAchievement[];
  recent_achievements: ProfileAchievement[];
  total_achievements: number;
  total_points: number;
  current_level: number;
  xp_progress: number;
  current_streak: number;
  longest_streak: number;
  global_rank?: number;
  achievements_this_month: number;
}

// Icon mapping
const ICON_MAP = {
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  star: Star,
  flame: Flame,
  target: Target,
  award: Award,
  trending: TrendingUp
};

// Color mapping for achievement tiers
const TIER_COLORS = {
  bronze: 'from-orange-400 to-orange-600',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-cyan-400 to-cyan-600',
  diamond: 'from-purple-400 to-purple-600'
};

interface AchievementProfilePanelProps {
  data?: ProfileAchievementData;
  loading?: boolean;
  compact?: boolean;
}

const AchievementProfilePanel: React.FC<AchievementProfilePanelProps> = ({ 
  data, 
  loading = false,
  compact = false
}) => {
  if (loading) {
    return (
      <Card className="w-full border-slate-700 bg-slate-800">
        <CardHeader className="bg-slate-900 border-b border-slate-700">
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-slate-800">
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-slate-800">
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-300">Start learning to earn achievements!</p>
            <Button className="mt-4" asChild>
              <Link href="/student/courses">Explore Courses</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="w-full border-slate-700 bg-slate-800">
        <CardContent className="p-4 bg-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold text-slate-100">Achievements</span>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/student/achievements">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
          
          {/* Compact Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-slate-700 rounded-lg border border-slate-600">
              <div className="text-2xl font-bold text-slate-100">{data.total_achievements}</div>
              <div className="text-xs text-slate-300">Earned</div>
            </div>
            <div className="text-center p-3 bg-slate-700 rounded-lg border border-slate-600">
              <div className="text-2xl font-bold text-slate-100">{data.current_streak}</div>
              <div className="text-xs text-slate-300">Day Streak</div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-100 font-medium">Level {data.current_level}</span>
              <span className="text-purple-600">{data.xp_progress}%</span>
            </div>
            <Progress value={data.xp_progress} className="h-2" />
          </div>

          {/* Recent Achievements */}
          {data.recent_achievements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-gray-700">Recent Achievements</h4>
              <div className="space-y-2">
                {data.recent_achievements.slice(0, 2).map((achievement) => {
                  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Trophy;
                  return (
                    <div key={achievement.id} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100">
                      <div className={`p-1 rounded-full bg-gradient-to-br ${TIER_COLORS[achievement.tier as keyof typeof TIER_COLORS]} text-white`}>
                        <IconComponent size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-purple-800 truncate">{achievement.title}</div>
                        <div className="text-xs text-purple-600">
                          {new Date(achievement.earned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/student/achievements">
              View All
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Achievement Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200"
            >
              <Trophy className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-800">{data.total_achievements}</div>
              <div className="text-sm text-yellow-600">Total Earned</div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200"
            >
              <Star className="h-6 w-6 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-800">{data.total_points.toLocaleString()}</div>
              <div className="text-sm text-purple-600">Total Points</div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200"
            >
              <Flame className="h-6 w-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-800">{data.current_streak}</div>
              <div className="text-sm text-orange-600">Day Streak</div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200"
            >
              <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-800">#{data.global_rank || 'N/A'}</div>
              <div className="text-sm text-blue-600">Global Rank</div>
            </motion.div>
          </div>

          {/* Level Progress */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="h-5 w-5 text-purple-600" />
              <div>
                <h4 className="font-semibold text-purple-800">Level {data.current_level}</h4>
                <p className="text-sm text-purple-600">Keep learning to level up!</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">XP Progress</span>
                <span className="text-purple-600">{data.xp_progress}%</span>
              </div>
              <Progress value={data.xp_progress} className="h-3" />
            </div>
          </div>

          {/* Showcased Achievements */}
          {data.showcased_achievements.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Medal className="h-4 w-4 text-yellow-500" />
                Showcased Achievements
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.showcased_achievements.map((achievement, index) => {
                  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Trophy;
                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200"
                    >
                      <div className={`p-2 rounded-full bg-gradient-to-br ${TIER_COLORS[achievement.tier as keyof typeof TIER_COLORS]} text-white`}>
                        <IconComponent size={16} />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-medium text-purple-800 text-sm">{achievement.title}</h5>
                        <p className="text-xs text-purple-600">
                          Earned {new Date(achievement.earned_at).toLocaleDateString()}
                        </p>
                        <Badge className="text-xs mt-1 bg-purple-100 text-purple-700 border-purple-200">
                          {achievement.tier}
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Achievements */}
          {data.recent_achievements.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                Recent Achievements
              </h4>
              <div className="space-y-3">
                {data.recent_achievements.slice(0, 3).map((achievement, index) => {
                  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Trophy;
                  return (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200"
                    >
                      <div className={`p-2 rounded-full bg-gradient-to-br ${TIER_COLORS[achievement.tier as keyof typeof TIER_COLORS]} text-white`}>
                        <IconComponent size={16} />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-medium text-green-800 text-sm">{achievement.title}</h5>
                        <p className="text-xs text-green-600">
                          {new Date(achievement.earned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                        {achievement.tier}
                      </Badge>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">This Month</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-800">{data.achievements_this_month}</div>
                <div className="text-xs text-gray-600">New Achievements</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-800">{data.longest_streak}</div>
                <div className="text-xs text-gray-600">Longest Streak</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-800">{data.current_level}</div>
                <div className="text-xs text-gray-600">Current Level</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AchievementProfilePanel;
export type { ProfileAchievementData, ProfileAchievement };
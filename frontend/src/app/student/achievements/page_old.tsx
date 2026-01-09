"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Star, 
  Target, 
  Flame,
  TrendingUp,
  Award,
  Crown,
  Users,
  Zap,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// Import our enhanced components
import CreativeAchievementBadge from '@/components/achievements/CreativeAchievementBadge';
import AchievementShowcase from '@/components/achievements/AchievementShowcase';
import AchievementCelebration from '@/components/achievements/AchievementCelebration';
import AchievementLeaderboard from '@/components/achievements/AchievementLeaderboard';
import { toast } from 'sonner';

// Icon mapping for achievement icons
const ICON_MAP = {
  trophy: Trophy,
  zap: Zap,
  target: Target,
  star: Star,
  crown: Crown,
  medal: Medal,
  award: Award,
  flame: Flame,
  trending: TrendingUp,
  calendar: Calendar,
  clock: Clock,
  users: Users,
  gift: Gift,
  sparkles: Sparkles
};

// Color mapping for achievement tiers and categories
const COLOR_MAP = {
  bronze: 'from-orange-400 to-orange-600',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-cyan-400 to-cyan-600',
  diamond: 'from-purple-400 to-purple-600'
};

const RARITY_COLORS = {
  common: 'text-gray-500 bg-gray-100',
  uncommon: 'text-green-600 bg-green-100',
  rare: 'text-blue-600 bg-blue-100',
  epic: 'text-purple-600 bg-purple-100',
  legendary: 'text-yellow-600 bg-yellow-100'
};

interface AchievementSummary {
  total_achievements: number;
  earned_achievements: number;
  total_points: number;
  current_streak: number;
  global_rank?: number;
  level: number;
  xp_to_next: number;
  next_achievements: Achievement[];
  recent_achievements: UserAchievement[];
  featured_badges: any[];
}

const AchievementsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    achievements,
    earnedAchievements,
    streak,
    points,
    loading,
    pendingRewards,
    showRewardsModal,
    clearPendingRewards,
    toggleShowcase,
    shareAchievement,
    getQuickStats,
    refreshData
  } = useAchievementSystem();

  const [selectedTab, setSelectedTab] = useState('showcase');

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);

  const handleShare = async (achievementId: number, method: string) => {
    try {
      await shareAchievement(achievementId);
      toast.success(`Achievement shared via ${method}!`);
    } catch (error) {
      toast.error('Failed to share achievement');
    }
  };

  const handleToggleShowcase = async (achievementId: number, showcase: boolean) => {
    try {
      await toggleShowcase(achievementId, showcase);
      toast.success(showcase ? 'Added to showcase' : 'Removed from showcase');
    } catch (error) {
      toast.error('Failed to update showcase');
    }
  };

  const stats = getQuickStats();
  const showcasedAchievements = earnedAchievements.filter(achievement => 
    achievement.is_showcased
  );
        navigator.clipboard.writeText(response.share_text || 'Achievement unlocked!');
        toast.success('Achievement text copied to clipboard!');
      }
    } catch (error) {
      toast.error('Failed to share achievement');
    }
  };

  const filteredAchievements = achievements.filter(achievement => {
    const earned = earnedAchievements.find(ea => ea.achievement.id === achievement.id);
    const matchesFilter = filter === 'all' || 
                         (filter === 'earned' && earned) ||
                         (filter === 'unearned' && !earned) ||
                         (filter === achievement.category);
    const matchesSearch = searchTerm === '' || 
                         achievement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         achievement.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aEarned = earnedAchievements.find(ea => ea.achievement.id === a.id);
    const bEarned = earnedAchievements.find(ea => ea.achievement.id === b.id);
    
    switch (sortBy) {
      case 'recent':
        if (aEarned && bEarned) return new Date(bEarned.earned_at).getTime() - new Date(aEarned.earned_at).getTime();
        if (aEarned) return -1;
        if (bEarned) return 1;
        return 0;
      case 'points':
        return b.points - a.points;
      case 'rarity':
        const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        return (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0) - (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0);
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Achievements Locked</h2>
              <p className="text-muted-foreground mb-4">Please log in to view your achievements and progress.</p>
              <Button>Log In</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-purple-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Loading Achievements...</h2>
          <p className="text-muted-foreground">Preparing your incredible journey</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-8 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">🏆 Achievements</h1>
              <p className="text-purple-100 text-lg">
                Celebrate your learning journey and unlock your potential
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{summary?.earned_achievements || 0}</div>
              <div className="text-purple-200">Unlocked</div>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-700 text-sm font-medium">Total Points</p>
                    <p className="text-3xl font-bold text-yellow-800">{points?.total_points?.toLocaleString() || 0}</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-700 text-sm font-medium">Current Streak</p>
                    <p className="text-3xl font-bold text-orange-800">{streak?.current_streak || 0} days</p>
                  </div>
                  <Flame className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-700 text-sm font-medium">Current Level</p>
                    <p className="text-3xl font-bold text-purple-800">{points?.current_level || 1}</p>
                  </div>
                  <Crown className="h-8 w-8 text-purple-600" />
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-purple-600 mb-1">
                    <span>XP Progress</span>
                    <span>{points?.total_xp || 0}/{(points?.total_xp || 0) + (points?.xp_to_next_level || 0)}</span>
                  </div>
                  <Progress 
                    value={points ? (points.total_xp / (points.total_xp + points.xp_to_next_level)) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium">Global Rank</p>
                    <p className="text-3xl font-bold text-blue-800">#{points?.global_rank || 'N/A'}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Achievements Showcase */}
        {summary?.recent_achievements && summary.recent_achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {summary.recent_achievements.slice(0, 3).map((userAchievement, index) => (
                    <motion.div
                      key={userAchievement.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full bg-gradient-to-br ${COLOR_MAP[userAchievement.achievement.tier as keyof typeof COLOR_MAP]} text-white`}>
                          {React.createElement(ICON_MAP[userAchievement.achievement.icon as keyof typeof ICON_MAP] || Trophy, { size: 20 })}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-purple-800">{userAchievement.achievement.title}</h4>
                          <p className="text-sm text-purple-600 mt-1">{userAchievement.achievement.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`${RARITY_COLORS[userAchievement.achievement.rarity as keyof typeof RARITY_COLORS]} text-xs`}>
                              {userAchievement.achievement.rarity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              +{userAchievement.achievement.points} pts
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters and Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search achievements..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Achievements</SelectItem>
                      <SelectItem value="earned">Earned</SelectItem>
                      <SelectItem value="unearned">Locked</SelectItem>
                      <SelectItem value="speed">Speed</SelectItem>
                      <SelectItem value="consistency">Consistency</SelectItem>
                      <SelectItem value="mastery">Mastery</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                      <SelectItem value="special">Special</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recently Earned</SelectItem>
                      <SelectItem value="points">Points Value</SelectItem>
                      <SelectItem value="rarity">Rarity</SelectItem>
                      <SelectItem value="alphabetical">Alphabetical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={view === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('grid')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAchievementData}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Achievements Grid/List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {sortedAchievements.map((achievement, index) => {
                  const earned = earnedAchievements.find(ea => ea.achievement.id === achievement.id);
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      userAchievement={earned}
                      onToggleShowcase={handleToggleShowcase}
                      onShare={handleShare}
                      index={index}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {sortedAchievements.map((achievement, index) => {
                  const earned = earnedAchievements.find(ea => ea.achievement.id === achievement.id);
                  return (
                    <AchievementListItem
                      key={achievement.id}
                      achievement={achievement}
                      userAchievement={earned}
                      onToggleShowcase={handleToggleShowcase}
                      onShare={handleShare}
                      index={index}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No achievements found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search terms.
            </p>
            <Button variant="outline" onClick={() => {
              setFilter('all');
              setSearchTerm('');
            }}>
              Clear Filters
            </Button>
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
};

// Achievement Card Component
const AchievementCard = ({ 
  achievement, 
  userAchievement, 
  onToggleShowcase, 
  onShare, 
  index 
}: {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  onToggleShowcase: (id: number, showcased: boolean) => void;
  onShare: (id: number) => void;
  index: number;
}) => {
  const isEarned = !!userAchievement;
  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Trophy;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isEarned 
          ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50' 
          : 'border-gray-200 bg-gray-50 opacity-75'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-full ${
              isEarned 
                ? `bg-gradient-to-br ${COLOR_MAP[achievement.tier as keyof typeof COLOR_MAP]} text-white`
                : 'bg-gray-200 text-gray-500'
            }`}>
              <IconComponent size={24} />
            </div>
            {isEarned && (
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleShowcase(achievement.id, userAchievement?.is_showcased || false)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {userAchievement?.is_showcased ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {userAchievement?.is_showcased ? 'Remove from showcase' : 'Add to showcase'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onShare(achievement.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Share2 size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share achievement</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className={`font-bold text-lg ${isEarned ? 'text-purple-800' : 'text-gray-600'}`}>
                {achievement.title}
              </h3>
              <p className={`text-sm ${isEarned ? 'text-purple-600' : 'text-gray-500'}`}>
                {achievement.is_hidden && !isEarned ? '??? Secret Achievement - Unlock to reveal' : achievement.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={`${RARITY_COLORS[achievement.rarity as keyof typeof RARITY_COLORS]} text-xs`}>
                {achievement.rarity}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {achievement.tier}
              </Badge>
              <Badge variant="outline" className="text-xs">
                +{achievement.points} pts
              </Badge>
              {achievement.xp_bonus > 0 && (
                <Badge variant="outline" className="text-xs text-purple-600">
                  +{achievement.xp_bonus} XP
                </Badge>
              )}
            </div>

            {isEarned && userAchievement && (
              <div className="pt-3 border-t border-purple-200">
                <div className="flex items-center justify-between text-xs text-purple-600">
                  <span>Earned {new Date(userAchievement.earned_at).toLocaleDateString()}</span>
                  {userAchievement.times_earned > 1 && (
                    <span>{userAchievement.times_earned}x earned</span>
                  )}
                </div>
                {userAchievement.is_showcased && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-purple-700">
                    <Eye size={12} />
                    <span>Showcased on profile</span>
                  </div>
                )}
              </div>
            )}

            {!isEarned && achievement.current_earners > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  {achievement.current_earners} {achievement.current_earners === 1 ? 'student has' : 'students have'} earned this
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Achievement List Item Component
const AchievementListItem = ({ 
  achievement, 
  userAchievement, 
  onToggleShowcase, 
  onShare, 
  index 
}: {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  onToggleShowcase: (id: number, showcased: boolean) => void;
  onShare: (id: number) => void;
  index: number;
}) => {
  const isEarned = !!userAchievement;
  const IconComponent = ICON_MAP[achievement.icon as keyof typeof ICON_MAP] || Trophy;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.02 }}
    >
      <Card className={`group transition-all duration-300 hover:shadow-md ${
        isEarned 
          ? 'border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50' 
          : 'border-gray-200 bg-gray-50 opacity-75'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${
              isEarned 
                ? `bg-gradient-to-br ${COLOR_MAP[achievement.tier as keyof typeof COLOR_MAP]} text-white`
                : 'bg-gray-200 text-gray-500'
            }`}>
              <IconComponent size={24} />
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-semibold ${isEarned ? 'text-purple-800' : 'text-gray-600'}`}>
                    {achievement.title}
                  </h3>
                  <p className={`text-sm ${isEarned ? 'text-purple-600' : 'text-gray-500'}`}>
                    {achievement.is_hidden && !isEarned ? '??? Secret Achievement - Unlock to reveal' : achievement.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`${RARITY_COLORS[achievement.rarity as keyof typeof RARITY_COLORS]} text-xs`}>
                      {achievement.rarity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {achievement.tier}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      +{achievement.points} pts
                    </Badge>
                    {isEarned && userAchievement && (
                      <span className="text-xs text-purple-600">
                        Earned {new Date(userAchievement.earned_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {isEarned && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleShowcase(achievement.id, userAchievement?.is_showcased || false)}
                    >
                      {userAchievement?.is_showcased ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onShare(achievement.id)}
                    >
                      <Share2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AchievementsPage;
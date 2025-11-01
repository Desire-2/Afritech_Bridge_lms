"use client";

// Achievements Page - Complete achievements dashboard
// Displays achievements, streaks, leaderboards, quests, and more

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Star, Target, Flame, Crown, Medal, Sparkles, Lock,
  Filter, Search, Grid, List, TrendingUp, Award, Zap, Users,
  Calendar, Clock, Gift, CheckCircle, Circle, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import achievementApi from '@/services/achievementApi';
import type { Achievement, UserAchievement, LearningStreak, StudentPoints, Quest } from '@/services/achievementApi';

import {
  AchievementBadge,
  AchievementCard,
  StreakDisplay,
  PointsLevelDisplay,
  AchievementUnlockedModal
} from '@/components/student/AchievementComponents';
import {
  LeaderboardDisplay,
  LeaderboardWidget,
  UserRankCard
} from '@/components/student/LeaderboardComponents';

const AchievementsPage = () => {
  const { toast } = useToast();
  
  // Client-side only rendering check
  const [mounted, setMounted] = useState(false);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<UserAchievement[]>([]);
  const [achievementsByCategory, setAchievementsByCategory] = useState<any>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  
  // Gamification state
  const [streak, setStreak] = useState<LearningStreak | null>(null);
  const [points, setPoints] = useState<StudentPoints | null>(null);
  const [quests, setQuests] = useState<any>({ active: [], available: [], completed: [] });
  const [leaderboards, setLeaderboards] = useState<any[]>([]);
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<any>(null);
  
  // Modal state
  const [showUnlockedModal, setShowUnlockedModal] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<UserAchievement | null>(null);
  
  // Summary statistics
  const [summary, setSummary] = useState<any>(null);

  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadData();
    }
  }, [mounted]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to view your achievements.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Load all data in parallel with error handling for each
      const [
        achievementsData,
        earnedData,
        summaryData,
        streakData,
        pointsData,
        questsData,
        leaderboardsData
      ] = await Promise.allSettled([
        achievementApi.getAllAchievements(),
        achievementApi.getEarnedAchievements(),
        achievementApi.getAchievementsSummary(),
        achievementApi.getStreak(),
        achievementApi.getPoints(),
        achievementApi.getQuests(),
        achievementApi.getLeaderboards()
      ]);

      // Safely extract data with defaults
      if (achievementsData.status === 'fulfilled' && achievementsData.value) {
        setAchievements(achievementsData.value.achievements || []);
        setAchievementsByCategory(achievementsData.value.by_category || {});
      }
      
      if (earnedData.status === 'fulfilled' && earnedData.value) {
        setEarnedAchievements(earnedData.value.achievements || []);
      }
      
      if (summaryData.status === 'fulfilled' && summaryData.value) {
        setSummary(summaryData.value);
      }
      
      if (streakData.status === 'fulfilled' && streakData.value) {
        setStreak(streakData.value);
      }
      
      if (pointsData.status === 'fulfilled' && pointsData.value) {
        setPoints(pointsData.value);
      }
      
      if (questsData.status === 'fulfilled' && questsData.value) {
        setQuests(questsData.value || { active: [], available: [], completed: [] });
      }
      
      if (leaderboardsData.status === 'fulfilled' && leaderboardsData.value) {
        const boards = leaderboardsData.value.leaderboards || [];
        setLeaderboards(boards);
        
        // Load default leaderboard
        if (boards.length > 0) {
          loadLeaderboard(boards[0].name);
        }
      }

    } catch (error) {
      console.error('Error loading achievements data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load achievements data. Make sure the backend is running.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async (leaderboardName: string) => {
    try {
      const data = await achievementApi.getLeaderboard(leaderboardName, 100);
      setSelectedLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const handleShowcaseToggle = async (achievementId: number, showcase: boolean) => {
    try {
      await achievementApi.showcaseAchievement(achievementId, showcase);
      
      // Update local state
      setEarnedAchievements(prev =>
        prev.map(ua =>
          ua.achievement_id === achievementId
            ? { ...ua, is_showcased: showcase }
            : ua
        )
      );

      toast({
        title: 'Success',
        description: showcase ? 'Achievement added to showcase' : 'Achievement removed from showcase'
      });
    } catch (error) {
      console.error('Error updating showcase:', error);
      toast({
        title: 'Error',
        description: 'Failed to update showcase',
        variant: 'destructive'
      });
    }
  };

  const handleShare = async (achievementId: number) => {
    try {
      const data = await achievementApi.shareAchievement(achievementId);
      
      if (navigator.share) {
        await navigator.share({
          title: 'Achievement Unlocked!',
          text: data.share_text || 'Check out my achievement!',
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(data.share_text || 'Check out my achievement!');
        toast({
          title: 'Copied!',
          description: 'Achievement text copied to clipboard'
        });
      }
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  const startQuest = async (questId: number) => {
    try {
      await achievementApi.startQuest(questId);
      await loadData(); // Reload to update quests
      toast({
        title: 'Quest Started!',
        description: 'Good luck on your new quest!'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to start quest',
        variant: 'destructive'
      });
    }
  };

  // Filter achievements
  const filteredAchievements = (achievements || []).filter(achievement => {
    if (selectedCategory !== 'all' && achievement.category !== selectedCategory) return false;
    if (filterTier !== 'all' && achievement.tier !== filterTier) return false;
    if (filterRarity !== 'all' && achievement.rarity !== filterRarity) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        achievement.title.toLowerCase().includes(query) ||
        achievement.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const earnedAchievementIds = new Set((earnedAchievements || []).map(ua => ua.achievement.id));
  const earnedFiltered = filteredAchievements.filter(a => earnedAchievementIds.has(a.id));
  const unearnedFiltered = filteredAchievements.filter(a => !earnedAchievementIds.has(a.id));

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 animate-bounce mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold">Loading Achievements</h3>
            <p className="text-gray-600">Getting your progress...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if backend is not available
  if (!loading && (achievements || []).length === 0 && !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Backend Not Running</h3>
            <p className="text-gray-600 mb-4">
              The achievement system backend is not available. Please start the backend server.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
            Achievements & Progress
          </h1>
          <p className="text-gray-600">Track your learning journey and compete with others</p>
        </motion.div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="leaderboards" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Leaderboards
            </TabsTrigger>
            <TabsTrigger value="quests" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Quests
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Points & Level */}
              {points && <PointsLevelDisplay points={points} />}
              
              {/* Streak */}
              {streak && <StreakDisplay streak={streak} />}
              
              {/* Achievement Summary */}
              <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-purple-500" />
                    Achievements
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="font-semibold">
                          {(earnedAchievements || []).length} / {(achievements || []).length}
                        </span>
                      </div>
                      <Progress 
                        value={((earnedAchievements || []).length / Math.max((achievements || []).length, 1)) * 100} 
                        className="h-3"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(summary?.achievements?.by_tier || {}).map(([tier, count]: any) => (
                        <div key={tier} className="flex justify-between p-2 bg-white rounded">
                          <span className="text-gray-600 capitalize">{tier}:</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => setActiveTab('achievements')}
                    >
                      View All Achievements
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Showcased Achievements */}
            {(earnedAchievements || []).filter(ua => ua.is_showcased).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    Showcased Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {(earnedAchievements || [])
                      .filter(ua => ua.is_showcased)
                      .sort((a, b) => a.showcase_order - b.showcase_order)
                      .map(ua => (
                        <AchievementBadge
                          key={ua.id}
                          achievement={ua.achievement}
                          earned={true}
                          earnedData={ua}
                          size="xl"
                          showDetails
                        />
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recently Earned */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recently Earned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(earnedAchievements || []).slice(-5).reverse().map(ua => (
                      <div
                        key={ua.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <AchievementBadge
                          achievement={ua.achievement}
                          earned={true}
                          earnedData={ua}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ua.achievement.title}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(ua.earned_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          +{ua.achievement.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Quests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Active Quests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(quests?.active || []).length > 0 ? (
                      (quests?.active || []).map((quest: Quest) => (
                        <div
                          key={quest.id}
                          className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{quest.title}</p>
                              <p className="text-xs text-gray-600">{quest.difficulty}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {quest.user_progress?.completion_percentage.toFixed(0)}%
                            </Badge>
                          </div>
                          <Progress value={quest.user_progress?.completion_percentage || 0} className="h-2" />
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-sm text-gray-500">
                        No active quests. Start one!
                      </div>
                    )}
                  </div>
                  {(quests?.available || []).length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => setActiveTab('quests')}
                    >
                      View Available Quests
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6 mt-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search achievements..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                      prefix={<Search className="h-4 w-4" />}
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.keys(achievementsByCategory).map(category => (
                        <SelectItem key={category} value={category} className="capitalize">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterTier} onValueChange={setFilterTier}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="diamond">Diamond</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterRarity} onValueChange={setFilterRarity}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Rarity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rarities</SelectItem>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Earned Achievements */}
            {earnedFiltered.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  Earned ({earnedFiltered.length})
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {earnedFiltered.map(achievement => {
                      const earnedData = earnedAchievements.find(ua => ua.achievement.id === achievement.id);
                      return (
                        <AchievementBadge
                          key={achievement.id}
                          achievement={achievement}
                          earned={true}
                          earnedData={earnedData}
                          size="lg"
                          showDetails
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {earnedFiltered.map(achievement => {
                      const earnedData = earnedAchievements.find(ua => ua.achievement.id === achievement.id);
                      return (
                        <AchievementCard
                          key={achievement.id}
                          achievement={achievement}
                          earned={true}
                          earnedData={earnedData}
                          onShare={() => handleShare(achievement.id)}
                          onShowcase={(showcase) => handleShowcaseToggle(achievement.id, showcase)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Unearned Achievements */}
            {unearnedFiltered.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Circle className="h-6 w-6 text-gray-400" />
                  Locked ({unearnedFiltered.length})
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {unearnedFiltered.map(achievement => (
                      <AchievementBadge
                        key={achievement.id}
                        achievement={achievement}
                        earned={false}
                        size="lg"
                        showDetails
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unearnedFiltered.map(achievement => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        earned={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {filteredAchievements.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No achievements found</h3>
                <p className="text-gray-600">Try adjusting your filters</p>
              </div>
            )}
          </TabsContent>

          {/* Leaderboards Tab */}
          <TabsContent value="leaderboards" className="space-y-6 mt-6">
            {/* Leaderboard Selector */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2 flex-wrap">
                  {(leaderboards || []).map((lb: any) => (
                    <Button
                      key={lb.name}
                      variant={selectedLeaderboard?.leaderboard?.name === lb.name ? 'default' : 'outline'}
                      onClick={() => loadLeaderboard(lb.name)}
                    >
                      {lb.title}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard Display */}
            {selectedLeaderboard && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <LeaderboardDisplay
                    leaderboard={selectedLeaderboard.leaderboard}
                    rankings={selectedLeaderboard.rankings}
                    currentUserRank={selectedLeaderboard.user_rank}
                    totalParticipants={selectedLeaderboard.total_participants}
                  />
                </div>
                {selectedLeaderboard.user_rank && (
                  <div>
                    <UserRankCard
                      userRank={selectedLeaderboard.user_rank}
                      totalParticipants={selectedLeaderboard.total_participants}
                      leaderboardName={selectedLeaderboard.leaderboard.name}
                    />
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Quests Tab */}
          <TabsContent value="quests" className="space-y-6 mt-6">
            {/* Active Quests */}
            {(quests?.active || []).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Target className="h-6 w-6 text-blue-500" />
                  Active Quests
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(quests?.active || []).map((quest: Quest) => (
                    <Card key={quest.id} className={`border-2 border-${quest.color_theme}-300`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{quest.title}</h3>
                            <p className="text-sm text-gray-600">{quest.description}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {quest.difficulty}
                          </Badge>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Progress</span>
                            <span className="font-semibold">
                              {quest.user_progress?.completion_percentage.toFixed(0)}%
                            </span>
                          </div>
                          <Progress value={quest.user_progress?.completion_percentage || 0} className="h-3" />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              +{quest.completion_points} pts
                            </Badge>
                            <Badge variant="outline">
                              +{quest.completion_xp} XP
                            </Badge>
                          </div>
                          <div className="text-gray-600">
                            Ends: {new Date(quest.end_date).toLocaleDateString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Available Quests */}
            {(quests?.available || []).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Gift className="h-6 w-6 text-purple-500" />
                  Available Quests
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(quests?.available || []).map((quest: Quest) => (
                    <Card key={quest.id} className="border-2 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <h3 className="font-bold text-lg mb-2">{quest.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{quest.description}</p>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Difficulty:</span>
                            <Badge variant="outline" className="capitalize">{quest.difficulty}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Reward:</span>
                            <span className="font-semibold">+{quest.completion_points} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Participants:</span>
                            <span className="font-semibold">{quest.current_participants}</span>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => startQuest(quest.id)}
                          disabled={!quest.is_available}
                        >
                          Start Quest
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Quests */}
            {(quests?.completed || []).length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  Completed Quests
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(quests?.completed || []).map((quest: Quest) => (
                    <Card key={quest.id} className="border border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">{quest.title}</p>
                            <p className="text-xs text-gray-600">
                              Completed {new Date(quest.user_progress?.completed_at || '').toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(quests?.active || []).length === 0 && (quests?.available || []).length === 0 && (quests?.completed || []).length === 0 && (
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No quests available</h3>
                <p className="text-gray-600">Check back later for new challenges!</p>
              </div>
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Achievement Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Achievement Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Earned:</span>
                      <span className="font-bold">{(earnedAchievements || []).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Available:</span>
                      <span className="font-bold">{(achievements || []).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completion:</span>
                      <span className="font-bold">
                        {(((earnedAchievements || []).length / Math.max((achievements || []).length, 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={((earnedAchievements || []).length / Math.max((achievements || []).length, 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Learning Stats */}
              {streak && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Learning Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Streak:</span>
                        <span className="font-bold">{streak?.current_streak || 0} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Longest Streak:</span>
                        <span className="font-bold">{streak?.longest_streak || 0} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Active Days:</span>
                        <span className="font-bold">{streak?.total_active_days || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lessons Completed:</span>
                        <span className="font-bold">{streak?.total_lessons_completed || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Points Breakdown */}
              {points && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="h-5 w-5 text-blue-500" />
                      Points Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Lessons:</span>
                        <span className="font-semibold">{(points?.lesson_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Quizzes:</span>
                        <span className="font-semibold">{(points?.quiz_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Assignments:</span>
                        <span className="font-semibold">{(points?.assignment_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Streaks:</span>
                        <span className="font-semibold">{(points?.streak_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Achievements:</span>
                        <span className="font-semibold">{(points?.achievement_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bonus:</span>
                        <span className="font-semibold">{(points?.bonus_points || 0).toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between font-bold">
                        <span>Total:</span>
                        <span>{(points?.total_points || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Achievement Unlocked Modal */}
      {unlockedAchievement && (
        <AchievementUnlockedModal
          achievement={unlockedAchievement}
          isOpen={showUnlockedModal}
          onClose={() => {
            setShowUnlockedModal(false);
            setUnlockedAchievement(null);
          }}
        />
      )}
    </div>
  );
};

export default AchievementsPage;

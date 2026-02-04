"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';
import { AchievementApiService } from '@/services/achievementApi';
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
  BarChart3,
  Sparkles
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
    console.log('🎯 Share attempt:', { achievementId, method });
    console.log('📚 Available achievements:', earnedAchievements.map(a => ({ 
      userAchievementId: a.id, 
      achievementId: a.achievement?.id,
      title: a.achievement?.title 
    })));
    
    try {
      // First verify current user and their achievements
      try {
        const userInfo = await AchievementApiService.verifyCurrentUser();
        console.log('👤 Current user info:', userInfo);
        
        if (!userInfo.achievements.includes(achievementId)) {
          console.error('❌ Backend confirms user does not have achievement:', achievementId);
          toast.error(`Achievement ${achievementId} not found in your earned achievements`);
          return;
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify user, proceeding with frontend check:', verifyError);
      }
      
      // Find the specific achievement for sharing - FIXED: use correct nested structure
      const userAchievement = earnedAchievements.find(ua => ua.achievement?.id === achievementId);
      if (!userAchievement || !userAchievement.achievement) {
        console.error('❌ Achievement not found in earnedAchievements:', achievementId);
        console.error('❌ Available achievement IDs:', earnedAchievements.map(ua => ua.achievement?.id).filter(Boolean));
        toast.error('You can only share achievements you have earned');
        return;
      }
      
      const achievement = userAchievement.achievement;
      console.log('✅ Found achievement to share:', achievement.title);
      
      // Track the share in backend first
      const shareData = await AchievementApiService.shareAchievement(achievementId, method);
      
      // Create enhanced share content
      const baseUrl = window.location.origin;
      const achievementUrl = `${baseUrl}/achievements/${achievementId}`;
      const shareText = shareData.share_text || `🏆 I just earned "${achievement.title}"! ${achievement.description}`;
      const hashtags = ['Learning', 'Achievement', 'Progress', achievement.category]
        .map(tag => tag.replace(/\s+/g, ''))
        .join(',');
      
      // Validate method parameter
      if (!method || typeof method !== 'string' || method.trim() === '') {
        console.error('❌ Invalid share method:', method);
        toast.error('Invalid sharing method');
        return;
      }
      
      // Handle different sharing methods
      switch (method.toLowerCase()) {
        case 'copy':
          await navigator.clipboard.writeText(`${shareText}\n\n🔗 ${achievementUrl}`);
          toast.success('Achievement details copied to clipboard!');
          break;
          
        case 'twitter':
          const twitterText = encodeURIComponent(`${shareText} #${hashtags}`);
          const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(achievementUrl)}`;
          window.open(twitterUrl, '_blank', 'width=600,height=400');
          break;
          
        case 'linkedin':
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(achievementUrl)}&title=${encodeURIComponent(achievement.title)}&summary=${encodeURIComponent(achievement.description)}`;
          window.open(linkedinUrl, '_blank', 'width=600,height=600');
          break;
          
        case 'whatsapp':
          const whatsappText = `${shareText}\n\n${achievementUrl}`;
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
          window.open(whatsappUrl, '_blank');
          break;
          
        case 'facebook':
          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(achievementUrl)}&quote=${encodeURIComponent(shareText)}`;
          window.open(facebookUrl, '_blank', 'width=600,height=400');
          break;
          
        case 'email':
          const emailSubject = encodeURIComponent(`Check out my latest achievement: ${achievement.title}`);
          const emailBody = encodeURIComponent(`${shareText}\n\nView my achievement: ${achievementUrl}`);
          window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
          break;
          
        case 'native':
          if (navigator.share) {
            await navigator.share({
              title: `Achievement Unlocked: ${achievement.title}`,
              text: shareText,
              url: achievementUrl
            });
          } else {
            throw new Error('Native sharing not supported');
          }
          break;
          
        default:
          toast.error(`Sharing method '${method}' not supported`);
          return;
      }
      
      // Show success with share count
      toast.success(`Achievement shared via ${method}! (Total shares: ${shareData.shared_count})`);
      
    } catch (error: any) {
      console.error('Share error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to share achievement';
      toast.error(errorMessage);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 rounded-2xl p-8 text-white"
        >
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <motion.h1 
                  className="text-4xl md:text-5xl font-bold mb-3"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  🏆 Achievement Central
                </motion.h1>
                <p className="text-blue-100 text-lg md:text-xl max-w-2xl">
                  Celebrate your learning journey, unlock incredible rewards, and compete with fellow learners
                </p>
              </div>
              
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">{stats.earned_count}</div>
                  <div className="text-blue-200">Unlocked</div>
                </div>
                <Separator orientation="vertical" className="h-12 bg-blue-300/30" />
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">{stats.completion_rate}%</div>
                  <div className="text-blue-200">Complete</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-4 text-6xl">🌟</div>
            <div className="absolute top-12 right-12 text-4xl">✨</div>
            <div className="absolute bottom-8 left-12 text-5xl">🎯</div>
            <div className="absolute bottom-4 right-6 text-3xl">🚀</div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-yellow-400 to-orange-500">
              <CardContent className="p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 text-sm font-medium uppercase tracking-wide">Total Points</p>
                    <p className="text-3xl font-bold">{points?.total_points?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <Star className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-400 to-red-500">
              <CardContent className="p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">Current Streak</p>
                    <p className="text-3xl font-bold">{streak?.current_streak || 0}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <Flame className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <CardContent className="p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium uppercase tracking-wide">Current Level</p>
                    <p className="text-3xl font-bold">{points?.current_level || 1}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <Crown className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-500 to-teal-500">
              <CardContent className="p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Global Rank</p>
                    <p className="text-3xl font-bold">#47</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Level Progress */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Level Progress</h3>
                  <p className="text-muted-foreground">
                    Level {points?.current_level || 1} → Level {(points?.current_level || 1) + 1}
                  </p>
                </div>
                <Badge variant="outline" className="text-sm">
                  {points?.xp_progress || 0} / {points?.xp_to_next_level || 1000} XP
                </Badge>
              </div>
              <Progress value={((points?.xp_progress || 0) / (points?.xp_to_next_level || 1000)) * 100} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto p-1 bg-white border">
            <TabsTrigger value="showcase" className="flex items-center gap-2 py-3">
              <Trophy className="h-4 w-4" />
              Achievement Gallery
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2 py-3">
              <Users className="h-4 w-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2 py-3">
              <BarChart3 className="h-4 w-4" />
              Progress Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="showcase" className="mt-8">
            <AchievementShowcase
              achievements={achievements}
              earnedAchievements={earnedAchievements}
              onShare={handleShare}
              onToggleShowcase={handleToggleShowcase}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-8">
            <AchievementLeaderboard />
          </TabsContent>

          <TabsContent value="progress" className="mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Achievement Categories Progress */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Category Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {['learning', 'speed', 'consistency', 'mastery', 'social'].map((category, index) => {
                    const categoryAchievements = achievements.filter(a => a.category === category);
                    const earnedInCategory = earnedAchievements.filter(ea => 
                      categoryAchievements.some(ca => ca.id === ea.achievement?.id)
                    ).length;
                    const progress = categoryAchievements.length > 0 
                      ? (earnedInCategory / categoryAchievements.length) * 100 
                      : 0;

                    return (
                      <div key={category}>
                        <div className="flex justify-between mb-2">
                          <span className="font-medium capitalize">{category}</span>
                          <span className="text-sm text-muted-foreground">
                            {earnedInCategory}/{categoryAchievements.length}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Recent Achievements */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Recent Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {earnedAchievements
                      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
                      .slice(0, 5)
                      .map((achievement) => (
                        <div key={achievement.id} className="flex items-center gap-3">
                          <CreativeAchievementBadge
                            achievement={achievement.achievement!}
                            earned={true}
                            variant="mini"
                            size="sm"
                            showSharing={false}
                          />
                          <div className="flex-1">
                            <h4 className="font-medium">{achievement.achievement?.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              Earned {new Date(achievement.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    {earnedAchievements.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No achievements yet. Start learning to unlock your first achievement!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Achievement Celebration Modal */}
        <AchievementCelebration
          rewards={pendingRewards}
          isVisible={showRewardsModal}
          onClose={clearPendingRewards}
          onShare={handleShare}
        />
      </div>
    </div>
  );
};

export default AchievementsPage;
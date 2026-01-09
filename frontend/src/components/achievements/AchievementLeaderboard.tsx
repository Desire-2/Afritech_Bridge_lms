import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Medal, 
  Crown, 
  Star, 
  Flame, 
  TrendingUp,
  Users,
  Calendar,
  Filter,
  RefreshCw,
  User,
  Award,
  Target,
  Zap,
  Clock,
  ChevronUp,
  ChevronDown,
  Eye,
  UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AchievementApiService } from '@/services/achievementApi';
import { toast } from 'sonner';

interface LeaderboardEntry {
  user_id: number;
  username: string;
  profile_picture_url?: string;
  first_name?: string;
  last_name?: string;
  score: number;
  rank: number;
  achievements_count: number;
  current_streak: number;
  level: number;
  recent_activity?: string;
  trend?: 'up' | 'down' | 'same';
  change?: number;
}

interface Leaderboard {
  name: string;
  display_name: string;
  description: string;
  entries: LeaderboardEntry[];
  user_position?: number;
  total_participants: number;
  last_updated: string;
}

interface AchievementLeaderboardProps {
  className?: string;
}

const AchievementLeaderboard: React.FC<AchievementLeaderboardProps> = ({ className = '' }) => {
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [currentLeaderboard, setCurrentLeaderboard] = useState<string>('points');
  const [timeFilter, setTimeFilter] = useState<string>('all_time');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');

  useEffect(() => {
    fetchLeaderboards();
  }, [currentLeaderboard, timeFilter]);

  const fetchLeaderboards = async () => {
    try {
      setRefreshing(true);
      const response = await AchievementApiService.getLeaderboard(currentLeaderboard, 50);
      
      // Mock additional leaderboard data for enhanced features
      const enhancedEntries = response.leaderboard.map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1,
        trend: ['up', 'down', 'same'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'same',
        change: Math.floor(Math.random() * 10) + 1,
        recent_activity: ['Completed quiz', 'Earned achievement', 'Finished course', 'Started project'][Math.floor(Math.random() * 4)]
      }));

      const leaderboardData: Leaderboard = {
        name: currentLeaderboard,
        display_name: getLeaderboardDisplayName(currentLeaderboard),
        description: getLeaderboardDescription(currentLeaderboard),
        entries: enhancedEntries,
        user_position: response.user_position,
        total_participants: response.total_users || enhancedEntries.length,
        last_updated: new Date().toISOString()
      };

      setLeaderboards([leaderboardData]);
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getLeaderboardDisplayName = (name: string): string => {
    const names: { [key: string]: string } = {
      'points': 'Points Leaders',
      'achievements': 'Achievement Masters',
      'streaks': 'Streak Champions',
      'weekly': 'Weekly Stars',
      'monthly': 'Monthly Heroes'
    };
    return names[name] || 'Leaderboard';
  };

  const getLeaderboardDescription = (name: string): string => {
    const descriptions: { [key: string]: string } = {
      'points': 'Top learners by total points earned',
      'achievements': 'Most achievements unlocked',
      'streaks': 'Longest learning streaks',
      'weekly': 'Top performers this week',
      'monthly': 'Monthly achievement leaders'
    };
    return descriptions[name] || 'Leaderboard rankings';
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return (
          <div className="h-6 w-6 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-600">{rank}</span>
          </div>
        );
    }
  };

  const getTrendIcon = (trend: string, change: number) => {
    switch (trend) {
      case 'up':
        return (
          <div className="flex items-center text-green-600">
            <ChevronUp className="h-4 w-4" />
            <span className="text-xs">+{change}</span>
          </div>
        );
      case 'down':
        return (
          <div className="flex items-center text-red-600">
            <ChevronDown className="h-4 w-4" />
            <span className="text-xs">-{change}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center text-gray-500">
            <span className="text-xs">—</span>
          </div>
        );
    }
  };

  const getInitials = (entry: LeaderboardEntry) => {
    if (entry.first_name && entry.last_name) {
      return `${entry.first_name[0]}${entry.last_name[0]}`.toUpperCase();
    }
    return entry.username[0]?.toUpperCase() || 'U';
  };

  const currentLeaderboardData = leaderboards.find(lb => lb.name === currentLeaderboard);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Achievement Leaderboard
          </h2>
          <p className="text-muted-foreground">
            {currentLeaderboardData?.description}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={currentLeaderboard} onValueChange={setCurrentLeaderboard}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points">Points Leaders</SelectItem>
              <SelectItem value="achievements">Achievement Masters</SelectItem>
              <SelectItem value="streaks">Streak Champions</SelectItem>
              <SelectItem value="weekly">Weekly Stars</SelectItem>
              <SelectItem value="monthly">Monthly Heroes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_time">All Time</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLeaderboards}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* User's Position Card */}
      {currentLeaderboardData?.user_position && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-600">Your Rank</Badge>
                <div className="text-lg font-semibold">
                  #{currentLeaderboardData.user_position}
                </div>
                <div className="text-sm text-muted-foreground">
                  of {currentLeaderboardData.total_participants} participants
                </div>
              </div>
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              {currentLeaderboardData?.display_name}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'detailed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('detailed')}
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('compact')}
              >
                Compact
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Last updated: {currentLeaderboardData?.last_updated && 
              new Date(currentLeaderboardData.last_updated).toLocaleTimeString()}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {currentLeaderboardData?.entries && currentLeaderboardData.entries.length > 0 ? (
            <div className="space-y-1">
              {currentLeaderboardData.entries.map((entry, index) => (
                <motion.div
                  key={`${entry.user_id}-${entry.rank}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    p-4 border-l-4 hover:bg-gray-50 transition-colors cursor-pointer
                    ${entry.rank === 1 ? 'border-l-yellow-400 bg-yellow-50' : 
                      entry.rank === 2 ? 'border-l-gray-400 bg-gray-50' :
                      entry.rank === 3 ? 'border-l-amber-400 bg-amber-50' :
                      'border-l-transparent'}
                  `}
                >
                  {viewMode === 'detailed' ? (
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-12 flex justify-center">
                        {getRankIcon(entry.rank)}
                      </div>

                      {/* User Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={entry.profile_picture_url} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-600 text-white">
                            {getInitials(entry)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {entry.first_name && entry.last_name 
                                ? `${entry.first_name} ${entry.last_name}`
                                : entry.username
                              }
                            </span>
                            {entry.rank <= 3 && (
                              <Badge variant="secondary" className="text-xs">
                                {entry.rank === 1 ? 'Champion' : entry.rank === 2 ? 'Runner-up' : 'Bronze'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            Level {entry.level} • {entry.achievements_count} achievements
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-lg">
                            {entry.score.toLocaleString()}
                          </div>
                          <div className="text-muted-foreground">
                            {currentLeaderboard === 'points' ? 'Points' :
                             currentLeaderboard === 'achievements' ? 'Achievements' :
                             currentLeaderboard === 'streaks' ? 'Days' : 'Score'}
                          </div>
                        </div>

                        <Separator orientation="vertical" className="h-8" />

                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1 text-orange-600">
                            <Flame className="h-4 w-4" />
                            <span className="font-semibold">{entry.current_streak}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">streak</div>
                        </div>

                        <Separator orientation="vertical" className="h-8" />

                        <div className="text-center min-w-16">
                          {getTrendIcon(entry.trend || 'same', entry.change || 0)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Compact View
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          {entry.rank <= 3 ? getRankIcon(entry.rank) : (
                            <span className="text-sm font-semibold text-gray-600">
                              {entry.rank}
                            </span>
                          )}
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.profile_picture_url} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-600 text-white text-xs">
                            {getInitials(entry)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {entry.first_name && entry.last_name 
                              ? `${entry.first_name} ${entry.last_name}`
                              : entry.username
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Level {entry.level}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold">
                            {entry.score.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {currentLeaderboard === 'points' ? 'pts' :
                             currentLeaderboard === 'achievements' ? 'achievements' : 'days'}
                          </div>
                        </div>
                        {getTrendIcon(entry.trend || 'same', entry.change || 0)}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No rankings yet</h3>
              <p className="text-muted-foreground">
                Be the first to appear on the leaderboard by earning achievements!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievement Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Next Rank</span>
              <span>75% to #12</span>
            </div>
            <Progress value={75} className="h-2" />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">1,247</div>
              <div className="text-sm text-muted-foreground">Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">8</div>
              <div className="text-sm text-muted-foreground">Achievements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">12</div>
              <div className="text-sm text-muted-foreground">Day Streak</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AchievementLeaderboard;
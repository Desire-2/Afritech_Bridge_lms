import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Filter, 
  Grid3X3, 
  List, 
  Search, 
  RotateCcw,
  Star,
  Flame,
  TrendingUp,
  Award,
  Crown,
  Sparkles,
  Eye,
  Users,
  Calendar,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import CreativeAchievementBadge from './CreativeAchievementBadge';
import { toast } from 'sonner';

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
  progress?: number;
  max_progress?: number;
  is_showcased?: boolean;
}

interface UserAchievement extends Achievement {
  earned_at: string;
  unlock_order?: number;
}

interface AchievementShowcaseProps {
  achievements: Achievement[];
  earnedAchievements: UserAchievement[];
  onShare?: (achievementId: number, method: string) => void;
  onToggleShowcase?: (achievementId: number, showcase: boolean) => Promise<void>;
  loading?: boolean;
}

const AchievementShowcase: React.FC<AchievementShowcaseProps> = ({
  achievements = [],
  earnedAchievements = [],
  onShare,
  onToggleShowcase,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('earned_date');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Combine achievements with earned status
  const combinedAchievements = achievements.map(achievement => {
    const earned = earnedAchievements.find(ea => ea.achievement?.id === achievement.id);
    return {
      ...achievement,
      earned: !!earned,
      earned_at: earned?.earned_at,
      unlock_order: earned?.showcase_order,
      is_showcased: earned?.is_showcased || false
    };
  });

  // Filter and sort achievements
  const filteredAchievements = combinedAchievements
    .filter(achievement => {
      const matchesSearch = achievement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          achievement.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || achievement.category === filterCategory;
      const matchesTier = filterTier === 'all' || achievement.tier === filterTier;
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'earned' && achievement.earned) ||
                           (filterStatus === 'unearned' && !achievement.earned) ||
                           (filterStatus === 'showcased' && achievement.is_showcased);
      
      return matchesSearch && matchesCategory && matchesTier && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'earned_date':
          if (a.earned && b.earned) {
            return new Date(b.earned_at!).getTime() - new Date(a.earned_at!).getTime();
          }
          return b.earned ? 1 : -1;
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'tier':
          const tierOrder = { diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1 };
          return (tierOrder[b.tier as keyof typeof tierOrder] || 0) - (tierOrder[a.tier as keyof typeof tierOrder] || 0);
        case 'points':
          return b.points_value - a.points_value;
        case 'rarity':
          const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
          return (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0) - (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0);
        default:
          return 0;
      }
    });

  // Statistics
  const stats = {
    total: achievements.length,
    earned: earnedAchievements.length,
    completion: achievements.length > 0 ? Math.round((earnedAchievements.length / achievements.length) * 100) : 0,
    totalPoints: earnedAchievements.reduce((sum, achievement) => sum + achievement.points_value, 0),
    showcased: earnedAchievements.filter(achievement => achievement.is_showcased).length
  };

  // Categories and tiers for filters
  const categories = [...new Set(achievements.map(a => a.category))];
  const tiers = [...new Set(achievements.map(a => a.tier))];

  const resetFilters = () => {
    setFilterCategory('all');
    setFilterTier('all');
    setFilterStatus('all');
    setSearchQuery('');
    setSortBy('earned_date');
  };

  // Enhanced Achievement Detail Modal
  const AchievementDetailModal = ({ achievement }: { achievement: Achievement }) => (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setSelectedAchievement(null)}
    >
      <motion.div
        className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="text-center mb-6">
            <CreativeAchievementBadge
              achievement={achievement}
              earned={achievement.earned}
              size="xl"
              variant="showcase"
              showSharing={achievement.earned}
              onShare={onShare}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-100">{achievement.title}</h2>
              <p className="text-slate-300 text-lg">{achievement.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Category</span>
                  <Badge variant="outline" className="bg-slate-700 border-slate-600 text-slate-100">{achievement.category}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Tier</span>
                  <Badge className="bg-slate-600 text-slate-100">{achievement.tier}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Rarity</span>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-200">{achievement.rarity}</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Points</span>
                  <span className="font-semibold text-slate-100">{achievement.points_value}</span>
                </div>
                {achievement.earned && achievement.earned_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-300">Earned</span>
                    <span className="font-semibold text-slate-100">
                      {new Date(achievement.earned_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {achievement.unlock_order && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-300">Unlock #</span>
                    <span className="font-semibold text-slate-100">{achievement.unlock_order}</span>
                  </div>
                )}
              </div>
            </div>

            {achievement.earned && onToggleShowcase && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => onToggleShowcase(achievement.id, !achievement.is_showcased)}
                  variant={achievement.is_showcased ? "default" : "outline"}
                  className="w-full"
                >
                  {achievement.is_showcased ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Remove from Showcase
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Add to Showcase
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="md:col-span-1 border-slate-700 bg-slate-800">
          <CardContent className="p-4 text-center">
            <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-100">{stats.earned}</div>
            <div className="text-sm text-slate-300">Earned</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-1 border-slate-700 bg-slate-800">
          <CardContent className="p-4 text-center">
            <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
            <div className="text-sm text-slate-300">Total</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-1 border-slate-700 bg-slate-800">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-100">{stats.completion}%</div>
            <div className="text-sm text-slate-300">Complete</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-1 border-slate-700 bg-slate-800">
          <CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-100">{stats.totalPoints}</div>
            <div className="text-sm text-slate-300">Points</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-1 border-slate-700 bg-slate-800">
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-100">{stats.showcased}</div>
            <div className="text-sm text-slate-300">Showcased</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="border-slate-700 bg-slate-800">
        <CardContent className="p-6 bg-slate-800">
          <div className="space-y-4">
            {/* Search and View Controls */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search achievements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger>
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {tiers.map(tier => (
                    <SelectItem key={tier} value={tier}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="earned">Earned</SelectItem>
                  <SelectItem value="unearned">Unearned</SelectItem>
                  <SelectItem value="showcased">Showcased</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earned_date">Earned Date</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="tier">Tier</SelectItem>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-slate-300 flex items-center">
                {filteredAchievements.length} results
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Grid/List */}
      <AnimatePresence>
        {filteredAchievements.length > 0 ? (
          <motion.div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {filteredAchievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <CreativeAchievementBadge
                  achievement={achievement}
                  earned={achievement.earned}
                  variant={viewMode === 'list' ? 'compact' : 'card'}
                  size={viewMode === 'list' ? 'sm' : 'md'}
                  showProgress={!achievement.earned}
                  showSharing={achievement.earned}
                  onClick={() => setSelectedAchievement(achievement)}
                  onShare={onShare}
                  onToggleShowcase={onToggleShowcase ? () => onToggleShowcase(achievement.id, !achievement.is_showcased) : undefined}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-slate-100">No achievements found</h3>
            <p className="text-slate-300 mb-4">
              Try adjusting your filters or search criteria
            </p>
            <Button onClick={resetFilters} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <AchievementDetailModal achievement={selectedAchievement} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AchievementShowcase;
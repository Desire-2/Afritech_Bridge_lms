"use client";

// Leaderboard Components - Competitive ranking displays
// Beautiful leaderboards with animations and user positioning

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Crown, Medal, TrendingUp, Users, Star, Zap, Award,
  ChevronUp, ChevronDown, Minus, Target, Flame, Brain
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { Leaderboard, LeaderboardRanking } from '@/services/achievementApi';

// ==================== Rank Medal Component ====================

interface RankMedalProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
}

const RankMedal: React.FC<RankMedalProps> = ({ rank, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  if (rank === 1) {
    return (
      <motion.div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 
          flex items-center justify-center shadow-xl relative overflow-hidden`}
        animate={{
          boxShadow: [
            '0 0 20px rgba(234, 179, 8, 0.5)',
            '0 0 40px rgba(234, 179, 8, 0.8)',
            '0 0 20px rgba(234, 179, 8, 0.5)'
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity
        }}
      >
        <Crown className="h-5 w-5 text-white" />
        <motion.div
          className="absolute inset-0 bg-white/30"
          animate={{
            rotate: 360
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </motion.div>
    );
  }

  if (rank === 2) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-gray-300 to-gray-400 
        flex items-center justify-center shadow-lg`}>
        <Medal className="h-5 w-5 text-white" />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-amber-600 to-amber-700 
        flex items-center justify-center shadow-lg`}>
        <Medal className="h-5 w-5 text-white" />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 
      flex items-center justify-center text-white font-bold shadow-md`}>
      {rank}
    </div>
  );
};

// ==================== Leaderboard Row Component ====================

interface LeaderboardRowProps {
  ranking: LeaderboardRanking;
  isCurrentUser?: boolean;
  metric: string;
  showChange?: boolean;
  index: number;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  ranking,
  isCurrentUser = false,
  metric,
  showChange = false,
  index
}) => {
  const getMetricLabel = (metric: string) => {
    const labels: { [key: string]: string } = {
      total_points: 'pts',
      current_level: 'lvl',
      streak_days: 'days',
      courses_completed: 'courses',
      assignments_completed: 'assignments'
    };
    return labels[metric] || 'score';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-lg transition-all
        ${isCurrentUser 
          ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-400 shadow-lg' 
          : 'bg-white hover:bg-gray-50 border border-gray-200'
        }`}
    >
      {/* Rank Badge */}
      <div className="flex-shrink-0">
        <RankMedal rank={ranking.rank} />
      </div>

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
            {ranking.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold truncate ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
              {ranking.name}
            </p>
            {isCurrentUser && (
              <Badge variant="default" className="text-xs">You</Badge>
            )}
            {ranking.rank <= 3 && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <p className="text-sm text-gray-600 truncate">@{ranking.username}</p>
        </div>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <div className={`text-xl font-bold ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
          {ranking.score.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">{getMetricLabel(metric)}</div>
      </div>

      {/* Period Score (for weekly/monthly) */}
      {ranking.period_score !== undefined && (
        <div className="text-right flex-shrink-0 text-sm">
          <div className="font-semibold text-green-600">
            +{ranking.period_score.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">this period</div>
        </div>
      )}
    </motion.div>
  );
};

// ==================== Leaderboard Component ====================

interface LeaderboardDisplayProps {
  leaderboard: Leaderboard;
  rankings: LeaderboardRanking[];
  currentUserRank?: LeaderboardRanking;
  totalParticipants: number;
}

export const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({
  leaderboard,
  rankings,
  currentUserRank,
  totalParticipants
}) => {
  const getIcon = (metric: string) => {
    const icons: { [key: string]: any } = {
      total_points: Trophy,
      current_level: Star,
      streak_days: Flame,
      courses_completed: Award,
      quiz_score: Brain,
      assignments_completed: Target
    };
    return icons[metric] || Trophy;
  };

  const IconComponent = getIcon(leaderboard.metric);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-${leaderboard.color}-400 to-${leaderboard.color}-600 
              flex items-center justify-center`}>
              <IconComponent className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">{leaderboard.title}</CardTitle>
              {leaderboard.description && (
                <p className="text-sm text-gray-600 mt-1">{leaderboard.description}</p>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              <span className="text-sm">{totalParticipants} participants</span>
            </div>
            <Badge variant="outline" className="mt-1 capitalize">
              {leaderboard.time_period.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Current User Position (if not in top rankings) */}
        {currentUserRank && currentUserRank.rank > rankings.length && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Your Position:</p>
            <LeaderboardRow
              ranking={currentUserRank}
              isCurrentUser={true}
              metric={leaderboard.metric}
              index={0}
            />
          </div>
        )}

        {/* Top Rankings */}
        <div className="space-y-2">
          {rankings.map((ranking, index) => (
            <LeaderboardRow
              key={ranking.user_id}
              ranking={ranking}
              isCurrentUser={currentUserRank?.user_id === ranking.user_id}
              metric={leaderboard.metric}
              index={index}
            />
          ))}
        </div>

        {/* No Rankings */}
        {rankings.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No rankings yet. Be the first!</p>
          </div>
        )}

        {/* Last Updated */}
        <div className="mt-4 pt-4 border-t text-center text-xs text-gray-500">
          Last updated: {new Date(leaderboard.last_updated).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== Compact Leaderboard Widget ====================

interface LeaderboardWidgetProps {
  rankings: LeaderboardRanking[];
  title: string;
  metric: string;
  currentUserId?: number;
}

export const LeaderboardWidget: React.FC<LeaderboardWidgetProps> = ({
  rankings,
  title,
  metric,
  currentUserId
}) => {
  const top3 = rankings.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {top3.map((ranking, index) => (
            <div
              key={ranking.user_id}
              className={`flex items-center gap-2 p-2 rounded ${
                ranking.user_id === currentUserId ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
              }`}
            >
              <RankMedal rank={ranking.rank} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ranking.name}</p>
              </div>
              <div className="text-sm font-bold">{ranking.score}</div>
            </div>
          ))}
        </div>

        {rankings.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500">
            No rankings yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== User Rank Card ====================

interface UserRankCardProps {
  userRank: LeaderboardRanking;
  totalParticipants: number;
  leaderboardName: string;
}

export const UserRankCard: React.FC<UserRankCardProps> = ({
  userRank,
  totalParticipants,
  leaderboardName
}) => {
  const percentile = ((totalParticipants - userRank.rank) / totalParticipants) * 100;

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Your Ranking</h3>
          <Badge variant="secondary" className="text-lg font-bold">
            #{userRank.rank}
          </Badge>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <RankMedal rank={userRank.rank} size="lg" />
          <div className="flex-1">
            <div className="text-3xl font-bold text-blue-900">
              {userRank.score.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Score</div>
          </div>
        </div>

        {/* Percentile */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Top {percentile.toFixed(1)}%</span>
            <span className="font-semibold">of {totalParticipants} participants</span>
          </div>
          <Progress value={100 - percentile} className="h-2" />
        </div>

        {/* Rank Change Indicator */}
        <div className="flex items-center justify-center gap-2 p-3 bg-white rounded-lg">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <span className="text-sm font-semibold text-gray-700">
            Keep learning to climb the ranks!
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

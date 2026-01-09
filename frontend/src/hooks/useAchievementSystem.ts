import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AchievementApiService, Achievement, UserAchievement, LearningStreak, StudentPoints } from '@/services/achievementApi';
import { toast } from 'sonner';

interface AchievementEvent {
  type: 'lesson_complete' | 'quiz_pass' | 'assignment_submit' | 'course_complete' | 'streak_update' | 'perfect_score' | 'fast_completion';
  data: any;
}

interface NewRewards {
  achievements: UserAchievement[];
  levelUp?: {
    new_level: number;
    previous_level: number;
    xp_earned: number;
    rewards?: string[];
  };
  streakMilestone?: {
    days: number;
    reward_points: number;
    special_message: string;
  };
  badges?: any[];
  points_earned: number;
}

interface UseAchievementSystemReturn {
  // State
  achievements: Achievement[];
  earnedAchievements: UserAchievement[];
  streak: LearningStreak | null;
  points: StudentPoints | null;
  loading: boolean;
  
  // Rewards queue
  pendingRewards: NewRewards | null;
  showRewardsModal: boolean;
  
  // Actions
  triggerEvent: (event: AchievementEvent) => Promise<NewRewards | null>;
  refreshData: () => Promise<void>;
  clearPendingRewards: () => void;
  toggleShowcase: (achievementId: number, showcase: boolean) => Promise<void>;
  shareAchievement: (achievementId: number) => Promise<void>;
  
  // Quick stats
  getQuickStats: () => {
    total_achievements: number;
    earned_count: number;
    completion_rate: number;
    current_streak: number;
    total_points: number;
    current_level: number;
    global_rank?: number;
  };
}

export const useAchievementSystem = (): UseAchievementSystemReturn => {
  const { user, isAuthenticated } = useAuth();
  
  // Core data state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<UserAchievement[]>([]);
  const [streak, setStreak] = useState<LearningStreak | null>(null);
  const [points, setPoints] = useState<StudentPoints | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Rewards state
  const [pendingRewards, setPendingRewards] = useState<NewRewards | null>(null);
  const [showRewardsModal, setShowRewardsModal] = useState(false);

  // Load initial data
  const loadAchievementData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const [
        achievementsData,
        earnedData,
        streakData,
        pointsData
      ] = await Promise.all([
        AchievementApiService.getAllAchievements(),
        AchievementApiService.getEarnedAchievements(),
        AchievementApiService.getStreak(),
        AchievementApiService.getPoints()
      ]);

      if (achievementsData.success) {
        setAchievements(achievementsData.achievements);
      }
      
      if (earnedData.success) {
        setEarnedAchievements(earnedData.achievements);
      }
      
      if (streakData.success) {
        setStreak(streakData.streak);
      }
      
      if (pointsData.points) {
        setPoints(pointsData.points);
      }
    } catch (error) {
      console.error('Error loading achievement data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    loadAchievementData();
  }, [loadAchievementData]);

  // Trigger achievement event
  const triggerEvent = async (event: AchievementEvent): Promise<NewRewards | null> => {
    if (!isAuthenticated) return null;

    try {
      // Update streak if it's a lesson completion
      if (event.type === 'lesson_complete') {
        const streakUpdate = await AchievementApiService.updateStreak();
        if (streakUpdate.current_streak > (streak?.current_streak || 0)) {
          setStreak(prev => prev ? { ...prev, current_streak: streakUpdate.current_streak } : null);
          
          // Check for streak milestones
          const newMilestones = streakUpdate.new_milestones || [];
          if (newMilestones.length > 0) {
            // Create streak milestone reward
            const milestone = newMilestones[newMilestones.length - 1]; // Latest milestone
            const streakReward = {
              days: milestone,
              reward_points: milestone * 10, // 10 points per day
              special_message: `Incredible! You've maintained a ${milestone}-day learning streak! 🔥`
            };
            
            const newRewards: NewRewards = {
              achievements: streakUpdate.new_achievements || [],
              streakMilestone: streakReward,
              points_earned: streakReward.reward_points
            };
            
            setPendingRewards(newRewards);
            setShowRewardsModal(true);
            return newRewards;
          }
        }
      }

      // Trigger general achievement check
      const result = await AchievementApiService.triggerAchievementCheck(event.type, event.data);
      
      if (result.new_achievements.length > 0 || result.new_milestones.length > 0) {
        // Calculate total points earned
        const pointsEarned = result.new_achievements.reduce((total, ua) => total + ua.achievement.points, 0) +
                           result.new_milestones.reduce((total, m) => total + m.points_reward, 0);

        // Check for level up
        let levelUpData = undefined;
        const currentLevel = points?.current_level || 1;
        
        // Refresh points to check for level changes
        const updatedPoints = await AchievementApiService.getPoints();
        if (updatedPoints.points && updatedPoints.points.current_level > currentLevel) {
          levelUpData = {
            new_level: updatedPoints.points.current_level,
            previous_level: currentLevel,
            xp_earned: pointsEarned, // Approximate XP from points
            rewards: [`Access to Level ${updatedPoints.points.current_level} content`]
          };
          setPoints(updatedPoints.points);
        }

        const newRewards: NewRewards = {
          achievements: result.new_achievements,
          levelUp: levelUpData,
          points_earned: pointsEarned
        };

        // Update local state
        setEarnedAchievements(prev => [...prev, ...result.new_achievements]);
        
        // Show rewards
        setPendingRewards(newRewards);
        setShowRewardsModal(true);
        
        return newRewards;
      }
    } catch (error) {
      console.error('Error triggering achievement event:', error);
      toast.error('Failed to process achievement event');
    }

    return null;
  };

  // Refresh all data
  const refreshData = async () => {
    await loadAchievementData();
  };

  // Clear pending rewards
  const clearPendingRewards = () => {
    setPendingRewards(null);
    setShowRewardsModal(false);
  };

  // Toggle achievement showcase
  const toggleShowcase = async (achievementId: number, showcase: boolean) => {
    try {
      await AchievementApiService.toggleShowcase(achievementId, showcase);
      setEarnedAchievements(prev => 
        prev.map(ea => 
          ea.achievement.id === achievementId 
            ? { ...ea, is_showcased: showcase }
            : ea
        )
      );
      toast.success(showcase ? 'Added to showcase' : 'Removed from showcase');
    } catch (error) {
      console.error('Error toggling showcase:', error);
      toast.error('Failed to update showcase');
    }
  };

  // Share achievement
  const shareAchievement = async (achievementId: number) => {
    try {
      const response = await AchievementApiService.shareAchievement(achievementId);
      
      if (navigator.share) {
        await navigator.share({
          title: 'Achievement Unlocked!',
          text: response.share_text || 'I just unlocked a new achievement!',
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(response.share_text || 'Achievement unlocked!');
        toast.success('Achievement text copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing achievement:', error);
      toast.error('Failed to share achievement');
    }
  };

  // Get quick stats
  const getQuickStats = () => {
    return {
      total_achievements: achievements.length,
      earned_count: earnedAchievements.length,
      completion_rate: achievements.length > 0 ? Math.round((earnedAchievements.length / achievements.length) * 100) : 0,
      current_streak: streak?.current_streak || 0,
      total_points: points?.total_points || 0,
      current_level: points?.current_level || 1,
      global_rank: points?.global_rank
    };
  };

  return {
    // State
    achievements,
    earnedAchievements,
    streak,
    points,
    loading,
    
    // Rewards
    pendingRewards,
    showRewardsModal,
    
    // Actions
    triggerEvent,
    refreshData,
    clearPendingRewards,
    toggleShowcase,
    shareAchievement,
    
    // Utils
    getQuickStats
  };
};

// Helper hook for lesson completion tracking
export const useLessonAchievements = () => {
  const { triggerEvent } = useAchievementSystem();

  const trackLessonCompletion = async (lessonId: number, timeSpent: number, score?: number) => {
    const eventData = {
      lesson_id: lessonId,
      time_spent: timeSpent,
      score: score,
      completed_at: new Date().toISOString()
    };

    // Track lesson completion
    await triggerEvent({ type: 'lesson_complete', data: eventData });

    // Track speed if completion was fast (under 5 minutes for basic lessons)
    if (timeSpent > 0 && timeSpent < 300) { // 5 minutes
      await triggerEvent({ type: 'fast_completion', data: eventData });
    }

    // Track perfect score if applicable
    if (score !== undefined && score >= 100) {
      await triggerEvent({ type: 'perfect_score', data: eventData });
    }
  };

  const trackQuizCompletion = async (quizId: number, score: number, timeSpent: number) => {
    const eventData = {
      quiz_id: quizId,
      score: score,
      time_spent: timeSpent,
      completed_at: new Date().toISOString()
    };

    await triggerEvent({ type: 'quiz_pass', data: eventData });

    if (score >= 100) {
      await triggerEvent({ type: 'perfect_score', data: eventData });
    }
  };

  const trackAssignmentSubmission = async (assignmentId: number, submissionData: any) => {
    const eventData = {
      assignment_id: assignmentId,
      submission_data: submissionData,
      submitted_at: new Date().toISOString()
    };

    await triggerEvent({ type: 'assignment_submit', data: eventData });
  };

  const trackCourseCompletion = async (courseId: number) => {
    const eventData = {
      course_id: courseId,
      completed_at: new Date().toISOString()
    };

    await triggerEvent({ type: 'course_complete', data: eventData });
  };

  return {
    trackLessonCompletion,
    trackQuizCompletion,
    trackAssignmentSubmission,
    trackCourseCompletion
  };
};

export default useAchievementSystem;
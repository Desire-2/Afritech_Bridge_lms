import apiClient from '@/lib/api-client';
import { Forum, ForumPost } from '@/services/forum.service';

export interface AdminForumStats {
  totalForums: number;
  totalThreads: number;
  totalPosts: number;
  totalUsers: number;
  pendingPosts: number;
  flaggedPosts: number;
  dailyActivity: {
    posts: number;
    threads: number;
    users: number;
  };
  topCategories: { name: string; count: number }[];
  engagement: {
    avgPostsPerUser: number;
    avgRepliesPerThread: number;
    mostActiveUsers: { name: string; posts: number }[];
  };
}

export interface ModerationAction {
  postId: number;
  action: 'approve' | 'reject' | 'flag' | 'unflag';
  reason?: string;
}

export class AdminForumService {
  private static readonly BASE_PATH = '/forums';

  // Get all forums with admin privileges
  static async getAllForums(): Promise<{
    general_forums: Forum[];
    course_forums: Forum[];
    categories: Record<string, Forum[]>;
    total_forums: number;
    user_role: string;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return {
        general_forums: [],
        course_forums: [],
        categories: {},
        total_forums: 0,
        user_role: 'admin'
      };
    } catch (error) {
      console.error('Error fetching forums:', error);
      throw error;
    }
  }

  // Create new forum (admin only)
  static async createForum(data: {
    title: string;
    description?: string;
    category?: string;
    course_id?: number | null;
    is_pinned?: boolean;
    allow_anonymous?: boolean;
    moderated?: boolean;
  }): Promise<Forum> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}`, data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to create forum');
    } catch (error) {
      console.error('Error creating forum:', error);
      throw error;
    }
  }

  // Update forum (admin only)
  static async updateForum(forumId: number, data: {
    title?: string;
    description?: string;
    category?: string;
    is_locked?: boolean;
    moderated?: boolean;
    is_pinned?: boolean;
  }): Promise<Forum> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${forumId}`, data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to update forum');
    } catch (error) {
      console.error('Error updating forum:', error);
      throw error;
    }
  }

  // Delete forum (admin only)
  static async deleteForum(forumId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${forumId}`);
      if (!response.data.success) {
        throw new Error('Failed to delete forum');
      }
    } catch (error) {
      console.error('Error deleting forum:', error);
      throw error;
    }
  }

  // Get pending posts for moderation
  static async getPendingPosts(): Promise<{
    pending_posts: ForumPost[];
    total_count: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/moderation/pending`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return {
        pending_posts: [],
        total_count: 0
      };
    } catch (error) {
      console.error('Error fetching pending posts:', error);
      throw error;
    }
  }

  // Get flagged posts for moderation
  static async getFlaggedPosts(): Promise<{
    flagged_posts: ForumPost[];
    total_count: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/moderation/flagged`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return {
        flagged_posts: [],
        total_count: 0
      };
    } catch (error) {
      console.error('Error fetching flagged posts:', error);
      throw error;
    }
  }

  // Moderate a post (approve/reject)
  static async moderatePost(postId: number, approve: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderation/posts/${postId}/approve`, {
        approve
      });
      if (!response.data.success) {
        throw new Error('Failed to moderate post');
      }
    } catch (error) {
      console.error('Error moderating post:', error);
      throw error;
    }
  }

  // Pin/unpin a post
  static async pinPost(postId: number, pinned: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/pin`, {
        pinned
      });
      if (!response.data.success) {
        throw new Error('Failed to pin post');
      }
    } catch (error) {
      console.error('Error pinning post:', error);
      throw error;
    }
  }

  // Lock/unlock a post
  static async lockPost(postId: number, locked: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/lock`, {
        locked
      });
      if (!response.data.success) {
        throw new Error('Failed to lock post');
      }
    } catch (error) {
      console.error('Error locking post:', error);
      throw error;
    }
  }

  // Get forum statistics
  static async getForumStats(): Promise<AdminForumStats> {
    try {
      // Since there's no dedicated stats endpoint yet, we'll build it from available data
      const [forumsData, pendingData, flaggedData] = await Promise.all([
        this.getAllForums(),
        this.getPendingPosts(),
        this.getFlaggedPosts()
      ]);

      const totalForums = forumsData.total_forums;
      const pendingPosts = pendingData.total_count;
      const flaggedPosts = flaggedData.total_count;

      // Calculate basic stats from available data
      let totalThreads = 0;
      let totalPosts = 0;
      const categories: Record<string, number> = {};

      [...forumsData.general_forums, ...forumsData.course_forums, ...Object.values(forumsData.categories).flat()].forEach(forum => {
        totalThreads += forum.thread_count || 0;
        totalPosts += forum.post_count || 0;
        
        const category = forum.category || 'General';
        categories[category] = (categories[category] || 0) + 1;
      });

      return {
        totalForums,
        totalThreads,
        totalPosts,
        totalUsers: 0, // Would need a separate endpoint
        pendingPosts,
        flaggedPosts,
        dailyActivity: {
          posts: 0, // Would need a separate endpoint
          threads: 0,
          users: 0
        },
        topCategories: Object.entries(categories).map(([name, count]) => ({ name, count })),
        engagement: {
          avgPostsPerUser: 0, // Would need a separate endpoint
          avgRepliesPerThread: totalPosts / Math.max(totalThreads, 1),
          mostActiveUsers: [] // Would need a separate endpoint
        }
      };
    } catch (error) {
      console.error('Error fetching forum stats:', error);
      throw error;
    }
  }
}
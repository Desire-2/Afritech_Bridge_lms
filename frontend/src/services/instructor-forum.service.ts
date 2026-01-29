import apiClient from '@/lib/api-client';

export interface ForumPost {
  id: number;
  forum_id: number;
  author_id: number;
  author_name: string;
  title: string;
  content: string;
  parent_post_id: number | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  is_approved: boolean;
  is_edited: boolean;
  like_count: number;
  dislike_count: number;
  view_count: number;
  is_flagged: boolean;
  flag_reason?: string;
  moderated_by?: number;
  moderated_at?: string;
  forum_title?: string;
  reply_count?: number;
  user_reaction?: {
    liked: boolean | null;
    can_edit: boolean;
    can_delete: boolean;
    can_pin: boolean;
    can_lock: boolean;
  };
}

export interface Forum {
  id: number;
  course_id: number | null;
  course_title: string | null;
  title: string;
  description: string;
  category?: string;
  created_by: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  allow_anonymous: boolean;
  moderated: boolean;
  post_count: number;
  thread_count: number;
  subscriber_count: number;
  is_enrolled?: boolean;
  can_post: boolean;
  can_moderate: boolean;
  is_subscribed?: boolean;
  last_post?: {
    id: number;
    title: string;
    author_name: string;
    author_id: number;
    created_at: string;
  };
  threads?: ForumPost[];
}

export interface CreateForumData {
  title: string;
  description?: string;
  category?: string;
  course_id?: number | null;
  is_pinned?: boolean;
  allow_anonymous?: boolean;
  moderated?: boolean;
}

export interface UpdateForumData {
  title?: string;
  description?: string;
  category?: string;
  is_locked?: boolean;
  moderated?: boolean;
  is_pinned?: boolean;
}

export interface CreateThreadData {
  title: string;
  content: string;
}

export interface CreateReplyData {
  content: string;
}

export class InstructorForumService {
  private static readonly BASE_PATH = '/forums';

  // Get all forums (instructor perspective)
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
        user_role: 'instructor'
      };
    } catch (error) {
      console.error('Error fetching forums:', error);
      throw error;
    }
  }

  // Create new forum
  static async createForum(data: CreateForumData): Promise<Forum> {
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

  // Update forum
  static async updateForum(forumId: number, data: UpdateForumData): Promise<Forum> {
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

  // Delete forum
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

  // Get forum details
  static async getForumDetails(forumId: number): Promise<Forum> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${forumId}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Forum not found');
    } catch (error) {
      console.error('Error fetching forum details:', error);
      throw error;
    }
  }

  // Get thread details
  static async getThreadDetails(threadId: number): Promise<ForumPost> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/threads/${threadId}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Thread not found');
    } catch (error) {
      console.error('Error fetching thread details:', error);
      throw error;
    }
  }

  // Create new thread
  static async createThread(forumId: number, data: CreateThreadData): Promise<ForumPost> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/${forumId}/threads`, data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to create thread');
    } catch (error) {
      console.error('Error creating thread:', error);
      throw error;
    }
  }

  // Create reply to thread
  static async createReply(threadId: number, data: CreateReplyData): Promise<ForumPost> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/threads/${threadId}/replies`, data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to create reply');
    } catch (error) {
      console.error('Error creating reply:', error);
      throw error;
    }
  }

  // Edit post
  static async editPost(postId: number, data: { title?: string; content?: string }): Promise<ForumPost> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/posts/${postId}`, data);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to edit post');
    } catch (error) {
      console.error('Error editing post:', error);
      throw error;
    }
  }

  // Delete post
  static async deletePost(postId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/posts/${postId}`);
      if (!response.data.success) {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Pin/unpin post
  static async pinPost(postId: number, pinned: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/pin`, { pinned });
      if (!response.data.success) {
        throw new Error('Failed to pin post');
      }
    } catch (error) {
      console.error('Error pinning post:', error);
      throw error;
    }
  }

  // Lock/unlock post
  static async lockPost(postId: number, locked: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/lock`, { locked });
      if (!response.data.success) {
        throw new Error('Failed to lock post');
      }
    } catch (error) {
      console.error('Error locking post:', error);
      throw error;
    }
  }

  // Like/dislike post
  static async likePost(postId: number, isLike: boolean): Promise<{
    like_count: number;
    dislike_count: number;
    user_reaction: boolean | null;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/like`, { is_like: isLike });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to react to post');
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Flag post
  static async flagPost(postId: number, reason: string): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/posts/${postId}/flag`, { reason });
      if (!response.data.success) {
        throw new Error('Failed to flag post');
      }
    } catch (error) {
      console.error('Error flagging post:', error);
      throw error;
    }
  }

  // Subscribe to forum
  static async subscribeToForum(forumId: number): Promise<{ is_subscribed: boolean }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/${forumId}/subscribe`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to subscribe to forum');
    } catch (error) {
      console.error('Error subscribing to forum:', error);
      throw error;
    }
  }

  // Subscribe to thread
  static async subscribeToThread(threadId: number): Promise<{ is_subscribed: boolean }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/threads/${threadId}/subscribe`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error('Failed to subscribe to thread');
    } catch (error) {
      console.error('Error subscribing to thread:', error);
      throw error;
    }
  }

  // Search forums and threads
  static async searchForums(
    query: string,
    options?: {
      category?: string;
      forum_id?: number;
      sort?: 'relevance' | 'date' | 'popularity';
    }
  ): Promise<{
    forums: Forum[];
    threads: ForumPost[];
    total_results: number;
  }> {
    try {
      const params: any = { q: query };
      if (options?.category) params.category = options.category;
      if (options?.forum_id) params.forum_id = options.forum_id;
      if (options?.sort) params.sort = options.sort;

      const response = await apiClient.get(`${this.BASE_PATH}/search`, { params });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { forums: [], threads: [], total_results: 0 };
    } catch (error) {
      console.error('Error searching forums:', error);
      throw error;
    }
  }

  // Get forum categories
  static async getForumCategories(): Promise<{ categories: string[] }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/categories`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { categories: [] };
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  // Get user's posts
  static async getMyPosts(): Promise<{
    threads: ForumPost[];
    replies: ForumPost[];
    total_posts: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/my-posts`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { threads: [], replies: [], total_posts: 0 };
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }
  }

  // Get forum notifications
  static async getForumNotifications(): Promise<{
    notifications: any[];
    unread_count: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/notifications`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { notifications: [], unread_count: 0 };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markNotificationRead(notificationId: number): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/notifications/${notificationId}/read`);
      if (!response.data.success) {
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // === Moderation Methods ===

  // Get posts pending approval
  static async getPendingPosts(): Promise<{
    pending_posts: ForumPost[];
    total_count: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/moderation/pending`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { pending_posts: [], total_count: 0 };
    } catch (error) {
      console.error('Error fetching pending posts:', error);
      throw error;
    }
  }

  // Approve or reject post
  static async approvePost(postId: number, approve: boolean): Promise<void> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderation/posts/${postId}/approve`, { approve });
      if (!response.data.success) {
        throw new Error('Failed to moderate post');
      }
    } catch (error) {
      console.error('Error moderating post:', error);
      throw error;
    }
  }

  // Get flagged posts
  static async getFlaggedPosts(): Promise<{
    flagged_posts: ForumPost[];
    total_count: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/moderation/flagged`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { flagged_posts: [], total_count: 0 };
    } catch (error) {
      console.error('Error fetching flagged posts:', error);
      throw error;
    }
  }
}

// Re-export for convenience
export { InstructorForumService as ForumService };
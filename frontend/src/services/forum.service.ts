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
  reply_count?: number;
  last_reply?: {
    author_name: string;
    created_at: string;
  };
}

export interface Forum {
  id: number;
  course_id: number | null;
  course_title: string | null;
  title: string;
  description: string;
  created_by: number;
  creator_name: string;
  created_at: string;
  is_active: boolean;
  post_count: number;
  thread_count: number;
  is_enrolled?: boolean;
  last_post?: {
    id: number;
    title: string;
    author_name: string;
    author_id: number;
    created_at: string;
  };
  threads?: ForumPost[];
}

export interface ForumCategory {
  id: string;
  title: string;
  forums: Forum[];
}

export interface CreateThreadData {
  title: string;
  content: string;
}

export interface CreateReplyData {
  content: string;
}

export class ForumService {
  private static readonly BASE_PATH = '/forums';

  // Get all forums
  static async getAllForums(): Promise<{ general_forums: Forum[]; course_forums: Forum[]; total_forums: number }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { general_forums: [], course_forums: [], total_forums: 0 };
    } catch (error) {
      console.error('Error fetching forums:', error);
      throw error;
    }
  }

  // Get forum details with threads
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

  // Get thread details with replies
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

  // Search forums and threads
  static async searchForums(query: string): Promise<{ forums: Forum[]; threads: ForumPost[] }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/search`, {
        params: { q: query }
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return { forums: [], threads: [] };
    } catch (error) {
      console.error('Error searching forums:', error);
      throw error;
    }
  }

  // Get user's posts
  static async getMyPosts(): Promise<{ threads: ForumPost[]; replies: ForumPost[]; total_posts: number }> {
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
}

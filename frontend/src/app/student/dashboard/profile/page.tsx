'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import AchievementProfilePanel from '@/components/achievements/AchievementProfilePanel';
import { useAchievementSystem } from '@/hooks/useAchievementSystem';
import { 
  User, 
  Settings, 
  Award, 
  BarChart3, 
  Camera, 
  Edit3, 
  Save, 
  X, 
  MapPin, 
  Calendar, 
  Clock, 
  Trophy, 
  Target,
  Github,
  Linkedin,
  Twitter,
  Globe,
  Mail,
  Phone,
  BookOpen,
  CheckCircle,
  TrendingUp,
  Flame,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

interface ExtendedProfile {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  profile_picture_url?: string;
  phone_number?: string;
  portfolio_url?: string;
  github_username?: string;
  linkedin_url?: string;
  twitter_username?: string;
  website_url?: string;
  location?: string;
  timezone?: string;
  job_title?: string;
  company?: string;
  experience_level?: string;
  skills?: string[];
  interests?: string[];
  learning_goals?: string;
  preferred_learning_style?: string;
  daily_learning_time?: number;
  email_notifications?: boolean;
  push_notifications?: boolean;
  marketing_emails?: boolean;
  weekly_digest?: boolean;
  profile_visibility?: string;
  show_email?: boolean;
  show_progress?: boolean;
  enable_gamification?: boolean;
  show_leaderboard?: boolean;
  learning_stats?: {
    total_enrollments: number;
    completed_courses: number;
    in_progress_courses: number;
    average_progress: number;
    total_learning_hours: number;
    badges_earned: number;
    achievements_earned: number;
  };
}

interface ProfileAnalytics {
  overview: {
    total_courses: number;
    completed_courses: number;
    in_progress_courses: number;
    completion_rate: number;
    total_hours: number;
  };
  recent_achievements: Array<{
    title: string;
    description: string;
    earned_at: string;
  }>;
  skills_progress: {
    completed_skills: number;
    learning_skills: number;
  };
}

const StudentProfilePage: React.FC = () => {
  const { user, token, fetchUserProfile } = useAuth();
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingCareer, setEditingCareer] = useState(false);

  // Achievement system integration
  const { 
    earnedAchievements, 
    streak, 
    points, 
    loading: achievementsLoading,
    getQuickStats 
  } = useAchievementSystem();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
  
  console.log('API_URL:', API_URL); // Debug logging

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchAnalytics();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const response = await fetch(`${API_URL}/student/profile/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setProfile(result.data);
      } else {
        toast.error('Failed to fetch profile data');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_URL}/student/profile/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  // Format achievement data for the profile panel
  const getProfileAchievementData = () => {
    if (!earnedAchievements || !points || !streak) return null;

    const quickStats = getQuickStats();
    
    // Get recent achievements (last 5)
    const recentAchievements = earnedAchievements
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
      .slice(0, 5)
      .map(achievement => ({
        id: achievement.id,
        title: achievement.achievement?.name || achievement.achievement?.title || 'Unknown',
        icon: achievement.achievement?.icon || 'trophy',
        tier: achievement.achievement?.category || 'bronze',
        earned_at: achievement.earned_at,
        is_showcased: achievement.is_showcased || false
      }));

    // Get showcased achievements
    const showcasedAchievements = earnedAchievements
      .filter(achievement => achievement.is_showcased)
      .map(achievement => ({
        id: achievement.id,
        title: achievement.achievement?.name || achievement.achievement?.title || 'Unknown',
        icon: achievement.achievement?.icon || 'trophy',
        tier: achievement.achievement?.category || 'bronze',
        earned_at: achievement.earned_at,
        is_showcased: true
      }));

    return {
      showcased_achievements: showcasedAchievements,
      recent_achievements: recentAchievements,
      total_achievements: quickStats.earned_count,
      total_points: points.total_points || 0,
      current_level: points.current_level || 1,
      xp_progress: points.xp_progress || 0,
      current_streak: streak.current_streak || 0,
      longest_streak: streak.longest_streak || 0,
      achievements_this_month: earnedAchievements.filter(achievement => {
        const earnedDate = new Date(achievement.earned_at);
        const now = new Date();
        return earnedDate.getMonth() === now.getMonth() && 
               earnedDate.getFullYear() === now.getFullYear();
      }).length
    };
  };

  const updateProfile = async (data: Partial<ExtendedProfile>) => {
    setSaving(true);
    console.log('Updating profile with data:', data); // Debug logging
    
    try {
      const response = await fetch(`${API_URL}/student/profile/`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        const result = await response.json();
        setProfile(result.data);
        toast.success('Profile updated successfully');
        // Note: Not calling fetchUserProfile() to avoid potential token refresh issues
        // The profile state is already updated with fresh data from the server
        return true;
      } else {
        const error = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        console.error('Profile update error:', error); // Debug logging
        
        // Handle validation errors
        if (error.errors) {
          Object.keys(error.errors).forEach(field => {
            const fieldError = Array.isArray(error.errors[field]) ? error.errors[field][0] : error.errors[field];
            toast.error(`${field}: ${fieldError}`);
          });
        } else {
          toast.error(error.message || 'Failed to update profile');
        }
        return false;
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Network error. Please check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updatePreferences = async (preferences: any) => {
    try {
      const response = await fetch(`${API_URL}/student/profile/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      
      if (response.ok) {
        toast.success('Preferences updated successfully');
        await fetchProfileData();
      } else {
        toast.error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Error updating preferences');
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile?.username?.[0]?.toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl">Profile not found</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Reload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profile.profile_picture_url} />
                <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                variant="outline"
                className="absolute -bottom-2 -right-2 rounded-full p-2"
                onClick={() => {
                  // TODO: Implement image upload
                  toast.info('Image upload coming soon!');
                }}
              >
                <Camera className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {profile.first_name && profile.last_name 
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile.username
                }
              </h1>
              <p className="text-muted-foreground">{profile.job_title || 'Student'}</p>
              <div className="flex items-center space-x-4 mt-2">
                {profile.location && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-1" />
                    {profile.location}
                  </div>
                )}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 mr-1" />
                  Member since {new Date(user?.created_at || '').getFullYear()}
                </div>
              </div>
            </div>
            {profile.learning_stats && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {profile.learning_stats.completed_courses}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-500">
                    {profile.learning_stats.in_progress_courses}
                  </div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">
                    {profile.learning_stats.badges_earned}
                  </div>
                  <div className="text-sm text-muted-foreground">Badges</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center">
            <Edit3 className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="achievements" className="flex items-center">
            <Award className="w-4 h-4 mr-2" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.email}</span>
                </div>
                {profile.phone_number && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{profile.phone_number}</span>
                  </div>
                )}
                {profile.bio && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Bio</p>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Learning Stats Card */}
            {profile.learning_stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Learning Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Course Completion</span>
                      <span className="text-sm font-medium">
                        {profile.learning_stats.average_progress}%
                      </span>
                    </div>
                    <Progress value={profile.learning_stats.average_progress} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">
                        {Math.round(profile.learning_stats.total_learning_hours)}h
                      </div>
                      <div className="text-xs text-muted-foreground">Study Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {profile.learning_stats.achievements_earned}
                      </div>
                      <div className="text-xs text-muted-foreground">Achievements</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Skills and Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Links */}
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.github_username && (
                  <div className="flex items-center space-x-3">
                    <Github className="w-4 h-4" />
                    <a 
                      href={`https://github.com/${profile.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {profile.github_username}
                    </a>
                  </div>
                )}
                {profile.linkedin_url && (
                  <div className="flex items-center space-x-3">
                    <Linkedin className="w-4 h-4" />
                    <a 
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                {profile.portfolio_url && (
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4" />
                    <a 
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Portfolio
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Edit Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBasic(!editingBasic)}
                >
                  {editingBasic ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {editingBasic ? (
                  <BasicInfoForm 
                    profile={profile} 
                    onSave={async (data) => {
                      const success = await updateProfile(data);
                      if (success) setEditingBasic(false);
                    }}
                    onCancel={() => setEditingBasic(false)}
                    saving={saving}
                  />
                ) : (
                  <BasicInfoDisplay profile={profile} />
                )}
              </CardContent>
            </Card>

            {/* Career Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Career & Skills</CardTitle>
                  <CardDescription>Professional information and expertise</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCareer(!editingCareer)}
                >
                  {editingCareer ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {editingCareer ? (
                  <CareerInfoForm 
                    profile={profile} 
                    onSave={async (data) => {
                      const success = await updateProfile(data);
                      if (success) setEditingCareer(false);
                    }}
                    onCancel={() => setEditingCareer(false)}
                    saving={saving}
                  />
                ) : (
                  <CareerInfoDisplay profile={profile} />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsView analytics={analytics} />
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-6">
          <AchievementProfilePanel 
            data={getProfileAchievementData()}
            loading={achievementsLoading}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <SettingsView profile={profile} onUpdate={updatePreferences} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Component sub-forms and displays...
const BasicInfoForm: React.FC<{
  profile: ExtendedProfile;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}> = ({ profile, onSave, onCancel, saving }) => {
  const [formData, setFormData] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    email: profile.email || '',
    phone_number: profile.phone_number || '',
    bio: profile.bio || '',
    location: profile.location || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // First name validation
    if (formData.first_name && formData.first_name.length > 50) {
      newErrors.first_name = 'First name must be less than 50 characters';
    }
    
    // Last name validation  
    if (formData.last_name && formData.last_name.length > 50) {
      newErrors.last_name = 'Last name must be less than 50 characters';
    }
    
    // Bio validation
    if (formData.bio && formData.bio.length > 1000) {
      newErrors.bio = 'Bio must be less than 1000 characters';
    }
    
    // Phone validation
    if (formData.phone_number && !/^[\+]?[1-9][\d\s\-\(\)]{7,20}$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid phone number';
    }
    
    // Location validation
    if (formData.location && formData.location.length > 100) {
      newErrors.location = 'Location must be less than 100 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleInputChange}
            className={errors.first_name ? 'border-red-500' : ''}
          />
          {errors.first_name && (
            <p className="text-sm text-red-600 mt-1">{errors.first_name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleInputChange}
            className={errors.last_name ? 'border-red-500' : ''}
          />
          {errors.last_name && (
            <p className="text-sm text-red-600 mt-1">{errors.last_name}</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
      </div>
      <div>
        <Label htmlFor="phone_number">Phone Number</Label>
        <Input
          id="phone_number"
          name="phone_number"
          value={formData.phone_number}
          onChange={handleInputChange}
          placeholder="+1 (555) 123-4567"
          className={errors.phone_number ? 'border-red-500' : ''}
        />
        {errors.phone_number && (
          <p className="text-sm text-red-600 mt-1">{errors.phone_number}</p>
        )}
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          value={formData.location}
          onChange={handleInputChange}
          placeholder="City, Country"
          className={errors.location ? 'border-red-500' : ''}
        />
        {errors.location && (
          <p className="text-sm text-red-600 mt-1">{errors.location}</p>
        )}
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleInputChange}
          placeholder="Tell us about yourself..."
          rows={3}
          className={errors.bio ? 'border-red-500' : ''}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.bio && (
            <p className="text-sm text-red-600">{errors.bio}</p>
          )}
          <p className="text-xs text-muted-foreground ml-auto">
            {formData.bio.length}/1000 characters
          </p>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button type="submit" disabled={saving || Object.keys(errors).length > 0}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const BasicInfoDisplay: React.FC<{ profile: ExtendedProfile }> = ({ profile }) => (
  <div className="space-y-3">
    <div>
      <Label className="text-sm font-medium">Name</Label>
      <p className="text-sm">
        {profile.first_name && profile.last_name 
          ? `${profile.first_name} ${profile.last_name}`
          : 'Not provided'
        }
      </p>
    </div>
    <div>
      <Label className="text-sm font-medium">Email</Label>
      <p className="text-sm">{profile.email}</p>
    </div>
    {profile.phone_number && (
      <div>
        <Label className="text-sm font-medium">Phone</Label>
        <p className="text-sm">{profile.phone_number}</p>
      </div>
    )}
    {profile.location && (
      <div>
        <Label className="text-sm font-medium">Location</Label>
        <p className="text-sm">{profile.location}</p>
      </div>
    )}
    {profile.bio && (
      <div>
        <Label className="text-sm font-medium">Bio</Label>
        <p className="text-sm">{profile.bio}</p>
      </div>
    )}
  </div>
);

const CareerInfoForm: React.FC<{
  profile: ExtendedProfile;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}> = ({ profile, onSave, onCancel, saving }) => {
  const [formData, setFormData] = useState({
    job_title: profile.job_title || '',
    company: profile.company || '',
    experience_level: profile.experience_level || '',
    industry: profile.industry || '',
    portfolio_url: profile.portfolio_url || '',
    github_username: profile.github_username || '',
    linkedin_url: profile.linkedin_url || '',
    twitter_username: profile.twitter_username || '',
    skills: profile.skills?.join(', ') || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Job title validation
    if (formData.job_title && formData.job_title.length > 100) {
      newErrors.job_title = 'Job title must be less than 100 characters';
    }
    
    // Company validation
    if (formData.company && formData.company.length > 100) {
      newErrors.company = 'Company name must be less than 100 characters';
    }
    
    // Skills validation
    if (formData.skills && formData.skills.length > 500) {
      newErrors.skills = 'Skills must be less than 500 characters';
    }
    
    // URL validations
    const urlPattern = /^https?:\/\/(www\.)?[\w\-\.]+\.[a-z]{2,}(\/.*)?$/i;
    
    if (formData.portfolio_url && !urlPattern.test(formData.portfolio_url)) {
      newErrors.portfolio_url = 'Please enter a valid portfolio URL';
    }
    
    if (formData.linkedin_url && !urlPattern.test(formData.linkedin_url)) {
      newErrors.linkedin_url = 'Please enter a valid LinkedIn URL';
    }
    
    // Username validations
    const usernamePattern = /^[a-zA-Z0-9_-]+$/;
    
    if (formData.github_username && (formData.github_username.length > 50 || !usernamePattern.test(formData.github_username))) {
      newErrors.github_username = 'GitHub username must be valid and less than 50 characters';
    }
    
    if (formData.twitter_username && (formData.twitter_username.length > 50 || !usernamePattern.test(formData.twitter_username))) {
      newErrors.twitter_username = 'Twitter username must be valid and less than 50 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s.length > 0),
      };
      onSave(submitData);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="job_title">Job Title</Label>
          <Input
            id="job_title"
            name="job_title"
            value={formData.job_title}
            onChange={handleInputChange}
            placeholder="e.g. Software Developer"
            className={errors.job_title ? 'border-red-500' : ''}
          />
          {errors.job_title && (
            <p className="text-sm text-red-600 mt-1">{errors.job_title}</p>
          )}
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            name="company"
            value={formData.company}
            onChange={handleInputChange}
            placeholder="e.g. Tech Corp"
            className={errors.company ? 'border-red-500' : ''}
          />
          {errors.company && (
            <p className="text-sm text-red-600 mt-1">{errors.company}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="experience">Experience Level</Label>
          <Select
            value={formData.experience_level}
            onValueChange={(value) => setFormData({ ...formData, experience_level: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Entry">Entry Level</SelectItem>
              <SelectItem value="Mid">Mid Level</SelectItem>
              <SelectItem value="Senior">Senior Level</SelectItem>
              <SelectItem value="Lead">Lead/Principal</SelectItem>
              <SelectItem value="Executive">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            name="industry"
            value={formData.industry}
            onChange={handleInputChange}
            placeholder="e.g. Technology"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="skills">Skills</Label>
        <Input
          id="skills"
          name="skills"
          value={formData.skills}
          onChange={handleInputChange}
          placeholder="React, Node.js, Python (comma separated)"
          className={errors.skills ? 'border-red-500' : ''}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-muted-foreground">
            Separate skills with commas
          </p>
          {errors.skills ? (
            <p className="text-sm text-red-600">{errors.skills}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {formData.skills.length}/500 characters
            </p>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Social Links & Portfolio</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="portfolio">Portfolio URL</Label>
            <Input
              id="portfolio"
              name="portfolio_url"
              type="url"
              value={formData.portfolio_url}
              onChange={handleInputChange}
              placeholder="https://yourportfolio.com"
              className={errors.portfolio_url ? 'border-red-500' : ''}
            />
            {errors.portfolio_url && (
              <p className="text-sm text-red-600 mt-1">{errors.portfolio_url}</p>
            )}
          </div>
          <div>
            <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
            <Input
              id="linkedin"
              name="linkedin_url"
              type="url"
              value={formData.linkedin_url}
              onChange={handleInputChange}
              placeholder="https://linkedin.com/in/yourprofile"
              className={errors.linkedin_url ? 'border-red-500' : ''}
            />
            {errors.linkedin_url && (
              <p className="text-sm text-red-600 mt-1">{errors.linkedin_url}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="github">GitHub Username</Label>
            <Input
              id="github"
              name="github_username"
              value={formData.github_username}
              onChange={handleInputChange}
              placeholder="yourusername"
              className={errors.github_username ? 'border-red-500' : ''}
            />
            {errors.github_username && (
              <p className="text-sm text-red-600 mt-1">{errors.github_username}</p>
            )}
          </div>
          <div>
            <Label htmlFor="twitter">Twitter Username</Label>
            <Input
              id="twitter"
              name="twitter_username"
              value={formData.twitter_username}
              onChange={handleInputChange}
              placeholder="yourusername"
              className={errors.twitter_username ? 'border-red-500' : ''}
            />
            {errors.twitter_username && (
              <p className="text-sm text-red-600 mt-1">{errors.twitter_username}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <Button type="submit" disabled={saving || Object.keys(errors).length > 0}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const CareerInfoDisplay: React.FC<{ profile: ExtendedProfile }> = ({ profile }) => (
  <div className="space-y-3">
    {profile.job_title && (
      <div>
        <Label className="text-sm font-medium">Job Title</Label>
        <p className="text-sm">{profile.job_title}</p>
      </div>
    )}
    {profile.company && (
      <div>
        <Label className="text-sm font-medium">Company</Label>
        <p className="text-sm">{profile.company}</p>
      </div>
    )}
    {profile.experience_level && (
      <div>
        <Label className="text-sm font-medium">Experience Level</Label>
        <Badge variant="outline" className="capitalize">
          {profile.experience_level}
        </Badge>
      </div>
    )}
    {profile.skills && profile.skills.length > 0 && (
      <div>
        <Label className="text-sm font-medium">Skills</Label>
        <div className="flex flex-wrap gap-1 mt-2">
          {profile.skills.map((skill, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
        </div>
      </div>
    )}
  </div>
);

const AnalyticsView: React.FC<{ analytics: ProfileAnalytics | null }> = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No analytics data available</p>
        <p className="text-sm text-muted-foreground">Enroll in courses to see your progress!</p>
      </div>
    );
  }

  const progressPercentage = analytics.overview.total_courses > 0 
    ? (analytics.overview.completed_courses / analytics.overview.total_courses) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6 text-center">
            <BookOpen className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <div className="text-3xl font-bold text-blue-600">
              {analytics.overview.total_courses}
            </div>
            <p className="text-sm text-muted-foreground">Total Courses</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <div className="text-3xl font-bold text-green-600">
              {analytics.overview.completed_courses}
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden">
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-8 h-8 mx-auto text-orange-500 mb-2" />
            <div className="text-3xl font-bold text-orange-600">
              {analytics.overview.completion_rate}%
            </div>
            <p className="text-sm text-muted-foreground">Completion Rate</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${analytics.overview.completion_rate}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden">
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 mx-auto text-purple-500 mb-2" />
            <div className="text-3xl font-bold text-purple-600">
              {Math.round(analytics.overview.total_hours)}h
            </div>
            <p className="text-sm text-muted-foreground">Study Time</p>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(analytics.overview.total_hours / 7)} hrs/week avg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Learning Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Completion Progress */}
            <div className="space-y-4">
              <h4 className="font-medium">Course Completion</h4>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                      Progress
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-green-600">
                      {progressPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-green-200">
                  <div 
                    style={{ width: `${progressPercentage}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 transition-all duration-500"
                  ></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completed Courses</span>
                  <span className="font-medium">{analytics.overview.completed_courses}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>In Progress</span>
                  <span className="font-medium">
                    {analytics.overview.total_courses - analytics.overview.completed_courses}
                  </span>
                </div>
              </div>
            </div>

            {/* Study Streak */}
            <div className="space-y-4">
              <h4 className="font-medium">Study Consistency</h4>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {analytics.streak?.current_streak || 0}
                </div>
                <p className="text-sm text-muted-foreground">Day Study Streak</p>
                <div className="mt-4 flex items-center justify-center space-x-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm">
                    Best: {analytics.streak?.longest_streak || 0} days
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Skills Development
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {analytics.skills_progress.completed_skills}
              </div>
              <p className="text-sm text-green-700">Skills Mastered</p>
              <CheckCircle className="w-6 h-6 mx-auto mt-2 text-green-500" />
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {analytics.skills_progress.learning_skills}
              </div>
              <p className="text-sm text-blue-700">Skills in Progress</p>
              <BookOpen className="w-6 h-6 mx-auto mt-2 text-blue-500" />
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {analytics.skills_progress.completed_skills + analytics.skills_progress.learning_skills}
              </div>
              <p className="text-sm text-purple-700">Total Skills</p>
              <Target className="w-6 h-6 mx-auto mt-2 text-purple-500" />
            </div>
          </div>
          
          {/* Skills Progress Bar */}
          {analytics.skills_progress.completed_skills > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Skills Mastery Progress</h4>
              <div className="space-y-3">
                {['JavaScript', 'React', 'Node.js', 'Python', 'Data Analysis'].map((skill, index) => {
                  const progress = Math.min(100, (analytics.skills_progress.completed_skills / 5) * 100 + (index * 10));
                  return (
                    <div key={skill} className="flex items-center space-x-3">
                      <span className="text-sm font-medium w-20">{skill}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12">{progress.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.recent_activities?.length ? (
              analytics.recent_activities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground">Start learning to see your activity here!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SettingsView: React.FC<{
  profile: ExtendedProfile;
  onUpdate: (preferences: any) => void;
}> = ({ profile, onUpdate }) => {
  const [settings, setSettings] = useState({
    email_notifications: profile.email_notifications ?? true,
    weekly_digest: profile.weekly_digest ?? true,
    marketing_emails: profile.marketing_emails ?? false,
    push_notifications: profile.push_notifications ?? true,
    profile_visibility: profile.profile_visibility || 'public',
    show_progress: profile.show_progress ?? true,
    show_achievements: profile.show_achievements ?? true,
    enable_gamification: profile.enable_gamification ?? true,
    show_leaderboard: profile.show_leaderboard ?? true,
    preferred_learning_style: profile.preferred_learning_style || 'mixed',
    daily_learning_time: profile.daily_learning_time || '30',
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
  });
  const [saving, setSaving] = useState(false);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await onUpdate(settings);
      toast.success('Settings updated successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage how you receive notifications and updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-blue-500" />
                <div>
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive course updates and announcements
                  </p>
                </div>
              </div>
              <Switch
                id="email-notifications"
                checked={settings.email_notifications}
                onCheckedChange={(checked) => handleSettingChange('email_notifications', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <div>
                  <Label htmlFor="weekly-digest">Weekly Progress Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Get a summary of your learning progress every week
                  </p>
                </div>
              </div>
              <Switch
                id="weekly-digest"
                checked={settings.weekly_digest}
                onCheckedChange={(checked) => handleSettingChange('weekly_digest', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-purple-500" />
                <div>
                  <Label htmlFor="marketing-emails">Course Recommendations</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about new courses and features
                  </p>
                </div>
              </div>
              <Switch
                id="marketing-emails"
                checked={settings.marketing_emails}
                onCheckedChange={(checked) => handleSettingChange('marketing_emails', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div>
                  <Label htmlFor="push-notifications">Achievement Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you earn new achievements
                  </p>
                </div>
              </div>
              <Switch
                id="push-notifications"
                checked={settings.push_notifications}
                onCheckedChange={(checked) => handleSettingChange('push_notifications', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Privacy & Visibility
          </CardTitle>
          <CardDescription>Control who can see your profile and progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="profile-visibility">Profile Visibility</Label>
              <Select
                value={settings.profile_visibility}
                onValueChange={(value) => handleSettingChange('profile_visibility', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span>Public - Anyone can view</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="students">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>Students Only - Only enrolled students</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center space-x-2">
                      <Settings className="w-4 h-4" />
                      <span>Private - Only you can view</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <div>
                  <Label htmlFor="show-progress">Show Learning Progress</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow others to see your course completion progress
                  </p>
                </div>
              </div>
              <Switch
                id="show-progress"
                checked={settings.show_progress}
                onCheckedChange={(checked) => handleSettingChange('show_progress', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Award className="w-5 h-5 text-yellow-500" />
                <div>
                  <Label htmlFor="show-achievements">Show Achievements</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your earned badges and achievements
                  </p>
                </div>
              </div>
              <Switch
                id="show-achievements"
                checked={settings.show_achievements}
                onCheckedChange={(checked) => handleSettingChange('show_achievements', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Learning Preferences
          </CardTitle>
          <CardDescription>Customize your learning experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="learning-style">Preferred Learning Style</Label>
              <Select
                value={settings.preferred_learning_style}
                onValueChange={(value) => handleSettingChange('preferred_learning_style', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visual">Visual Learning</SelectItem>
                  <SelectItem value="auditory">Auditory Learning</SelectItem>
                  <SelectItem value="kinesthetic">Hands-on Learning</SelectItem>
                  <SelectItem value="mixed">Mixed Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="daily-time">Daily Learning Goal</Label>
              <Select
                value={settings.daily_learning_time}
                onValueChange={(value) => handleSettingChange('daily_learning_time', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Trophy className="w-5 h-5 text-purple-500" />
              <div>
                <Label htmlFor="enable-gamification">Enable Gamification</Label>
                <p className="text-sm text-muted-foreground">
                  Earn points, badges, and track achievements
                </p>
              </div>
            </div>
            <Switch
              id="enable-gamification"
              checked={settings.enable_gamification}
              onCheckedChange={(checked) => handleSettingChange('enable_gamification', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Target className="w-5 h-5 text-green-500" />
              <div>
                <Label htmlFor="show-leaderboard">Participate in Leaderboards</Label>
                <p className="text-sm text-muted-foreground">
                  Compete with other students in course rankings
                </p>
              </div>
            </div>
            <Switch
              id="show-leaderboard"
              checked={settings.show_leaderboard}
              onCheckedChange={(checked) => handleSettingChange('show_leaderboard', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account & System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Account & System
          </CardTitle>
          <CardDescription>System preferences and account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={settings.language}
                onValueChange={(value) => handleSettingChange('language', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => handleSettingChange('timezone', value)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                  <SelectItem value="US/Eastern">Eastern Time (GMT-5)</SelectItem>
                  <SelectItem value="US/Pacific">Pacific Time (GMT-8)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (GMT+1)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (GMT+9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-red-700">Reset Learning Progress</h4>
                <p className="text-sm text-red-600">
                  This will reset all your course progress, achievements, and statistics.
                </p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100">
                Reset Progress
              </Button>
            </div>
          </div>
          
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-red-700">Delete Account</h4>
                <p className="text-sm text-red-600">
                  Permanently delete your account and all associated data.
                </p>
              </div>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100">
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Settings Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveSettings} 
          disabled={saving}
          className="px-8"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
};

export default StudentProfilePage;


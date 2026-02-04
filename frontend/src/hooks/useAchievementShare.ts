'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface Achievement {
  id: number;
  title: string;
  description: string;
  category: string;
  tier: string;
  rarity: string;
  points_value: number;
  earned_at?: string;
}

interface ShareOptions {
  includeStats?: boolean;
  useRichFormatting?: boolean;
  customMessage?: string;
  onSuccess?: (platform: string, shareCount: number) => void;
  onError?: (error: string, platform: string) => void;
}

export const useAchievementShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  const generateShareContent = (
    achievement: Achievement, 
    platform: string, 
    options: ShareOptions = {}
  ) => {
    const { includeStats = true, useRichFormatting = false, customMessage } = options;
    
    const baseUrl = window.location.origin;
    const achievementUrl = `${baseUrl}/achievements/${achievement.id}`;
    
    // Custom message override
    if (customMessage) {
      return {
        text: customMessage,
        url: achievementUrl,
        title: achievement.title
      };
    }
    
    // Platform-specific formatting
    const baseText = `🏆 I just earned "${achievement.title}" achievement! ${achievement.description}`;
    const hashtags = ['Learning', 'Achievement', achievement.category, achievement.tier]
      .filter(Boolean)
      .map(tag => tag.replace(/\s+/g, ''))
      .join(',');
    
    switch (platform.toLowerCase()) {
      case 'copy':
        const copyText = includeStats 
          ? `${baseText}\n\n🎯 Category: ${achievement.category}\n⭐ Tier: ${achievement.tier}\n🏅 Rarity: ${achievement.rarity}\n🎖️ Points: ${achievement.points_value}\n\n🔗 View: ${achievementUrl}`
          : `${baseText}\n\n🔗 ${achievementUrl}`;
        return { text: copyText, url: '', title: achievement.title };
        
      case 'discord':
        const discordText = useRichFormatting
          ? `🏆 **Achievement Unlocked!**\n**${achievement.title}**\n${achievement.description}\n\n🎯 **Category:** ${achievement.category}\n⭐ **Tier:** ${achievement.tier}\n🏅 **Rarity:** ${achievement.rarity}\n🎖️ **Points:** ${achievement.points_value}\n\n🔗 ${achievementUrl}`
          : `${baseText}\n\n${achievementUrl}`;
        return { text: discordText, url: '', title: achievement.title };
        
      case 'twitter':
        return {
          text: `${baseText} #${hashtags}`,
          url: achievementUrl,
          title: achievement.title
        };
        
      case 'email':
        return {
          text: `${baseText}\n\nCategory: ${achievement.category}\nTier: ${achievement.tier}\nPoints Earned: ${achievement.points_value}\n\nView my achievement: ${achievementUrl}`,
          url: achievementUrl,
          title: `Check out my latest achievement: ${achievement.title}`
        };
        
      default:
        return {
          text: baseText,
          url: achievementUrl,
          title: achievement.title
        };
    }
  };

  const shareAchievement = async (
    achievement: Achievement,
    platform: string,
    options: ShareOptions = {}
  ) => {
    if (!achievement) {
      toast.error('Achievement data is required for sharing');
      return false;
    }

    setIsSharing(true);
    
    try {
      // Track share on backend (if API service is available)
      let shareData;
      try {
        const { AchievementApiService } = await import('@/services/achievementApi');
        shareData = await AchievementApiService.shareAchievement(achievement.id, platform);
        setShareCount(shareData.shared_count || 0);
      } catch (apiError: any) {
        console.warn('Could not track share on backend:', apiError);
        // If it's a user-facing error (like not earned), re-throw it
        if (apiError.message && (apiError.message.includes('earned') || apiError.message.includes('404'))) {
          throw apiError;
        }
        // Otherwise just log and continue with sharing
      }

      const content = generateShareContent(achievement, platform, options);
      
      // Platform-specific sharing logic
      switch (platform.toLowerCase()) {
        case 'copy':
          await navigator.clipboard.writeText(content.text);
          toast.success('Achievement details copied to clipboard!');
          break;
          
        case 'twitter':
          const twitterText = encodeURIComponent(content.text);
          const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(content.url)}`;
          window.open(twitterUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
          break;
          
        case 'linkedin':
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(content.url)}&title=${encodeURIComponent(content.title)}&summary=${encodeURIComponent(achievement.description)}`;
          window.open(linkedinUrl, '_blank', 'width=600,height=600,scrollbars=yes,resizable=yes');
          break;
          
        case 'whatsapp':
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(content.text)}`;
          window.open(whatsappUrl, '_blank');
          break;
          
        case 'facebook':
          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}&quote=${encodeURIComponent(content.text)}`;
          window.open(facebookUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
          break;
          
        case 'reddit':
          const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(content.url)}&title=${encodeURIComponent(`Achievement Unlocked: ${achievement.title}`)}`;
          window.open(redditUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
          break;
          
        case 'discord':
          await navigator.clipboard.writeText(content.text);
          toast.success('Discord-formatted message copied! Paste it in your Discord channel.');
          break;
          
        case 'email':
          const emailSubject = encodeURIComponent(content.title);
          const emailBody = encodeURIComponent(content.text);
          window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
          break;
          
        case 'native':
          if (navigator.share) {
            await navigator.share({
              title: content.title,
              text: content.text,
              url: content.url
            });
          } else {
            // Fallback to copy
            await navigator.clipboard.writeText(`${content.text}\n${content.url}`);
            toast.success('Copied to clipboard (native sharing not supported)');
          }
          break;
          
        case 'telegram':
          const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(content.url)}&text=${encodeURIComponent(content.text)}`;
          window.open(telegramUrl, '_blank');
          break;
          
        default:
          toast.error(`Sharing method '${platform}' is not supported`);
          return false;
      }
      
      // Success callback and effects
      options.onSuccess?.(platform, shareData?.shared_count || 0);
      
      // Celebration effect
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FFD700', '#FF6347', '#32CD32', '#FF1493', '#00BFFF']
      });
      
      // Success message with share count if available
      const successMessage = shareData?.shared_count 
        ? `Achievement shared via ${platform}! (Total shares: ${shareData.shared_count})`
        : `Achievement shared via ${platform}!`;
      toast.success(successMessage);
      
      return true;
      
    } catch (error: any) {
      console.error('Share error:', error);
      const errorMessage = error.response?.data?.error || error.message || `Failed to share achievement via ${platform}`;
      
      options.onError?.(errorMessage, platform);
      toast.error(errorMessage);
      
      return false;
      
    } finally {
      setIsSharing(false);
    }
  };

  const generateShareableImage = async (
    achievement: Achievement,
    customOptions: {
      width?: number;
      height?: number;
      theme?: 'light' | 'dark';
      includeQR?: boolean;
      backgroundColor?: string;
      textColor?: string;
    } = {}
  ) => {
    const {
      width = 1200,
      height = 800,
      theme = 'dark',
      includeQR = false,
      backgroundColor,
      textColor
    } = customOptions;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      canvas.width = width;
      canvas.height = height;
      
      // Theme colors
      const colors = theme === 'dark' 
        ? {
            bg1: backgroundColor || '#0f172a',
            bg2: '#1e293b',
            bg3: '#334155',
            primary: '#fbbf24',
            secondary: '#64748b',
            text: textColor || '#f1f5f9',
            textSecondary: '#cbd5e1',
            textTertiary: '#94a3b8',
            accent: '#10b981'
          }
        : {
            bg1: backgroundColor || '#ffffff',
            bg2: '#f8fafc',
            bg3: '#e2e8f0',
            primary: '#f59e0b',
            secondary: '#6b7280',
            text: textColor || '#1f2937',
            textSecondary: '#4b5563',
            textTertiary: '#6b7280',
            accent: '#059669'
          };
      
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors.bg1);
      gradient.addColorStop(0.5, colors.bg2);
      gradient.addColorStop(1, colors.bg3);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Decorative elements
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, width - 80, height - 80);
      
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 60, width - 120, height - 120);

      // Certificate title
      ctx.fillStyle = colors.text;
      ctx.font = `bold ${Math.floor(width * 0.04)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🏆 ACHIEVEMENT CERTIFICATE', width / 2, height * 0.19);
      
      // Achievement title
      ctx.font = `bold ${Math.floor(width * 0.035)}px Arial, sans-serif`;
      ctx.fillStyle = colors.primary;
      ctx.fillText(achievement.title.toUpperCase(), width / 2, height * 0.275);
      
      // Description with word wrapping
      ctx.font = `${Math.floor(width * 0.023)}px Arial, sans-serif`;
      ctx.fillStyle = colors.textSecondary;
      
      const words = achievement.description.split(' ');
      const lines = [];
      let currentLine = words[0];
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testWidth = ctx.measureText(currentLine + ' ' + word).width;
        if (testWidth < width - 200) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      
      let currentY = height * 0.35;
      lines.forEach((line) => {
        ctx.fillText(line, width / 2, currentY);
        currentY += Math.floor(width * 0.029);
      });
      
      // Achievement details
      const detailsY = currentY + 40;
      ctx.font = `${Math.floor(width * 0.02)}px Arial, sans-serif`;
      ctx.fillStyle = colors.textTertiary;
      
      const details = [
        `Category: ${achievement.category}`,
        `Tier: ${achievement.tier}`,
        `Rarity: ${achievement.rarity}`,
        `Points: ${achievement.points_value}`
      ];
      
      details.forEach((detail, index) => {
        ctx.fillText(detail, width / 2, detailsY + (index * 30));
      });
      
      // Earned date if available
      if (achievement.earned_at) {
        ctx.font = `${Math.floor(width * 0.0167)}px Arial, sans-serif`;
        ctx.fillStyle = colors.accent;
        const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        ctx.fillText(`Earned on: ${earnedDate}`, width / 2, detailsY + 160);
      }
      
      // Footer
      ctx.font = `${Math.floor(width * 0.015)}px Arial, sans-serif`;
      ctx.fillStyle = colors.secondary;
      ctx.fillText('Afritech Bridge LMS', width / 2, height - 60);
      
      return canvas;
      
    } catch (error) {
      console.error('Error generating achievement image:', error);
      throw new Error('Failed to generate achievement certificate');
    }
  };

  const downloadAchievementCertificate = async (
    achievement: Achievement,
    customOptions = {}
  ) => {
    try {
      const canvas = await generateShareableImage(achievement, customOptions);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${achievement.title.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate_${timestamp}.png`;
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png', 1.0);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Achievement certificate downloaded as ${fileName}!`);
      return true;
      
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to generate certificate. Please try again.');
      return false;
    }
  };

  return {
    shareAchievement,
    generateShareableImage,
    downloadAchievementCertificate,
    isSharing,
    shareCount
  };
};

// Utility function for common share platforms
export const SHARE_PLATFORMS = [
  { id: 'copy', name: 'Copy Details', icon: '📋', group: 'basic' },
  { id: 'download', name: 'Download Certificate', icon: '💾', group: 'basic' },
  { id: 'native', name: 'More Options', icon: '📱', group: 'basic' },
  { id: 'twitter', name: 'Twitter', icon: '🐦', group: 'social' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', group: 'social' },
  { id: 'facebook', name: 'Facebook', icon: '📘', group: 'social' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', group: 'messaging' },
  { id: 'discord', name: 'Discord', icon: '🎮', group: 'messaging' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', group: 'messaging' },
  { id: 'reddit', name: 'Reddit', icon: '📱', group: 'social' },
  { id: 'email', name: 'Email', icon: '📧', group: 'messaging' }
];

export default useAchievementShare;
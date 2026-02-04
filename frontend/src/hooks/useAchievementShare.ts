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
      const content = generateShareContent(achievement, platform, options);

      const openShareWindow = (url: string, features?: string) => {
        const popup = window.open(url, '_blank', features || 'noopener,noreferrer');
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups to share.');
        }
      };
      
      // Platform-specific sharing logic
      switch (platform.toLowerCase()) {
        case 'copy':
          await navigator.clipboard.writeText(content.text);
          toast.success('Achievement details copied to clipboard!');
          break;
          
        case 'twitter':
          const twitterText = encodeURIComponent(content.text);
          const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(content.url)}`;
          openShareWindow(twitterUrl, 'width=600,height=400,scrollbars=yes,resizable=yes');
          break;
          
        case 'linkedin':
          // LinkedIn share-offsite ignores custom text; copy caption for user convenience
          await navigator.clipboard.writeText(content.text);
          toast.success('Caption copied. Paste it into your LinkedIn post.');
          const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(content.url)}`;
          openShareWindow(linkedinShareUrl, 'width=600,height=600,scrollbars=yes,resizable=yes');
          break;
          
        case 'whatsapp':
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(content.text)}`;
          openShareWindow(whatsappUrl);
          break;
          
        case 'facebook':
          const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}&quote=${encodeURIComponent(content.text)}`;
          openShareWindow(facebookUrl, 'width=600,height=400,scrollbars=yes,resizable=yes');
          break;
          
        case 'reddit':
          const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(content.url)}&title=${encodeURIComponent(`Achievement Unlocked: ${achievement.title}`)}`;
          openShareWindow(redditUrl, 'width=800,height=600,scrollbars=yes,resizable=yes');
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
            let sharedWithImage = false;
            try {
              const canvas = await generateShareableImage(achievement, { theme: 'dark' });
              const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));

              if (blob) {
                const timestamp = new Date().toISOString().split('T')[0];
                const fileName = `${achievement.title.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate_${timestamp}.png`;
                const file = new File([blob], fileName, { type: 'image/png' });

                if ((navigator as any).canShare?.({ files: [file] })) {
                  await navigator.share({
                    title: content.title,
                    text: content.text,
                    url: content.url,
                    files: [file]
                  });
                  sharedWithImage = true;
                }
              }
            } catch (shareImageError) {
              console.warn('Native share with image failed, falling back to text share:', shareImageError);
            }

            if (!sharedWithImage) {
              await navigator.share({
                title: content.title,
                text: content.text,
                url: content.url
              });
            }
          } else {
            // Fallback to copy
            await navigator.clipboard.writeText(`${content.text}\n${content.url}`);
            toast.success('Copied to clipboard (native sharing not supported)');
          }
          break;
          
        case 'telegram':
          const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(content.url)}&text=${encodeURIComponent(content.text)}`;
          openShareWindow(telegramUrl);
          break;
          
        default:
          toast.error(`Sharing method '${platform}' is not supported`);
          return false;
      }

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

      const loadLogo = () =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = '/logo.jpg';
        });

      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      };

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

      // Subtle decorative dots
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = colors.text;
      for (let i = 0; i < 24; i++) {
        const x = (i * 50) % width;
        const y = Math.floor(i / 12) * 120 + 50;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      
      // Decorative elements
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, width - 80, height - 80);
      
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 60, width - 120, height - 120);

      // Logo placement
      const logo = await loadLogo();
      if (logo) {
        const logoBoxSize = Math.floor(width * 0.1);
        const logoX = width - logoBoxSize - 90;
        const logoY = 90;
        const innerPadding = Math.floor(width * 0.01);

        // Soft shadow + white background
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(logoX, logoY, logoBoxSize, logoBoxSize, 18);
        ctx.fill();
        ctx.restore();

        // Clip area for logo
        ctx.save();
        drawRoundedRect(logoX + innerPadding, logoY + innerPadding, logoBoxSize - innerPadding * 2, logoBoxSize - innerPadding * 2, 12);
        ctx.clip();

        const box = logoBoxSize - innerPadding * 2;
        const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
        const drawW = logo.naturalWidth * scale;
        const drawH = logo.naturalHeight * scale;
        const drawX = logoX + innerPadding + (box - drawW) / 2;
        const drawY = logoY + innerPadding + (box - drawH) / 2;
        ctx.drawImage(logo, drawX, drawY, drawW, drawH);
        ctx.restore();

        // Gold outline
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 3;
        drawRoundedRect(logoX, logoY, logoBoxSize, logoBoxSize, 18);
        ctx.stroke();
      }

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

      // Seal
      ctx.beginPath();
      ctx.fillStyle = colors.primary;
      ctx.arc(120, height - 140, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.font = `bold ${Math.floor(width * 0.013)}px Arial, sans-serif`;
      ctx.fillText('CERTIFIED', 120, height - 135);
      
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
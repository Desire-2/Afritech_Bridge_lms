import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Zap, 
  Target, 
  Star, 
  Crown, 
  Medal, 
  Award, 
  Flame,
  TrendingUp,
  Share2,
  Copy,
  Download,
  Heart,
  Sparkles,
  ShieldCheck,
  Rocket,
  BookOpen,
  Lightbulb,
  Puzzle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// Enhanced icon mapping
const ENHANCED_ICON_MAP = {
  trophy: Trophy,
  zap: Zap,
  target: Target,
  star: Star,
  crown: Crown,
  medal: Medal,
  award: Award,
  flame: Flame,
  trending: TrendingUp,
  sparkles: Sparkles,
  shield: ShieldCheck,
  rocket: Rocket,
  book: BookOpen,
  lightbulb: Lightbulb,
  puzzle: Puzzle
};

// Tier-based styles with enhanced visual effects
const TIER_STYLES = {
  bronze: {
    gradient: 'from-orange-400 via-orange-500 to-amber-600',
    glow: 'shadow-orange-500/50',
    border: 'border-orange-400',
    particles: '🟤',
    animation: 'animate-pulse',
    shine: 'from-transparent via-orange-200/20 to-transparent'
  },
  silver: {
    gradient: 'from-gray-300 via-gray-400 to-slate-500',
    glow: 'shadow-gray-400/50',
    border: 'border-gray-400',
    particles: '⚪',
    animation: 'animate-bounce',
    shine: 'from-transparent via-white/30 to-transparent'
  },
  gold: {
    gradient: 'from-yellow-400 via-yellow-500 to-amber-500',
    glow: 'shadow-yellow-500/50',
    border: 'border-yellow-400',
    particles: '🟡',
    animation: 'animate-spin',
    shine: 'from-transparent via-yellow-200/40 to-transparent'
  },
  platinum: {
    gradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    glow: 'shadow-cyan-500/50',
    border: 'border-cyan-400',
    particles: '💎',
    animation: 'animate-ping',
    shine: 'from-transparent via-cyan-200/30 to-transparent'
  },
  diamond: {
    gradient: 'from-purple-500 via-pink-500 to-red-500',
    glow: 'shadow-purple-500/50',
    border: 'border-purple-400',
    particles: '💜',
    animation: 'animate-pulse',
    shine: 'from-transparent via-purple-200/40 to-transparent'
  },
  legendary: {
    gradient: 'from-gradient-to-r from-yellow-400 via-red-500 to-pink-500',
    glow: 'shadow-2xl shadow-pink-500/50',
    border: 'border-gradient-to-r border-yellow-400',
    particles: '✨',
    animation: 'animate-bounce',
    shine: 'from-transparent via-rainbow/50 to-transparent'
  }
};

// Category-based background patterns
const CATEGORY_PATTERNS = {
  learning: 'bg-gradient-to-br from-slate-800 to-slate-700',
  speed: 'bg-gradient-to-br from-slate-700 to-slate-600',
  consistency: 'bg-gradient-to-br from-slate-800 to-slate-700',
  mastery: 'bg-gradient-to-br from-slate-700 to-slate-600',
  social: 'bg-gradient-to-br from-slate-800 to-slate-700',
  exploration: 'bg-gradient-to-br from-slate-700 to-slate-600'
};

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

interface CreativeAchievementBadgeProps {
  achievement: Achievement;
  earned?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'card' | 'compact' | 'showcase' | 'mini';
  showProgress?: boolean;
  showSharing?: boolean;
  onClick?: () => void;
  onShare?: (achievementId: number, method: string) => void;
  onToggleShowcase?: () => void;
  className?: string;
}

const CreativeAchievementBadge: React.FC<CreativeAchievementBadgeProps> = ({
  achievement,
  earned = false,
  size = 'md',
  variant = 'card',
  showProgress = false,
  showSharing = true,
  onClick,
  onShare,
  onToggleShowcase,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const IconComponent = ENHANCED_ICON_MAP[achievement.icon as keyof typeof ENHANCED_ICON_MAP] || Trophy;
  const tierStyle = TIER_STYLES[achievement.tier as keyof typeof TIER_STYLES] || TIER_STYLES.bronze;
  const categoryPattern = CATEGORY_PATTERNS[achievement.category as keyof typeof CATEGORY_PATTERNS] || CATEGORY_PATTERNS.learning;

  // Size configurations
  const sizeConfigs = {
    sm: { iconSize: 'h-6 w-6', cardSize: 'w-24 h-24', textSize: 'text-xs' },
    md: { iconSize: 'h-8 w-8', cardSize: 'w-32 h-32', textSize: 'text-sm' },
    lg: { iconSize: 'h-12 w-12', cardSize: 'w-48 h-48', textSize: 'text-base' },
    xl: { iconSize: 'h-16 w-16', cardSize: 'w-64 h-64', textSize: 'text-lg' }
  };

  const config = sizeConfigs[size];

  // Helper function to execute the actual sharing action
  const executeShare = async (method: string, shareText: string, achievementUrl: string, hashtags: string) => {
    // Validate method parameter
    if (!method || typeof method !== 'string' || method.trim() === '') {
      console.error('❌ Invalid share method in executeShare:', method);
      throw new Error('Invalid sharing method');
    }
    
    switch (method.toLowerCase()) {
      case 'copy':
        const copyText = `${shareText}\n\n🎯 Category: ${achievement.category}\n⭐ Tier: ${achievement.tier}\n🏖️ Points: ${achievement.points_value}\n\n🔗 View: ${achievementUrl}`;
        await navigator.clipboard.writeText(copyText);
        break;
        
      case 'twitter':
        const twitterText = encodeURIComponent(`${shareText} #${hashtags}`);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(achievementUrl)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
        break;
        
      case 'linkedin':
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(achievementUrl)}&title=${encodeURIComponent(achievement.title)}&summary=${encodeURIComponent(achievement.description)}`;
        window.open(linkedinUrl, '_blank', 'width=600,height=600,scrollbars=yes,resizable=yes');
        break;
        
      case 'whatsapp':
        const whatsappText = `${shareText}\n\n${achievementUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
        window.open(whatsappUrl, '_blank');
        break;
        
      case 'facebook':
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(achievementUrl)}&quote=${encodeURIComponent(shareText)}`;
        window.open(facebookUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
        break;
        
      case 'download':
        await downloadAchievementImage();
        break;
        
      case 'native':
        if (navigator.share) {
          await navigator.share({
            title: `Achievement Unlocked: ${achievement.title}`,
            text: shareText,
            url: achievementUrl
          });
        } else {
          await navigator.clipboard.writeText(shareText + '\n' + achievementUrl);
        }
        break;
        
      default:
        throw new Error(`Sharing method '${method}' not supported`);
    }
  };

  // Sharing functionality with enhanced platform support
  const handleShare = async (method: string) => {
    if (!earned) {
      toast.error('You can only share achievements you\'ve earned');
      return;
    }
    
    // Validate method parameter
    if (!method || typeof method !== 'string' || method.trim() === '') {
      console.error('❌ Invalid share method in handleShare:', method);
      toast.error('Invalid sharing method');
      return;
    }
    
    setIsSharing(true);
    
    try {
      const baseUrl = window.location.origin;
      const achievementUrl = `${baseUrl}/achievements/${achievement.id}`;
      const shareText = `🏆 I just earned "${achievement.title}" achievement! ${achievement.description}`;
      const hashtags = ['Learning', 'Achievement', achievement.category, achievement.tier]
        .filter(Boolean)
        .map(tag => tag.replace(/\s+/g, ''))
        .join(',');
      
      // Track the share on backend first, then execute sharing action
      try {
        const { AchievementApiService } = await import('@/services/api');
        const shareData = await AchievementApiService.shareAchievement(achievement.id, method);
        
        // Use backend share text if available
        const finalShareText = shareData.share_text || shareText;
        
        // Execute the actual sharing with backend text
        await executeShare(method, finalShareText, achievementUrl, hashtags);
        
        // Call parent onShare callback
        onShare?.(achievement.id, method);
        
        toast.success(`Shared via ${method}! (Total shares: ${shareData.shared_count})`);
        
      } catch (shareError: any) {
        console.warn('Share tracking failed:', shareError);
        
        // If it's an "not earned" error, don't proceed with sharing
        if (shareError.message && shareError.message.includes('earned')) {
          toast.error(shareError.message);
          return;
        }
        
        // Otherwise, continue with sharing but without tracking
        try {
          await executeShare(method, shareText, achievementUrl, hashtags);
          onShare?.(achievement.id, method);
          toast.success(`Shared via ${method}! (Note: Share count not tracked)`);
        } catch (execError) {
          toast.error(`Failed to share via ${method}`);
          return;
        }
      }
      
      // Celebration effect
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FFD700', '#FF6347', '#32CD32', '#FF1493']
      });
      
    } catch (error: any) {
      console.error('Share error:', error);
      const errorMessage = error.message || 'Failed to share achievement';
      toast.error(errorMessage);
    } finally {
      setIsSharing(false);
    }
  };

  const downloadAchievementImage = async () => {
    try {
      // Create achievement certificate canvas with enhanced design
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Canvas not supported by your browser');
        return;
      }

      // High resolution canvas
      canvas.width = 1200;
      canvas.height = 800;
      
      // Dark theme gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0f172a'); // slate-900
      gradient.addColorStop(0.5, '#1e293b'); // slate-800
      gradient.addColorStop(1, '#334155'); // slate-700
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add decorative border
      ctx.strokeStyle = '#fbbf24'; // amber-400
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
      
      // Inner border
      ctx.strokeStyle = '#64748b'; // slate-500
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

      // Certificate title
      ctx.fillStyle = '#f1f5f9'; // slate-100
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏆 ACHIEVEMENT CERTIFICATE', canvas.width / 2, 150);
      
      // Achievement title
      ctx.font = 'bold 42px Arial, sans-serif';
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.fillText(achievement.title.toUpperCase(), canvas.width / 2, 220);
      
      // Description
      ctx.font = '28px Arial, sans-serif';
      ctx.fillStyle = '#cbd5e1'; // slate-300
      
      // Word wrap description
      const words = achievement.description.split(' ');
      const lines = [];
      let currentLine = words[0];
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < canvas.width - 200) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      
      // Draw description lines
      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, 280 + (index * 35));
      });
      
      // Achievement details
      const detailsY = 380 + (lines.length * 35);
      
      ctx.font = '24px Arial, sans-serif';
      ctx.fillStyle = '#94a3b8'; // slate-400
      
      const details = [
        `Category: ${achievement.category}`,
        `Tier: ${achievement.tier}`,
        `Rarity: ${achievement.rarity}`,
        `Points: ${achievement.points_value}`
      ];
      
      details.forEach((detail, index) => {
        ctx.fillText(detail, canvas.width / 2, detailsY + (index * 30));
      });
      
      // Earned date
      if (earned && achievement.earned_at) {
        ctx.font = '20px Arial, sans-serif';
        ctx.fillStyle = '#10b981'; // emerald-500
        const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        ctx.fillText(`Earned on: ${earnedDate}`, canvas.width / 2, detailsY + 160);
      }
      
      // Footer
      ctx.font = '18px Arial, sans-serif';
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.fillText('Afritech Bridge LMS', canvas.width / 2, canvas.height - 60);
      
      // Generate and download
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${achievement.title.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate_${timestamp}.png`;
      
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png', 1.0);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Achievement certificate downloaded as ${fileName}!`);
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to generate certificate. Please try again.');
    }
  };

  // Animation variants
  const cardVariants = {
    idle: { 
      scale: 1, 
      rotateY: 0,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    hover: { 
      scale: 1.05, 
      rotateY: 5,
      boxShadow: `0 25px 50px -12px ${tierStyle.glow.split('/')[0]}`
    },
    earned: {
      scale: [1, 1.2, 1],
      rotateZ: [0, 360, 0],
      transition: { duration: 0.8, ease: "easeInOut" }
    }
  };

  const shineVariants = {
    idle: { x: '-100%' },
    hover: { 
      x: '100%',
      transition: { duration: 0.8, ease: "easeInOut" }
    }
  };

  // Render based on variant
  if (variant === 'mini') {
    return (
      <motion.div
        className={`relative ${config.cardSize} ${className}`}
        whileHover="hover"
        initial="idle"
        variants={cardVariants}
        onClick={onClick}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <div className={`
          w-full h-full rounded-full 
          bg-gradient-to-br ${earned ? tierStyle.gradient : 'from-gray-200 to-gray-300'}
          ${earned ? tierStyle.glow : 'shadow-gray-300/50'} shadow-lg
          border-2 ${earned ? tierStyle.border : 'border-gray-300'}
          flex items-center justify-center
          ${!earned && 'grayscale opacity-50'}
          overflow-hidden
        `}>
          {/* Shine effect */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${tierStyle.shine} opacity-0`}
            variants={shineVariants}
            animate={isHovered ? 'hover' : 'idle'}
          />
          
          <IconComponent className={`${config.iconSize} text-white drop-shadow-lg`} />
          
          {earned && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-white text-xs">✓</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.div
        className={`relative flex items-center gap-3 p-3 rounded-lg ${categoryPattern} ${className}`}
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
      >
        <div className={`
          relative ${config.cardSize} rounded-lg
          bg-gradient-to-br ${earned ? tierStyle.gradient : 'from-gray-200 to-gray-300'}
          ${earned ? tierStyle.glow : ''} shadow-md
          flex items-center justify-center
          ${!earned && 'grayscale opacity-50'}
        `}>
          <IconComponent className={`${config.iconSize} text-white`} />
        </div>
        
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textSize}`}>{achievement.title}</h4>
          <p className={`text-muted-foreground ${config.textSize === 'text-lg' ? 'text-sm' : 'text-xs'}`}>
            {achievement.description}
          </p>
          {showProgress && achievement.progress !== undefined && (
            <div className="mt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{achievement.progress}/{achievement.max_progress || 100}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div 
                  className={`h-1.5 rounded-full bg-gradient-to-r ${tierStyle.gradient}`}
                  style={{ width: `${(achievement.progress / (achievement.max_progress || 100)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {showSharing && earned && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 hover:bg-slate-600" 
                disabled={isSharing}
              >
                {isSharing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Share2 className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-slate-700">
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-700">
                Share Achievement
              </div>
              
              <DropdownMenuItem 
                onClick={() => handleShare('copy')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Details
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('download')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Certificate
              </DropdownMenuItem>
              
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-700 mt-1">
                Social Media
              </div>
              
              <DropdownMenuItem 
                onClick={() => handleShare('twitter')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-blue-400">🐦</div>
                Twitter
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('linkedin')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-blue-600">💼</div>
                LinkedIn
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('facebook')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-blue-500">📘</div>
                Facebook
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('whatsapp')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-green-500">💬</div>
                WhatsApp
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('discord')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-purple-500">🎮</div>
                Discord
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('reddit')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-orange-500">📱</div>
                Reddit
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => handleShare('email')}
                className="hover:bg-slate-700 text-slate-200"
              >
                <div className="h-4 w-4 mr-2 text-gray-500">📧</div>
                Email
              </DropdownMenuItem>
              
              {navigator.share && (
                <DropdownMenuItem 
                  onClick={() => handleShare('native')}
                  className="hover:bg-slate-700 text-slate-200 border-t border-slate-700 mt-1"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  More Options
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </motion.div>
    );
  }

  // Default card variant
  return (
    <motion.div
      className={`relative ${className}`}
      variants={cardVariants}
      initial="idle"
      whileHover="hover"
      animate={earned ? "earned" : "idle"}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card className={`
        overflow-hidden cursor-pointer border-slate-700
        ${earned ? 'bg-gradient-to-br from-slate-800 to-slate-700' : 'bg-slate-900'}
        ${earned ? tierStyle.border : 'border-slate-600'}
        transition-all duration-300
      `} onClick={onClick}>
        <CardContent className={`p-4 ${categoryPattern} relative`}>
          {/* Floating particles */}
          {earned && isHovered && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  initial={{ 
                    x: Math.random() * 200, 
                    y: Math.random() * 200,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: -20, 
                    opacity: [0, 1, 0],
                    transition: { 
                      duration: 2, 
                      delay: i * 0.2,
                      repeat: Infinity 
                    }
                  }}
                >
                  {tierStyle.particles}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Achievement Badge */}
          <div className="flex flex-col items-center text-center space-y-3">
            <motion.div
              className={`
                relative ${config.cardSize} rounded-2xl
                bg-gradient-to-br ${earned ? tierStyle.gradient : 'from-gray-200 to-gray-300'}
                ${earned ? tierStyle.glow : ''} shadow-xl
                border-4 ${earned ? tierStyle.border : 'border-gray-300'}
                flex items-center justify-center
                ${!earned && 'grayscale opacity-50'}
                overflow-hidden
              `}
              animate={earned && isHovered ? tierStyle.animation : ''}
            >
              {/* Shine effect */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${tierStyle.shine} opacity-0`}
                variants={shineVariants}
                animate={isHovered ? 'hover' : 'idle'}
              />
              
              <IconComponent className={`${config.iconSize} text-white drop-shadow-xl z-10`} />
              
              {/* Earned checkmark */}
              {earned && (
                <motion.div
                  className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                >
                  <span className="text-white font-bold">✓</span>
                </motion.div>
              )}
            </motion.div>

            {/* Achievement Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <h3 className={`font-bold ${config.textSize}`}>{achievement.title}</h3>
                <Badge variant={earned ? "default" : "secondary"} className={`text-xs ${tierStyle.gradient}`}>
                  {achievement.tier.toUpperCase()}
                </Badge>
              </div>
              
              <p className={`text-muted-foreground ${config.textSize === 'text-lg' ? 'text-sm' : 'text-xs'} max-w-48`}>
                {achievement.description}
              </p>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{achievement.category}</Badge>
                <span>•</span>
                <span>{achievement.points_value} pts</span>
              </div>

              {earned && achievement.earned_at && (
                <p className="text-xs text-muted-foreground">
                  Earned {new Date(achievement.earned_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Progress Bar */}
            {showProgress && achievement.progress !== undefined && !earned && (
              <div className="w-full space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{achievement.progress}/{achievement.max_progress || 100}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div 
                    className={`h-2 rounded-full bg-gradient-to-r ${tierStyle.gradient}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(achievement.progress / (achievement.max_progress || 100)) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {earned && (
              <div className="flex gap-2 mt-3">
                {onToggleShowcase && (
                  <Button
                    variant={achievement.is_showcased ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleShowcase();
                    }}
                  >
                    {achievement.is_showcased ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                )}

                {showSharing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isSharing}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleShare('copy')}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare('download')}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare('twitter')}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share on Twitter
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare('linkedin')}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share on LinkedIn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                        <Heart className="h-4 w-4 mr-2" />
                        Share on WhatsApp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CreativeAchievementBadge;
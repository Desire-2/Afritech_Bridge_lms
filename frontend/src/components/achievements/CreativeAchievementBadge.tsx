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
  learning: 'bg-gradient-to-br from-blue-50 to-indigo-100',
  speed: 'bg-gradient-to-br from-red-50 to-orange-100',
  consistency: 'bg-gradient-to-br from-green-50 to-emerald-100',
  mastery: 'bg-gradient-to-br from-purple-50 to-violet-100',
  social: 'bg-gradient-to-br from-pink-50 to-rose-100',
  exploration: 'bg-gradient-to-br from-cyan-50 to-sky-100'
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
  onShare?: (method: string) => void;
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

  // Sharing functionality
  const handleShare = async (method: string) => {
    setIsSharing(true);
    
    try {
      const achievementUrl = `${window.location.origin}/achievements/${achievement.id}`;
      const shareText = `🏆 I just earned "${achievement.title}" achievement! ${achievement.description}`;
      
      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(shareText + '\n' + achievementUrl);
          toast.success('Achievement details copied to clipboard!');
          break;
          
        case 'twitter':
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(achievementUrl)}`;
          window.open(twitterUrl, '_blank');
          break;
          
        case 'linkedin':
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(achievementUrl)}`;
          window.open(linkedinUrl, '_blank');
          break;
          
        case 'whatsapp':
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + achievementUrl)}`;
          window.open(whatsappUrl, '_blank');
          break;
          
        case 'download':
          // Generate achievement certificate image
          await downloadAchievementImage();
          break;
          
        default:
          if (navigator.share) {
            await navigator.share({
              title: achievement.title,
              text: shareText,
              url: achievementUrl
            });
          }
      }
      
      onShare?.(method);
      
      // Celebration effect
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
      
    } catch (error) {
      toast.error('Failed to share achievement');
    } finally {
      setIsSharing(false);
    }
  };

  const downloadAchievementImage = async () => {
    // Create achievement certificate canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Achievement details
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 Achievement Unlocked!', canvas.width / 2, 100);

    ctx.font = 'bold 36px Arial';
    ctx.fillText(achievement.title, canvas.width / 2, 200);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(achievement.description, canvas.width / 2, 250);

    ctx.font = '18px Arial';
    ctx.fillText(`Category: ${achievement.category} • Tier: ${achievement.tier}`, canvas.width / 2, 300);

    if (earned && achievement.earned_at) {
      const earnedDate = new Date(achievement.earned_at).toLocaleDateString();
      ctx.fillText(`Earned on: ${earnedDate}`, canvas.width / 2, 350);
    }

    // Download
    const link = document.createElement('a');
    link.download = `${achievement.title.replace(/\s+/g, '_')}_achievement.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast.success('Achievement certificate downloaded!');
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
        overflow-hidden cursor-pointer
        ${earned ? 'bg-gradient-to-br from-white to-gray-50' : 'bg-gray-100'}
        ${earned ? tierStyle.border : 'border-gray-200'}
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
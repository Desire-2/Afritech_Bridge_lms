'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Share2, 
  Copy, 
  Download,
  Mail,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SHARE_PLATFORMS } from '@/hooks/useAchievementShare';

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

interface ShareMenuProps {
  achievement: Achievement;
  onShare: (platform: string) => void;
  isSharing?: boolean;
  earned?: boolean;
  showLabel?: boolean;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  customPlatforms?: string[];
  className?: string;
}

const ShareMenu: React.FC<ShareMenuProps> = ({
  achievement,
  onShare,
  isSharing = false,
  earned = true,
  showLabel = false,
  variant = 'ghost',
  size = 'sm',
  disabled = false,
  customPlatforms,
  className = ''
}) => {
  if (!earned) {
    return null;
  }

  const platforms = customPlatforms 
    ? SHARE_PLATFORMS.filter(p => customPlatforms.includes(p.id))
    : SHARE_PLATFORMS;

  const basicPlatforms = platforms.filter(p => p.group === 'basic');
  const socialPlatforms = platforms.filter(p => p.group === 'social');
  const messagingPlatforms = platforms.filter(p => p.group === 'messaging');

  const getIcon = (platformId: string) => {
    switch (platformId) {
      case 'copy':
        return <Copy className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'whatsapp':
      case 'discord':
      case 'telegram':
        return <MessageCircle className="h-4 w-4" />;
      case 'native':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  const getPlatformColor = (platformId: string) => {
    switch (platformId) {
      case 'twitter':
        return 'text-blue-400';
      case 'linkedin':
        return 'text-blue-600';
      case 'facebook':
        return 'text-blue-500';
      case 'whatsapp':
        return 'text-green-500';
      case 'discord':
        return 'text-purple-500';
      case 'reddit':
        return 'text-orange-500';
      case 'telegram':
        return 'text-blue-400';
      case 'email':
        return 'text-gray-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className={`${showLabel ? 'px-3' : 'h-8 w-8 p-0'} hover:bg-slate-600 ${className}`}
          disabled={disabled || isSharing}
        >
          {isSharing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: \"linear\" }}
            >
              <Share2 className="h-4 w-4" />
            </motion.div>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              {showLabel && <span className="ml-2">Share</span>}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-slate-800 border-slate-700"
      >
        <DropdownMenuLabel className="text-slate-400 text-xs font-semibold">
          Share "{achievement.title}"
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-slate-700" />
        
        {/* Basic Actions */}
        <DropdownMenuGroup>
          {basicPlatforms.map((platform) => (
            <DropdownMenuItem
              key={platform.id}
              onClick={() => onShare(platform.id)}
              className="hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <div className="flex items-center">
                {getIcon(platform.id)}
                <span className="ml-2">{platform.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        {/* Social Media */}
        {socialPlatforms.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuLabel className="text-slate-400 text-xs">
              Social Media
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {socialPlatforms.map((platform) => (
                <DropdownMenuItem
                  key={platform.id}
                  onClick={() => onShare(platform.id)}
                  className="hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center">
                    <div className={`h-4 w-4 mr-2 ${getPlatformColor(platform.id)}`}>
                      {platform.icon}
                    </div>
                    <span>{platform.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        
        {/* Messaging */}
        {messagingPlatforms.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuLabel className="text-slate-400 text-xs">
              Messaging
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {messagingPlatforms.map((platform) => (
                <DropdownMenuItem
                  key={platform.id}
                  onClick={() => onShare(platform.id)}
                  className="hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center">
                    <div className={`h-4 w-4 mr-2 ${getPlatformColor(platform.id)}`}>
                      {platform.icon}
                    </div>
                    <span>{platform.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        
        {/* Native sharing if available */}
        {navigator?.share && (
          <>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              onClick={() => onShare('native')}
              className="hover:bg-slate-700 text-slate-200 cursor-pointer border-t border-slate-700"
            >
              <div className="flex items-center">
                <Smartphone className="h-4 w-4 mr-2" />
                <span>More Options</span>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareMenu;
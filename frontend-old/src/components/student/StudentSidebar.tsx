"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Search,
  Trophy,
  MessageSquare,
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Target,
  Award,
  Calendar,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: string | number;
  isActive?: boolean;
  isCollapsed?: boolean;
  notifications?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon, 
  label, 
  href, 
  badge, 
  isActive, 
  isCollapsed,
  notifications 
}) => {
  return (
    <Link href={href} className="block">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
          isActive 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
        )}
      >
        <div className={cn(
          "flex-shrink-0 transition-colors duration-200",
          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}>
          {icon}
        </div>
        
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="font-medium text-sm whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Notifications Badge */}
        {notifications && notifications > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1"
          >
            <Badge variant="destructive" className="h-5 w-5 text-xs p-0 flex items-center justify-center">
              {notifications > 99 ? '99+' : notifications}
            </Badge>
          </motion.div>
        )}

        {/* Status Badge */}
        {badge && !isCollapsed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto"
          >
            <Badge 
              variant={isActive ? "secondary" : "outline"} 
              className="text-xs"
            >
              {badge}
            </Badge>
          </motion.div>
        )}

        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {label}
            {badge && (
              <span className="ml-2 text-xs text-muted-foreground">({badge})</span>
            )}
          </div>
        )}
      </motion.div>
    </Link>
  );
};

interface StudentSidebarProps {
  className?: string;
}

const StudentSidebar: React.FC<StudentSidebarProps> = ({ className }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Mock data - replace with actual API calls
  const [sidebarData, setSidebarData] = useState({
    activeCourses: 3,
    notifications: 5,
    achievements: 12,
    forumMessages: 2
  });

  useEffect(() => {
    // Close mobile sidebar when route changes
    setIsMobileOpen(false);
  }, [pathname]);

  const navigationItems = [
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: "Overview",
      href: "/student/dashboard",
      badge: null,
      notifications: 0
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: "My Learning",
      href: "/student/learning",
      badge: sidebarData.activeCourses > 0 ? `${sidebarData.activeCourses} active` : null,
      notifications: 0
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: "My Progress",
      href: "/student/progress",
      badge: null,
      notifications: 0
    },
    {
      icon: <Search className="h-5 w-5" />,
      label: "Browse Courses",
      href: "/student/courses",
      badge: "New",
      notifications: 0
    },
    {
      icon: <Trophy className="h-5 w-5" />,
      label: "Opportunities",
      href: "/student/opportunities",
      badge: "3 available",
      notifications: 0
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Forums",
      href: "/student/forums",
      badge: null,
      notifications: sidebarData.forumMessages
    },
    {
      icon: <User className="h-5 w-5" />,
      label: "My Profile",
      href: "/student/profile",
      badge: null,
      notifications: 0
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: "Settings",
      href: "/student/settings",
      badge: null,
      notifications: 0
    },
    {
      icon: <HelpCircle className="h-5 w-5" />,
      label: "Help & Support",
      href: "/student/help",
      badge: null,
      notifications: 0
    }
  ];

  const quickActions = [
    {
      icon: <GraduationCap className="h-4 w-4" />,
      label: "Certificates",
      href: "/student/certificates",
      badge: sidebarData.achievements
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: "Goals",
      href: "/student/goals",
      badge: null
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Schedule",
      href: "/student/schedule",
      badge: null
    }
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const sidebarContent = (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className={cn(
        "h-full bg-card border-r border-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-sm">AfriTech Bridge</h2>
                  <p className="text-xs text-muted-foreground">Student Portal</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-8 w-8 p-0"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.profile_picture_url || ''} />
            <AvatarFallback>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="font-medium text-sm truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="px-3 mt-6">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-3">
                  QUICK ACTIONS
                </h3>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="space-y-1">
            {quickActions.map((action) => (
              <SidebarItem
                key={action.href}
                {...action}
                isActive={pathname === action.href}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/80",
            isCollapsed ? "px-2" : "px-3"
          )}
        >
          <LogOut className="h-5 w-5" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3 font-medium text-sm"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 h-10 w-10 p-0 bg-background border border-border shadow-md"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 h-full w-80 z-50"
            >
              <div className="relative h-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileOpen(false)}
                  className="absolute top-4 right-4 z-10 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                {sidebarContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default StudentSidebar;
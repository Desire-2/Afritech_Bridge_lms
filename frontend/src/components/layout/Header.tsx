"use client";

import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext'; // Assuming you have this
import { Sun, Moon, Menu, X, UserCircle, LogOut, Settings, LayoutDashboard, BookOpen, Briefcase, Users } from 'lucide-react';

// Creative element: A subtle animated underline for active links
const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link href={href} legacyBehavior>
      <a 
        className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 hover:text-blue-400 
                    ${isActive ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'}`}>
        {children}
        {isActive && (
          <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2/3 h-0.5 bg-blue-500 rounded-full origin-center scale-x-100 transition-transform duration-300 ease-out"></span>
        )}
      </a>
    </Link>
  );
};

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const [mounted, setMounted] = useState(false);
  // For theme toggle - assuming a theme context or simple localStorage solution
  const [darkMode, setDarkMode] = useState(false); 

  useEffect(() => {
    setMounted(true);
    // Check localStorage for theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItems = [
    { href: "/courses", label: "Courses", icon: <BookOpen size={18} /> },
    { href: "/opportunities", label: "Opportunities", icon: <Briefcase size={18} /> },
    { href: "/forums", label: "Community", icon: <Users size={18} /> },
  ];

  if (!mounted) return null; // Avoid hydration mismatch for theme toggle

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" legacyBehavior>
              <a className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity">
                Afritec<span className="text-orange-500">Bridge</span>
              </a>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1 items-center">
            {navItems.map(item => <NavLink key={item.href} href={item.href}>{item.label}</NavLink>)}
          </nav>

          {/* Right side: Theme toggle, Search (optional), Profile/Login */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User Profile / Login-Register */}
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="User avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <UserCircle size={28} className="text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">{user.firstName}</span>
                </button>
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-xl py-1 ring-1 ring-black ring-opacity-5 z-50">
                    <Link href="/dashboard" legacyBehavior><a className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"> <LayoutDashboard size={16}/> Dashboard</a></Link>
                    <Link href="/dashboard/profile" legacyBehavior><a className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"> <UserCircle size={16}/> Profile</a></Link>
                    <Link href="/dashboard/settings" legacyBehavior><a className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"> <Settings size={16}/> Settings</a></Link>
                    <button 
                      onClick={() => { logout(); setIsProfileDropdownOpen(false); }}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <LogOut size={16}/> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Link href="/auth/login" legacyBehavior>
                  <a className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Login</a>
                </Link>
                <Link href="/auth/register" legacyBehavior>
                  <a className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors dark:bg-blue-500 dark:hover:bg-blue-600">
                    Register
                  </a>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white dark:bg-gray-900 shadow-lg p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} legacyBehavior>
              <a 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                {item.icon} {item.label}
              </a>
            </Link>
          ))}
          {!user && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <Link href="/auth/login" legacyBehavior>
                  <a onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">Login</a>
                </Link>
                <Link href="/auth/register" legacyBehavior>
                  <a onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors dark:bg-blue-500 dark:hover:bg-blue-600">Register</a>
                </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;


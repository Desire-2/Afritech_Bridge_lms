'use client';

import React from 'react';
import { Users, UserCheck, UserPlus, Clock, UserX, TrendingUp } from 'lucide-react';

interface UserStatsCardsProps {
  stats: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    users_by_role: Record<string, number>;
    new_users_7d: number;
    new_users_30d: number;
  };
}

const UserStatsCards: React.FC<UserStatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Total Users',
      value: stats.total_users,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      title: 'Active Users',
      value: stats.active_users,
      icon: UserCheck,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-100',
      change: stats.total_users > 0 ? `${((stats.active_users / stats.total_users) * 100).toFixed(0)}%` : '0%',
      changeLabel: 'of total'
    },
    {
      title: 'New This Week',
      value: stats.new_users_7d,
      icon: UserPlus,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-100'
    },
    {
      title: 'New This Month',
      value: stats.new_users_30d,
      icon: TrendingUp,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      iconBg: 'bg-orange-100'
    },
    {
      title: 'Inactive Users',
      value: stats.inactive_users,
      icon: UserX,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      iconBg: 'bg-red-100',
      change: stats.total_users > 0 ? `${((stats.inactive_users / stats.total_users) * 100).toFixed(0)}%` : '0%',
      changeLabel: 'of total'
    }
  ];

  const roleIcons: Record<string, string> = {
    student: '🎓',
    instructor: '👨‍🏫',
    admin: '👑'
  };

  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    student: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    instructor: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    admin: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                  <Icon className={`w-5 h-5 ${card.textColor}`} />
                </div>
                {card.change && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${card.bgColor} ${card.textColor}`}>
                    {card.change}
                  </span>
                )}
              </div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              {card.changeLabel && (
                <p className="text-xs text-gray-400 mt-1">{card.changeLabel}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Role Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats.users_by_role || {}).map(([role, count]) => {
          const colors = roleColors[role] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
          const percentage = stats.total_users > 0 ? ((count / stats.total_users) * 100).toFixed(1) : 0;
          
          return (
            <div 
              key={role} 
              className={`${colors.bg} rounded-xl p-5 border ${colors.border} hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{roleIcons[role] || '👤'}</span>
                  <div>
                    <h4 className={`font-semibold capitalize ${colors.text}`}>{role}s</h4>
                    <p className="text-xs text-gray-500">{percentage}% of users</p>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${colors.text}`}>{count.toLocaleString()}</p>
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    role === 'student' ? 'bg-green-400' :
                    role === 'instructor' ? 'bg-blue-400' :
                    role === 'admin' ? 'bg-purple-400' : 'bg-gray-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserStatsCards;

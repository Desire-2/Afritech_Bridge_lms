import React from 'react';

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
      icon: '👥',
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Users',
      value: stats.active_users,
      icon: '✅',
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'New (7 days)',
      value: stats.new_users_7d,
      icon: '🆕',
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'New (30 days)',
      value: stats.new_users_30d,
      icon: '📈',
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Inactive Users',
      value: stats.inactive_users,
      icon: '⏸️',
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className="mb-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{card.icon}</span>
              <div className={`${card.bgColor} ${card.textColor} px-3 py-1 rounded-full text-xs font-semibold`}>
                Active
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
            <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Role Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats.users_by_role).map(([role, count]) => (
          <div key={role} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-gray-600 text-sm font-medium capitalize">{role}s</h4>
                <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
              <div className="text-3xl">
                {role === 'student' && '🎓'}
                {role === 'instructor' && '👨‍🏫'}
                {role === 'admin' && '👑'}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {((count / stats.total_users) * 100).toFixed(1)}% of total
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserStatsCards;

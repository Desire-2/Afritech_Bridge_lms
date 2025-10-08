/**
 * Skill Radar Chart Component
 * Visual representation of student's skill proficiency across different areas
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SkillData {
  name: string;
  proficiency: number; // 0-100
  courses_completed: number;
  hours_spent: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface SkillRadarChartProps {
  skills: SkillData[];
  title?: string;
  showLegend?: boolean;
  interactive?: boolean;
}

const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  skills,
  title = 'Skill Proficiency Map',
  showLegend = true,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSkill, setSelectedSkill] = React.useState<SkillData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const size = 400;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size * 0.35;
    const levels = 5;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background circles (levels)
    for (let i = 1; i <= levels; i++) {
      const radius = (maxRadius / levels) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const numSkills = skills.length;
    const angleStep = (2 * Math.PI) / numSkills;

    // Draw axes
    skills.forEach((_, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const endX = centerX + maxRadius * Math.cos(angle);
      const endY = centerY + maxRadius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw skill proficiency polygon
    ctx.beginPath();
    skills.forEach((skill, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const proficiencyRadius = (skill.proficiency / 100) * maxRadius;
      const x = centerX + proficiencyRadius * Math.cos(angle);
      const y = centerY + proficiencyRadius * Math.sin(angle);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#3b82f6';
    skills.forEach((skill, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const proficiencyRadius = (skill.proficiency / 100) * maxRadius;
      const x = centerX + proficiencyRadius * Math.cos(angle);
      const y = centerY + proficiencyRadius * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw skill labels
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    skills.forEach((skill, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const labelRadius = maxRadius + 30;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);

      ctx.fillText(skill.name, x, y);
    });

    // Draw level labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 1; i <= levels; i++) {
      const radius = (maxRadius / levels) * i;
      const label = `${(i * 20)}%`;
      ctx.fillText(label, centerX + 5, centerY - radius + 3);
    }
  }, [skills]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = canvas.width * 0.35;

    const numSkills = skills.length;
    const angleStep = (2 * Math.PI) / numSkills;

    // Check if click is near any data point
    for (let i = 0; i < numSkills; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const proficiencyRadius = (skills[i].proficiency / 100) * maxRadius;
      const pointX = centerX + proficiencyRadius * Math.cos(angle);
      const pointY = centerY + proficiencyRadius * Math.sin(angle);

      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
      if (distance < 10) {
        setSelectedSkill(skills[i]);
        return;
      }
    }

    setSelectedSkill(null);
  };

  const getTrendIcon = (trend: SkillData['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getProficiencyLevel = (proficiency: number): string => {
    if (proficiency >= 90) return 'Expert';
    if (proficiency >= 70) return 'Advanced';
    if (proficiency >= 50) return 'Intermediate';
    if (proficiency >= 30) return 'Beginner';
    return 'Novice';
  };

  const getProficiencyColor = (proficiency: number): string => {
    if (proficiency >= 90) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    if (proficiency >= 70) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (proficiency >= 50) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (proficiency >= 30) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-pointer"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        {selectedSkill && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">{selectedSkill.name}</h4>
              {getTrendIcon(selectedSkill.trend)}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Proficiency:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="font-bold text-xl">{selectedSkill.proficiency}%</span>
                  <Badge variant="secondary" className={getProficiencyColor(selectedSkill.proficiency)}>
                    {getProficiencyLevel(selectedSkill.proficiency)}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Courses Completed:</span>
                <p className="font-semibold text-lg mt-1">{selectedSkill.courses_completed}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Hours Spent:</span>
                <p className="font-semibold text-lg mt-1">{selectedSkill.hours_spent}h</p>
              </div>
              <div>
                <span className="text-muted-foreground">Trend:</span>
                <div className="flex items-center space-x-2 mt-1">
                  {getTrendIcon(selectedSkill.trend)}
                  <span className="font-semibold capitalize">{selectedSkill.trend}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showLegend && !selectedSkill && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedSkill(skill)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{skill.name}</span>
                  {getTrendIcon(skill.trend)}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${skill.proficiency}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{skill.proficiency}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-center text-muted-foreground">
          {interactive && "Click on data points or skill cards to see detailed information"}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillRadarChart;

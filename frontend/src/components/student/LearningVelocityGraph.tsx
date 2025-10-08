/**
 * Learning Velocity Graph Component
 * Shows student progress over time with trend analysis
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Clock, Target, BarChart3 } from 'lucide-react';

interface DailyProgress {
  date: string;
  lessons_completed: number;
  time_spent: number; // minutes
  score_average: number;
}

interface WeeklySummary {
  current_week: number;
  previous_week: number;
  trend: 'up' | 'down' | 'stable';
}

interface LearningVelocityGraphProps {
  dailyProgress: DailyProgress[];
  weeklySummary: WeeklySummary;
  title?: string;
}

const LearningVelocityGraph: React.FC<LearningVelocityGraphProps> = ({
  dailyProgress,
  weeklySummary,
  title = 'Learning Velocity',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metric, setMetric] = useState<'lessons' | 'time' | 'score'>('lessons');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [hoveredDay, setHoveredDay] = useState<DailyProgress | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dailyProgress.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.clientWidth;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate chart dimensions
    const padding = { top: 20, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Get data based on selected metric
    const data = dailyProgress.map(day => {
      switch (metric) {
        case 'lessons':
          return day.lessons_completed;
        case 'time':
          return day.time_spent;
        case 'score':
          return day.score_average;
        default:
          return 0;
      }
    });

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    const gridLines = 5;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Draw Y-axis labels
      const value = maxValue - (valueRange / gridLines) * i;
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(value.toFixed(metric === 'score' ? 1 : 0), padding.left - 10, y);
    }

    ctx.setLineDash([]);

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw area under curve
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);

    data.forEach((value, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index;
      const y = height - padding.bottom - ((value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index;
      const y = height - padding.bottom - ((value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    data.forEach((value, index) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * index;
      const y = height - padding.bottom - ((value - minValue) / valueRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw X-axis labels (dates)
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelInterval = Math.ceil(dailyProgress.length / 7);
    dailyProgress.forEach((day, index) => {
      if (index % labelInterval === 0) {
        const x = padding.left + (chartWidth / (data.length - 1)) * index;
        const date = new Date(day.date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, x, height - padding.bottom + 10);
      }
    });

    // Draw axis labels
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px sans-serif';
    
    // Y-axis label
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    const yLabel = metric === 'lessons' ? 'Lessons Completed' : 
                    metric === 'time' ? 'Time Spent (min)' : 'Average Score';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('Date', width / 2, height - 15);

  }, [dailyProgress, metric]);

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const padding = { left: 60 };
    const chartWidth = canvas.width - 60 - 40;

    // Find closest data point
    const closestIndex = Math.round(((x - padding.left) / chartWidth) * (dailyProgress.length - 1));
    
    if (closestIndex >= 0 && closestIndex < dailyProgress.length) {
      setHoveredDay(dailyProgress[closestIndex]);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredDay(null);
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-5 w-5" />;
      case 'down':
        return <TrendingDown className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const averageValue = dailyProgress.reduce((sum, day) => {
    const value = metric === 'lessons' ? day.lessons_completed :
                  metric === 'time' ? day.time_spent :
                  day.score_average;
    return sum + value;
  }, 0) / dailyProgress.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={metric} onValueChange={(value: any) => setMetric(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lessons">Lessons</SelectItem>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="score">Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">This Week</span>
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{weeklySummary.current_week}</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Last Week</span>
              <Clock className="h-4 w-4 text-gray-600" />
            </div>
            <p className="text-2xl font-bold">{weeklySummary.previous_week}</p>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Trend</span>
              <div className={getTrendColor(weeklySummary.trend)}>
                {getTrendIcon(weeklySummary.trend)}
              </div>
            </div>
            <p className={`text-2xl font-bold capitalize ${getTrendColor(weeklySummary.trend)}`}>
              {weeklySummary.trend}
            </p>
          </div>
        </div>

        {/* Graph */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="w-full cursor-crosshair"
            style={{ height: '300px' }}
          />
          
          {/* Hover tooltip */}
          {hoveredDay && (
            <div className="absolute top-4 right-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-10">
              <p className="text-xs text-muted-foreground mb-1">{formatDate(hoveredDay.date)}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between space-x-4">
                  <span className="text-muted-foreground">Lessons:</span>
                  <span className="font-semibold">{hoveredDay.lessons_completed}</span>
                </div>
                <div className="flex justify-between space-x-4">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-semibold">{hoveredDay.time_spent} min</span>
                </div>
                <div className="flex justify-between space-x-4">
                  <span className="text-muted-foreground">Avg Score:</span>
                  <span className="font-semibold">{hoveredDay.score_average.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Average</p>
            <p className="text-xl font-bold">
              {averageValue.toFixed(metric === 'score' ? 1 : 0)}
              {metric === 'time' && ' min'}
              {metric === 'score' && '%'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Peak Day</p>
            <p className="text-xl font-bold">
              {Math.max(...dailyProgress.map(d => 
                metric === 'lessons' ? d.lessons_completed :
                metric === 'time' ? d.time_spent : d.score_average
              )).toFixed(metric === 'score' ? 1 : 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Days</p>
            <p className="text-xl font-bold">{dailyProgress.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Active Days</p>
            <p className="text-xl font-bold">
              {dailyProgress.filter(d => d.lessons_completed > 0).length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningVelocityGraph;

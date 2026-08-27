"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, Video, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookingService } from '@/services/booking.service';
import type { Booking } from '@/types/booking';

interface NativeBookingCardProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const NativeBookingCard = ({ variant = 'compact', className = '' }: NativeBookingCardProps) => {
  const [nextSession, setNextSession] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await BookingService.getStudentBookings('upcoming', undefined, 1, 1);
        if (res.bookings.length > 0) {
          setNextSession(res.bookings[0]);
        }
      } catch {
        // Silently fail — card will show generic content
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const features = [
    { icon: Video, text: "1-on-1 Mentoring", color: "text-blue-600" },
    { icon: Users, text: "Career Guidance", color: "text-green-600" },
    { icon: Clock, text: "Flexible Schedule", color: "text-purple-600" },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  1-on-1 Sessions
                </span>
              </CardTitle>
              {nextSession && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Upcoming
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : nextSession ? (
              <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{nextSession.session_topic}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  with {nextSession.instructor_name}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(nextSession.start_datetime)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(nextSession.start_datetime)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Book a session with our instructors for personalized guidance on your learning journey.
              </p>
            )}

            <div className="grid grid-cols-1 gap-2">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-2"
                >
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <Link href="/student/bookings/new">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book a Session
                </Button>
              </Link>
              <Link href="/student/bookings">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View My Sessions <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Full variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-xl">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Book a 1-on-1 Session
              </span>
              <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
                Get personalized guidance from your instructors
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-4 rounded-lg bg-white/50 dark:bg-gray-800/50"
              >
                <feature.icon className={`w-8 h-8 ${feature.color} mx-auto mb-2`} />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{feature.text}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/student/bookings/new">
              <Button size="lg" className="px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Book Your Session
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

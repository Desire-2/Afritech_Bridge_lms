"use client";
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, Video, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface BookingCardProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const BookingCard = ({ variant = 'compact', className = '' }: BookingCardProps) => {
  const { isLoaded, isLoading, initializeButton } = useGoogleCalendar();
  const calendarButtonRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isLoaded && calendarButtonRef.current && !hasInitialized.current) {
      initializeButton(calendarButtonRef.current);
      hasInitialized.current = true;
    }
  }, [isLoaded, initializeButton]);

  const features = [
    { icon: Video, text: "1-on-1 Mentoring", color: "text-blue-600" },
    { icon: Users, text: "Career Guidance", color: "text-green-600" },
    { icon: Clock, text: "Flexible Schedule", color: "text-purple-600" },
  ];

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300 group">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <div className="relative">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Expert Mentorship
                </span>
              </CardTitle>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Available Now
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Book a session with our industry experts for personalized guidance on your learning journey.
            </p>
            
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

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              {isLoading && (
                <Button disabled className="w-full">
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Loading Calendar...
                </Button>
              )}
              
              {isLoaded && (
                <div 
                  ref={calendarButtonRef}
                  className="w-full [&>*]:w-full [&>*]:justify-center [&>*]:py-2.5 [&>*]:px-4 [&>*]:rounded-lg [&>*]:font-medium [&>*]:text-sm [&>*]:transition-all [&>*]:duration-200 [&>*]:border-0 [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:to-purple-600 [&>*]:text-white [&>*]:hover:from-blue-700 [&>*]:hover:to-purple-700 [&>*]:shadow-md [&>*]:hover:shadow-lg"
                />
              )}
              
              {!isLoading && !isLoaded && (
                <Button variant="outline" className="w-full" disabled>
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar Unavailable
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Full variant for larger sections
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
            <div className="relative">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <Sparkles className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Book Expert Mentorship
              </span>
              <p className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
                Get personalized guidance from industry professionals
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
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Ready to accelerate your learning?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Schedule a session with our mentors to discuss your goals, get career advice, and receive personalized learning recommendations.
            </p>
            
            {isLoading && (
              <Button disabled size="lg" className="px-8">
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                Loading Calendar...
              </Button>
            )}
            
            {isLoaded && (
              <div 
                ref={calendarButtonRef}
                className="inline-block [&>*]:px-8 [&>*]:py-3 [&>*]:rounded-lg [&>*]:font-semibold [&>*]:text-lg [&>*]:transition-all [&>*]:duration-200 [&>*]:border-0 [&>*]:bg-gradient-to-r [&>*]:from-blue-600 [&>*]:to-purple-600 [&>*]:text-white [&>*]:hover:from-blue-700 [&>*]:hover:to-purple-700 [&>*]:shadow-lg [&>*]:hover:shadow-xl [&>*]:transform [&>*]:hover:scale-105"
              />
            )}
            
            {!isLoading && !isLoaded && (
              <Button variant="outline" size="lg" disabled className="px-8">
                <Calendar className="w-5 h-5 mr-2" />
                Calendar Unavailable
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
import React from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, X, Medal } from 'lucide-react';

interface CelebrationModalProps {
  showCelebration: boolean;
  timeSpent: number;
  engagementScore: number;
  readingProgress: number;
  newBadgesEarned: string[];
  onClose: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  showCelebration,
  timeSpent,
  engagementScore,
  readingProgress,
  newBadgesEarned,
  onClose
}) => {
  return (
    <AnimatePresence>
      {showCelebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            className="bg-white rounded-xl p-8 max-w-lg mx-4 text-center shadow-2xl relative"
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="mb-6">
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="w-20 h-20 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Trophy className="h-10 w-10 text-white" />
              </motion.div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {newBadgesEarned.length > 0 ? '🎖️ New Badge Earned! 🏅' : '🎉 Lesson Completed! 🎉'}
              </h3>
              
              {newBadgesEarned.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4"
                >
                  <div className="flex items-center justify-center mb-2">
                    <Medal className="h-6 w-6 text-purple-600 mr-2" />
                    <span className="font-semibold text-purple-800">
                      {newBadgesEarned[newBadgesEarned.length - 1]}
                    </span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Congratulations! You've completed 3 lessons and earned a new skill badge!
                  </p>
                </motion.div>
              )}
              
              <p className="text-gray-600 mb-4">
                Amazing work! You've successfully completed this lesson with excellent engagement.
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-600">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</div>
                  <div className="text-xs text-gray-600">Time Spent</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-600">{Math.round(engagementScore)}%</div>
                  <div className="text-xs text-gray-600">Engagement</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-purple-600">{Math.round(readingProgress)}%</div>
                  <div className="text-xs text-gray-600">Completion</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-2 text-yellow-500 mb-4">
                <Star className="h-5 w-5 fill-current" />
                <Star className="h-5 w-5 fill-current" />
                <Star className="h-5 w-5 fill-current" />
                <Star className="h-5 w-5 fill-current" />
                <Star className="h-5 w-5 fill-current" />
              </div>
            </div>
            
            <Button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Continue Learning
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

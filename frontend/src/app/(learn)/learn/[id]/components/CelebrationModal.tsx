import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Trophy, Star, Medal } from 'lucide-react';

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
  const badgeName = newBadgesEarned[newBadgesEarned.length - 1];

  return (
    <Dialog open={showCelebration} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-lg rounded-xl border-0 bg-white p-5 text-center shadow-2xl sm:p-8"
        onPointerDownOutside={(event) => { event.preventDefault(); onClose(); }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle id="lesson-completed-title">
            {badgeName ? 'New Badge Earned' : 'Lesson Completed'}
          </DialogTitle>
          <DialogDescription>
            You&apos;ve completed this lesson. Review your engagement stats below, then keep learning.
          </DialogDescription>
        </DialogHeader>

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
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600"
          >
            <Trophy className="h-10 w-10 text-white" />
          </motion.div>

          <h3 id="lesson-completed-title" className="mb-3 text-2xl font-bold text-gray-900">
            {badgeName ? 'New Badge Earned' : 'Lesson Completed'}
          </h3>

          {badgeName && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4"
            >
              <div className="mb-2 flex items-center justify-center">
                <Medal className="mr-2 h-6 w-6 text-purple-600" />
                <span className="font-semibold text-purple-800">{badgeName}</span>
              </div>
              <p className="text-sm text-purple-700">
                Congratulations! You&apos;ve completed enough lessons to earn a new skill badge.
              </p>
            </motion.div>
          )}

          <p className="mb-4 text-gray-600">
            Amazing work! You&apos;ve successfully completed this lesson with excellent engagement.
          </p>

          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-lg font-bold text-blue-600">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</div>
              <div className="text-xs text-gray-600">Time Spent</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-lg font-bold text-green-600">{Math.round(engagementScore)}%</div>
              <div className="text-xs text-gray-600">Engagement</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-lg font-bold text-purple-600">{Math.round(readingProgress)}%</div>
              <div className="text-xs text-gray-600">Completion</div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-center space-x-2 text-yellow-500">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            Continue Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

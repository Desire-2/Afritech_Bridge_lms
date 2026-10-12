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
import { CheckCircle } from 'lucide-react';

interface UnlockAnimationProps {
  showUnlockAnimation: boolean;
  unlockedModuleName: string | null;
  onClose: () => void;
}

export const UnlockAnimation: React.FC<UnlockAnimationProps> = ({
  showUnlockAnimation,
  unlockedModuleName,
  onClose
}) => {
  return (
    <Dialog open={showUnlockAnimation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-md rounded-xl border-0 bg-white p-6 text-center shadow-2xl sm:p-8"
        onPointerDownOutside={(event) => { event.preventDefault(); onClose(); }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle id="module-unlocked-title">Module Unlocked</DialogTitle>
          <DialogDescription>
            You&apos;ve unlocked {unlockedModuleName || 'the next module'}. Keep learning to keep progressing.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 id="module-unlocked-title" className="mb-2 text-xl font-bold text-gray-900">Module Unlocked</h3>
          <p className="text-gray-600">
            You&apos;ve unlocked &quot;{unlockedModuleName}&quot;.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-700">
            Continue Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

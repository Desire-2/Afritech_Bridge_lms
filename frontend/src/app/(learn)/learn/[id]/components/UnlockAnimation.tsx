import React from 'react';
import { Button } from '@/components/ui/button';
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
  if (!showUnlockAnimation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
        <div className="mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Module Unlocked!</h3>
          <p className="text-gray-600">
            Congratulations! You've unlocked "{unlockedModuleName}".
          </p>
        </div>
        <Button 
          onClick={onClose} 
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          Continue Learning
        </Button>
      </div>
    </div>
  );
};

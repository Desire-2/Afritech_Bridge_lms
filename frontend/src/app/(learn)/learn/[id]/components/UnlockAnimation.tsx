import React, { useEffect, useRef } from 'react';
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

  return <UnlockDialog unlockedModuleName={unlockedModuleName} onClose={onClose} />;
};

const UnlockDialog: React.FC<{ unlockedModuleName: string | null; onClose: () => void }> = ({
  unlockedModuleName,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl p-6 sm:p-8 w-full max-w-md text-center shadow-2xl"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-unlocked-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 id="module-unlocked-title" className="text-xl font-bold text-gray-900 mb-2">Module Unlocked</h3>
          <p className="text-gray-600">
            You&apos;ve unlocked &quot;{unlockedModuleName}&quot;.
          </p>
        </div>
        <Button 
          onClick={onClose} 
          className="bg-green-600 hover:bg-green-700"
        >
          Continue Learning
        </Button>
      </div>
    </div>
  );
};

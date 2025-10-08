/**
 * Module Unlock Animation Component
 * Celebratory animation when a module is unlocked
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Unlock, Sparkles, Star, Trophy, Zap, PartyPopper } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ModuleUnlockAnimationProps {
  isVisible: boolean;
  moduleName: string;
  onComplete?: () => void;
  celebrationType?: 'unlock' | 'complete' | 'achievement';
}

const ModuleUnlockAnimation: React.FC<ModuleUnlockAnimationProps> = ({
  isVisible,
  moduleName,
  onComplete,
  celebrationType = 'unlock',
}) => {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Trigger confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Show message after icon animation
      setTimeout(() => setShowMessage(true), 500);

      // Auto complete after animation
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isVisible, onComplete]);

  const getIcon = () => {
    switch (celebrationType) {
      case 'unlock':
        return Unlock;
      case 'complete':
        return Trophy;
      case 'achievement':
        return Star;
      default:
        return Unlock;
    }
  };

  const getMessage = () => {
    switch (celebrationType) {
      case 'unlock':
        return `🎉 Module Unlocked!`;
      case 'complete':
        return `🏆 Module Completed!`;
      case 'achievement':
        return `⭐ Achievement Earned!`;
      default:
        return `🎉 Congratulations!`;
    }
  };

  const Icon = getIcon();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onComplete}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ 
              type: "spring", 
              duration: 0.8,
              bounce: 0.5
            }}
            className="relative"
          >
            {/* Pulsing background glow */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 blur-3xl"
            />

            {/* Main icon container */}
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-12 shadow-2xl">
              {/* Rotating sparkles */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      transform: `rotate(${angle}deg) translateY(-80px)`,
                    }}
                  >
                    <Sparkles className="h-6 w-6 text-yellow-400" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Center icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Icon className="h-24 w-24 text-gradient-to-r from-yellow-400 to-orange-500" />
              </motion.div>

              {/* Floating particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: 0, 
                    y: 0,
                    opacity: 0
                  }}
                  animate={{
                    x: Math.cos(i * Math.PI / 4) * 100,
                    y: Math.sin(i * Math.PI / 4) * 100,
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className="absolute top-1/2 left-1/2"
                >
                  <Zap className="h-4 w-4 text-yellow-400" />
                </motion.div>
              ))}
            </div>

            {/* Message */}
            <AnimatePresence>
              {showMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl px-8 py-4 shadow-2xl">
                    <h3 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                      {getMessage()}
                    </h3>
                    <p className="text-center text-sm text-muted-foreground">
                      {moduleName}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Click anywhere to dismiss hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-sm"
          >
            Click anywhere to continue
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModuleUnlockAnimation;

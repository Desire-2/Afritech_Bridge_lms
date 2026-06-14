import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CollapsibleCardProps {
  /** Title shown in the clickable header bar */
  title: string;
  /** Optional icon to show before the title */
  icon?: React.ReactNode;
  /** Content shown when expanded */
  children: React.ReactNode;
  /** Whether the card starts expanded */
  defaultExpanded?: boolean;
  /** Controlled expanded state (external) */
  expanded?: boolean;
  /** Callback when toggled */
  onToggle?: (isOpen: boolean) => void;
  /** Additional classes for the wrapper */
  className?: string;
  /** Badge / extra content shown to the right of the header */
  badge?: React.ReactNode;
  /** Action buttons shown between badge and chevron */
  actions?: React.ReactNode;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  icon,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  className = '',
  badge,
  actions,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(
    controlledExpanded !== undefined ? controlledExpanded : defaultExpanded
  );
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  };

  // Sync with controlled prop
  useEffect(() => {
    if (controlledExpanded !== undefined) {
      setInternalExpanded(controlledExpanded);
    }
  }, [controlledExpanded]);

  return (
    <div className={`rounded-xl border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Clickable header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
          <span className="text-sm font-semibold text-gray-200 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {actions}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleCard;

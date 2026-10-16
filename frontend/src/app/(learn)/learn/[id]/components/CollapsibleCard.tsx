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

  const panelId = `collapsible-panel-${React.useId().replace(/:/g, '')}`;

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-gray-900/50 overflow-hidden ${className}`}>
      {/* Header: the toggle button, badge, and actions are siblings so the
          DOM never contains nested interactive controls. */}
      <div className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-5">
        <button
          type="button"
          onClick={handleToggle}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500 rounded"
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          {icon && <span className="shrink-0 text-gray-400" aria-hidden="true">{icon}</span>}
          <span className="truncate text-sm font-semibold tracking-tight text-gray-100">{title}</span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {actions}
          {/* Decorative duplicate of the toggle for pointer users; keyboard
              users operate the title button. */}
          <button
            type="button"
            onClick={handleToggle}
            tabIndex={-1}
            aria-hidden="true"
            className="rounded focus-visible:outline-none"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleCard;

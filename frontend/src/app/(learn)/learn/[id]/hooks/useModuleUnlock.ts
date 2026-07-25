"use client";

import { useState, useCallback, useRef } from "react";
import { EnhancedModuleUnlockService } from "@/services/enhancedModuleUnlockService";

export interface ModuleUnlockState {
  showUnlockAnimation: boolean;
  unlockedModuleName: string | null;
  showModuleProgressModal: boolean;
  moduleProgressInfo: any | null;
  showLockedModuleModal: boolean;
  lockedModuleInfo: any | null;
  lockedModuleEligibility: any | null;
  lockedModuleEligibilityLoading: boolean;
  lockedModulePrevScoreBreakdown: any | null;
  modalUnlocking: boolean;
  showUnlockErrorDialog: boolean;
  unlockErrorInfo: any | null;
  unlockTargetModuleId: number | null;
}

export function useModuleUnlock() {
  const [state, setState] = useState<ModuleUnlockState>({
    showUnlockAnimation: false,
    unlockedModuleName: null,
    showModuleProgressModal: false,
    moduleProgressInfo: null,
    showLockedModuleModal: false,
    lockedModuleInfo: null,
    lockedModuleEligibility: null,
    lockedModuleEligibilityLoading: false,
    lockedModulePrevScoreBreakdown: null,
    modalUnlocking: false,
    showUnlockErrorDialog: false,
    unlockErrorInfo: null,
    unlockTargetModuleId: null,
  });

  const unlockingRef = useRef(false);
  const checkAndUnlockNextModuleRef = useRef<(() => Promise<void>) | null>(
    null
  );

  const update = useCallback(
    (partial: Partial<ModuleUnlockState>) =>
      setState((prev) => ({ ...prev, ...partial })),
    []
  );

  const checkAndUnlockNextModule = useCallback(async () => {
    if (unlockingRef.current) return;
    unlockingRef.current = true;
    try {
      const result =
        await EnhancedModuleUnlockService.checkAndUnlockNextModule(1);
      if (result.unlocked) {
        update({
          showUnlockAnimation: true,
          unlockedModuleName: result.module_title || "Next Module",
        });
      }
    } catch (error) {
      console.warn("⚠️ Module unlock check failed:", error);
    } finally {
      unlockingRef.current = false;
    }
  }, [update]);

  checkAndUnlockNextModuleRef.current = checkAndUnlockNextModule;

  const fetchLockedModuleEligibility = useCallback(
    async (moduleId: number) => {
      update({ lockedModuleEligibilityLoading: true });
      try {
        const data =
          await EnhancedModuleUnlockService.getModuleUnlockEligibility(
            moduleId
          );
        const moduleData = data as any;
        update({
          lockedModuleEligibility: moduleData,
          lockedModulePrevScoreBreakdown:
            moduleData?.previous_module_breakdown,
        });
      } catch (error) {
        console.error("Failed to fetch module eligibility:", error);
        update({ lockedModuleEligibility: null });
      } finally {
        update({ lockedModuleEligibilityLoading: false });
      }
    },
    [update]
  );

  const handleUnlockModule = useCallback(
    async (moduleId: number) => {
      update({ modalUnlocking: true });
      try {
        const result = await EnhancedModuleUnlockService.unlockModule(moduleId);
        if (result.success) {
          // Read lockedModuleInfo from functional updater to avoid stale closure
          setState((prev) => {
            update({
              showLockedModuleModal: false,
              lockedModuleInfo: null,
              showUnlockAnimation: true,
              unlockedModuleName:
                prev.lockedModuleInfo?.moduleTitle || "Next Module",
            });
            return prev; // Don't change other state
          });
        } else {
          update({
            showUnlockErrorDialog: true,
            unlockErrorInfo: result,
            unlockTargetModuleId: moduleId,
          });
        }
      } catch (error: any) {
        update({
          showUnlockErrorDialog: true,
          unlockErrorInfo: error?.response?.data || {
            message: "Failed to unlock module",
          },
          unlockTargetModuleId: moduleId,
        });
      } finally {
        update({ modalUnlocking: false });
      }
    },
    [update]
  );

  const handleLockedModuleClick = useCallback(
    (info: any) => {
      update({
        showLockedModuleModal: true,
        lockedModuleInfo: info,
      });
      fetchLockedModuleEligibility(info.moduleId);
    },
    [update, fetchLockedModuleEligibility]
  );

  const closeUnlockAnimation = useCallback(() => {
    update({
      showUnlockAnimation: false,
      unlockedModuleName: null,
    });
  }, [update]);

  return {
    ...state,
    checkAndUnlockNextModuleRef,
    checkAndUnlockNextModule,
    handleLockedModuleClick,
    handleUnlockModule,
    fetchLockedModuleEligibility,
    closeUnlockAnimation,
    update,
  };
}

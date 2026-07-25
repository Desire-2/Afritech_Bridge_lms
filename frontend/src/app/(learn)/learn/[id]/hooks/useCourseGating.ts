"use client";

import { useState, useEffect, useCallback } from "react";

export interface CourseGatingState {
  isPaymentRequired: boolean;
  isPaymentPending: boolean;
  isCohortNotStarted: boolean;
  cohortStartDate: string | null;
  cohortStartIso: string | null;
  paymentInfo: Record<string, any> | null;
  paymentModalOpen: boolean;
}

export function useCourseGating(error: string | null, paymentInfo: Record<string, any> | null) {
  const [state, setState] = useState<CourseGatingState>({
    isPaymentRequired: false,
    isPaymentPending: false,
    isCohortNotStarted: false,
    cohortStartDate: null,
    cohortStartIso: null,
    paymentInfo: null,
    paymentModalOpen: false,
  });

  useEffect(() => {
    if (error) {
      const cohortNotStarted =
        paymentInfo?.error_type === "cohort_not_started" ||
        error.toLowerCase().includes("cohort has not started");

      let startDate: string | null = null;
      let startIso: string | null = null;

      if (cohortNotStarted && paymentInfo?.message) {
        const dateMatch = paymentInfo.message.match(/begins on (.+?)\.?$/);
        if (dateMatch) startDate = dateMatch[1];
      }

      if (cohortNotStarted && paymentInfo?.cohort_start) {
        startIso = paymentInfo.cohort_start;
      }

      const paymentRequired =
        !cohortNotStarted &&
        (error.toLowerCase().includes("payment required") ||
          error.toLowerCase().includes("payment must be") ||
          paymentInfo?.payment_required === true);

      const paymentStatus = paymentInfo?.payment_status;
      const hasPendingPayment =
        paymentStatus === "pending_verification" ||
        paymentStatus === "submitted" ||
        paymentStatus === "submitted_with_proof";

      setState({
        isPaymentRequired: paymentRequired,
        isPaymentPending: hasPendingPayment,
        isCohortNotStarted: cohortNotStarted,
        cohortStartDate: startDate,
        cohortStartIso: startIso,
        paymentInfo,
        paymentModalOpen: false,
      });
    } else {
      setState({
        isPaymentRequired: false,
        isPaymentPending: false,
        isCohortNotStarted: false,
        cohortStartDate: null,
        cohortStartIso: null,
        paymentInfo: null,
        paymentModalOpen: false,
      });
    }
  }, [error, paymentInfo]);

  const setPaymentModalOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, paymentModalOpen: open }));
  }, []);

  return {
    ...state,
    setPaymentModalOpen,
  };
}

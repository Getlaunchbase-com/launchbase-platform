/**
 * LaunchBase Analytics Hook
 * Track funnel events from the frontend
 */

import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// Generate or retrieve session ID
function getSessionId(): string {
  const key = "launchbase_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function useAnalytics() {
  const sessionId = useRef(getSessionId());
  const trackMutation = trpc.analytics.track.useMutation();

  const track = useCallback((
    eventName: string,
    options?: {
      intakeId?: number;
      vertical?: string;
      stepNumber?: number;
      metadata?: Record<string, unknown>;
    }
  ) => {
    trackMutation.mutate({
      eventName,
      sessionId: sessionId.current,
      ...options,
    });
  }, [trackMutation]);

  // Track page view on mount
  const trackPageView = useCallback((pageName: string) => {
    track(`page_view_${pageName}`);
  }, [track]);

  // Track CTA click
  const trackCTAClick = useCallback((ctaName: string) => {
    track(`cta_click_${ctaName}`);
  }, [track]);

  // Track onboarding step
  const trackOnboardingStep = useCallback((
    action: "viewed" | "completed",
    stepNumber: number,
    vertical?: string
  ) => {
    track(`onboarding_step_${action}`, {
      stepNumber,
      vertical,
    });
  }, [track]);

  // Track onboarding completion
  const trackOnboardingComplete = useCallback((
    intakeId: number,
    vertical: string
  ) => {
    track("onboarding_completed", {
      intakeId,
      vertical,
    });
  }, [track]);

  // Track onboarding abandonment
  const trackOnboardingAbandoned = useCallback((
    lastStep: number,
    vertical?: string
  ) => {
    track("onboarding_abandoned", {
      stepNumber: lastStep,
      vertical,
    });
  }, [track]);

  return {
    track,
    trackPageView,
    trackCTAClick,
    trackOnboardingStep,
    trackOnboardingComplete,
    trackOnboardingAbandoned,
    sessionId: sessionId.current,
  };
}

// Hook to track page view on mount
export function usePageView(pageName: string) {
  const { trackPageView } = useAnalytics();
  
  useEffect(() => {
    trackPageView(pageName);
  }, [pageName, trackPageView]);
}

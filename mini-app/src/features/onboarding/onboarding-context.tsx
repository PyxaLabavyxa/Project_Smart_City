"use client";
import { createContext, useContext } from "react";

export type OnboardingStatus = "not_started" | "completed" | "skipped";
export const OnboardingContext = createContext<{ start: () => void; activeTarget: string | null; preparing: boolean }>({ start: () => {}, activeTarget: null, preparing: false });
export const useOnboarding = () => useContext(OnboardingContext);

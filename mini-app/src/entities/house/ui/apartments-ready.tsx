"use client";
import type { ReactNode } from "react";
import { useHouseSelection } from "../model/selection-provider";
import { RequestState } from "@/shared/ui/navigation/request-state";

/** Only directory-dependent content waits for the complete house inventory. */
export function ApartmentsReady({ children }: { children: ReactNode }) {
  const { apartmentsState } = useHouseSelection();
  return apartmentsState.loading || apartmentsState.error ? <RequestState {...apartmentsState} page /> : children;
}

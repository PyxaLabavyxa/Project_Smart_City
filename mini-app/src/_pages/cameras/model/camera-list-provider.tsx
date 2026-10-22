"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { array } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { parseCamera } from "./api";
import type { Camera } from "./camera";

type CameraSnapshot = { read: () => Camera[] | undefined; save: (data: Camera[]) => void };
const Context = createContext<CameraSnapshot | null>(null);

/** Kept only in memory, scoped to the signed-in resident and selected apartment. */
export function CameraListProvider({ children }: { children: ReactNode }) {
  const [snapshot] = useState<CameraSnapshot>(() => {
    let data: Camera[] | undefined;
    return { read: () => data, save: cameras => { data = cameras; } };
  });
  return <Context value={snapshot}>{children}</Context>;
}

export function useCameras() {
  const snapshot = useContext(Context);
  if (!snapshot) throw new Error("CameraListProvider is required");
  const { house } = useHouseSelection();
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => {
    const cameras = array(await api(endpoints.cameras(house.id), { signal }), value => parseCamera(value, house));
    signal.throwIfAborted();
    snapshot.save(cameras);
    return cameras;
  }, [api, house, snapshot]);
  return useRemote(load, snapshot.read);
}

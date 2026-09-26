import type { Camera } from "./demo-cameras";
export type CameraFrame = { src: string; capturedAt: string };
export interface CameraGateway { preview(camera: Camera, attempt: number): Promise<CameraFrame> }

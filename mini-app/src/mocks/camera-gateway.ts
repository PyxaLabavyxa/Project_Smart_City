import type { CameraGateway } from "@/_pages/cameras/model/camera-gateway";
import { cameraImage } from "@/_pages/cameras/model/demo-cameras";
export const mockCameraGateway: CameraGateway = {
  async preview(camera, attempt) {
    await new Promise(resolve => setTimeout(resolve, 350));
    if (camera.status === "maintenance") throw new Error("Камера на обслуживании. Изображение пока недоступно.");
    if (camera.status === "unavailable" && attempt === 0) throw new Error("Не удалось получить изображение. Попробуйте подключиться ещё раз.");
    return { src: cameraImage(camera), capturedAt: "2026-09-26T10:42:00+03:00" };
  },
};

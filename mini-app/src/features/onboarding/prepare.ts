import { preloadImages } from "@/shared/ui/image-preload";
import { guideArtwork } from "@/shared/ui/guide-assets";
import { startupImageSources } from "@/shared/ui/artwork-assets";

export function prepareTourImages(poses: readonly (keyof typeof guideArtwork)[], signal: AbortSignal, progress: (percent: number) => void) {
  return preloadImages([...poses.map(pose => guideArtwork[pose].src), ...startupImageSources("/")], signal, progress);
}

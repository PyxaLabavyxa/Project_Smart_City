import type { CSSProperties } from "react";
import homeLight from "../../../public/images/zhorik/home-house.webp";
import homeDark from "../../../public/images/zhorik/home-house-night-v2.webp";
import startupLight from "../../../public/images/zhorik/loading-day.webp";
import startupDark from "../../../public/images/zhorik/loading-night.webp";
import wordmarkLight from "../../../public/images/brand/wordmark-light.webp";
import wordmarkDark from "../../../public/images/brand/wordmark-dark.webp";
import appIcon from "../../../public/images/brand/app-icon.webp";
import landscape from "../../../public/images/zhorik/house-landscape.webp";
import peek from "../../../public/images/zhorik/peek.webp";
import sectionLoadingArtwork from "../../../public/images/zhorik/section-loading.webp";

export { appIcon, sectionLoadingArtwork };
export const homeArtwork = { light: homeLight, dark: homeDark };
export const startupArtwork = { light: startupLight, dark: startupDark };
export const wordmarkArtwork = { light: wordmarkLight, dark: wordmarkDark };
export const elevationArtwork = { landscape, peek };
export function artworkStyle(art: typeof homeArtwork): CSSProperties {
  return { "--art-light": `url("${art.light.src}")`, "--art-dark": `url("${art.dark.src}")` } as CSSProperties;
}
export function startupImageSources(pathname: string): string[] {
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return [wordmarkArtwork[theme].src, sectionLoadingArtwork.src, ...(pathname === "/" ? [homeArtwork[theme].src, landscape.src, peek.src] : [])];
}

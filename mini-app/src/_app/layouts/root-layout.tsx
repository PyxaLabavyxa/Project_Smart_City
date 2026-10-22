import { AppProviders } from "./app-providers";
import type { Metadata, Viewport } from "next";
import { ApplicationShell } from "@/widgets/application-shell";
import "@/shared/styles";
import "../styles/globals.css";
import { appIcon } from "@/shared/ui/artwork-assets";

export const metadata: Metadata = {
  title: "Домовед",
  icons: { icon: appIcon.src, apple: "/images/brand/app-icon.png" },
  description: "Ваш дом, обращения и связь с соседями.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f1f9fc",
};

export function RootLayout({ children, bridge }: Readonly<{ children: React.ReactNode; bridge: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><meta name="color-scheme" content="light dark" suppressHydrationWarning />{bridge}</head>
      <body><AppProviders><ApplicationShell>{children}</ApplicationShell></AppProviders></body>
    </html>
  );
}

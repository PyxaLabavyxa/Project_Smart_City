import { AppProviders } from "./app-providers";
import type { Metadata, Viewport } from "next";
import { ApplicationShell } from "@/widgets/application-shell";
import "@/shared/styles";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Домовед",
  description: "Ваш дом, обращения и связь с соседями.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f8ff",
};

export function RootLayout({ children, bridge }: Readonly<{ children: React.ReactNode; bridge: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>{bridge}</head>
      <body><AppProviders><ApplicationShell>{children}</ApplicationShell></AppProviders></body>
    </html>
  );
}

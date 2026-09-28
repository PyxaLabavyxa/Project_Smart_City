import { AppProviders } from "./app-providers";
import type { Metadata, Viewport } from "next";
import { ApplicationShell } from "@/widgets/application-shell";
import "@/shared/styles";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "ДомПульс",
  description: "Ваш дом, обращения и связь с соседями.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f4",
};

export function RootLayout({ children, bridge }: Readonly<{ children: React.ReactNode; bridge: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>{bridge}</head>
      <body><AppProviders><ApplicationShell>{children}</ApplicationShell></AppProviders></body>
    </html>
  );
}

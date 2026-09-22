import type { Metadata, Viewport } from "next";
import { ApplicationShell } from "@/widgets/application-shell";
import "@/shared/styles";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "ДомПульс",
  description: "Ваш дом и обращения в управляющую компанию.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f4",
};

export function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body><ApplicationShell>{children}</ApplicationShell></body>
    </html>
  );
}

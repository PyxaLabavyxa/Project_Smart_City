import Script from "next/script";
import { RootLayout } from "@/_app/layouts";

export { metadata, viewport } from "@/_app/layouts";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootLayout bridge={<><Script id="domoved-theme" strategy="beforeInteractive">{`try { const theme = localStorage.getItem("domoved:theme:v1"); if (theme === "dark") { document.documentElement.dataset.theme = "dark"; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0c1626"); } } catch {}`}</Script><Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" /></>}>
      {children}
    </RootLayout>
  );
}

import Script from "next/script";
import { themeBootstrap } from "@/features/settings/theme-bootstrap";
import { RootLayout } from "@/_app/layouts";

export { metadata, viewport } from "@/_app/layouts";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootLayout bridge={<><script id="domoved-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} /><Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" /></>}>
      {children}
    </RootLayout>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { GeoProvider } from "@/contexts/GeoContext";
import { PlayModeProvider } from "@/contexts/PlayModeContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ConnectionMonitor from "@/components/ConnectionMonitor";
import MobileTabBar from "@/components/MobileTabBar";
import "./globals.css";
import "@/styles/themes/sci-fi.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkillFlow — Bet On Yourself",
  description:
    "Skill-based wagering platform. Compete head-to-head in skill-based games. No luck. No house edge. Just you vs your opponent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0D0F14" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          // TEMP: debug horizontal overflow on mobile; remove after fixing
          dangerouslySetInnerHTML={{
            __html: `
if (typeof window !== 'undefined') {
  window.addEventListener('load', function () {
    const docWidth = document.documentElement.clientWidth;
    document.querySelectorAll('*').forEach(function (el) {
      if (el.scrollWidth > docWidth + 1) {
        console.log('OVERFLOW ELEMENT:', el.tagName, el.className, el.scrollWidth, 'vs', docWidth);
      }
    });
  });
}
`,
          }}
        />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <GeoProvider>
            <ConnectionMonitor />
            <ToastProvider>
              <PlayModeProvider>
                {children}
                <MobileTabBar />
              </PlayModeProvider>
            </ToastProvider>
          </GeoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

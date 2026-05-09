import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import { GeoProvider } from "@/contexts/GeoContext";
import { PlayModeProvider } from "@/contexts/PlayModeContext";
import ConnectionMonitor from "@/components/ConnectionMonitor";
import MobileTabBar from "@/components/MobileTabBar";
import PracticeModeClassToggle from "@/components/PracticeModeClassToggle";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkillFlow — Bet On Yourself",
  description:
    "Compete in skill-based games. Earn SkillPoints. Climb ranks. Open cases. Join the Founders Program during beta and earn exclusive rewards.",
  keywords:
    "skill gaming, competitive gaming, esports, chess, connect 4, reaction games, earn rewards",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "SkillFlow — Bet On Yourself",
    description:
      "Compete in skill-based games. Earn SkillPoints. Climb ranks. Open cases. Join the Founders Program during beta and earn exclusive rewards.",
    url: "https://skillflow.gg",
  },
  twitter: {
    card: "summary_large_image",
  },
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
        <meta name="theme-color" content="#0E0E12" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
        <GeoProvider>
          <ConnectionMonitor />
          <ToastProvider>
            <PlayModeProvider>
              <ErrorBoundary>
                <PracticeModeClassToggle />
                {children}
                <MobileTabBar />
              </ErrorBoundary>
            </PlayModeProvider>
          </ToastProvider>
        </GeoProvider>
      </body>
    </html>
  );
}

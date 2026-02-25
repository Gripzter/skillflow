import Link from "next/link";
import Footer from "@/components/Footer";

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-charcoal pb-20 md:pb-0">
      {/* Minimal header (no game navbar) */}
      <header className="border-b border-white/5 bg-charcoal/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-white">Skill</span>
            <span className="text-teal">Flow</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-body-gray hover:text-white">
            Back to Site
          </Link>
        </div>
      </header>

      <main
        id="top"
        className="mx-auto max-w-3xl px-4 pt-8 pb-24 text-[15px] leading-relaxed text-gray-300 sm:px-6 md:pt-10"
      >
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-body-gray">Last updated: February 17, 2026</p>
        {children}
      </main>

      <Footer />

      {/* Sticky back-to-top */}
      <a
        href="#top"
        className="fixed bottom-24 right-4 z-40 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm hover:bg-white/20 md:bottom-4"
      >
        Back to top ↑
      </a>
    </div>
  );
}


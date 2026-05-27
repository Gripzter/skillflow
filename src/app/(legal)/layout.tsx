import type { ReactNode } from 'react';
import LegalBackButton from "@/components/LegalBackButton";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="legal-page"
      style={{
        maxWidth: '780px',
        margin: '0 auto',
        padding: '80px 32px 120px',
        fontSize: '14px',
        lineHeight: 1.7,
      }}
    >
      <LegalBackButton />
      {children}
    </div>
  );
}

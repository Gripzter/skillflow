"use client";

import QRStakeNegotiation from "@/components/QRStakeNegotiation";
import { useProfile } from "@/hooks/useProfile";

export default function QRNegotiatePageClient({
  qrMatchId,
  isGuest,
}: {
  qrMatchId: string;
  isGuest: boolean;
}) {
  const { profile } = useProfile();
  return (
    <QRStakeNegotiation
      qrMatchId={qrMatchId}
      isGuest={isGuest}
      balanceSp={profile.balanceSp ?? 0}
    />
  );
}

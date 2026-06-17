import QRNegotiatePageClient from "./QRNegotiatePageClient";

type Props = {
  params: { id: string };
  searchParams: { guest?: string };
};

export default function QRNegotiatePage({ params, searchParams }: Props) {
  const isGuest = searchParams.guest === "1";
  return <QRNegotiatePageClient qrMatchId={params.id} isGuest={isGuest} />;
}

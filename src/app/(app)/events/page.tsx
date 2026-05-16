import { Suspense } from "react";
import EventsContent from "./EventsContent";

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E12]" />}>
      <EventsContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import VelocityLoader from "@/components/VelocityLoader";

function DepositSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [amount, setAmount] = useState(0);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    async function verify() {
      if (!sessionId) {
        setStatus("error");
        return;
      }
      try {
        const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.success) {
          setAmount(Number(data.amount) || 0);
          setStatus("success");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }
    verify();
  }, [sessionId]);

  if (status === "loading") {
    return <VelocityLoader />;
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username=""
        isDevMode={false}
        onLogout={async () => {}}
        loggingOut={false}
        currentPage="wallet"
      />

      <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-8 text-center">
          {status === "success" && (
            <>
              <h1 className="text-2xl font-bold text-white">Deposit Successful!</h1>
              <p className="mt-3 text-3xl font-bold text-teal">+${amount.toFixed(2)}</p>
              <p className="mt-2 text-body-gray">Funds have been added to your wallet.</p>
              <button
                type="button"
                onClick={() => router.push("/wallet")}
                className="mt-6 w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Go to Wallet
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
              <p className="mt-4 text-body-gray">
                Your deposit could not be confirmed. If money was charged, it will be refunded automatically.
              </p>
              <button
                type="button"
                onClick={() => router.push("/wallet")}
                className="mt-6 w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow"
              >
                Go to Wallet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DepositSuccessPage() {
  return (
    <Suspense fallback={<VelocityLoader />}>
      <DepositSuccessContent />
    </Suspense>
  );
}

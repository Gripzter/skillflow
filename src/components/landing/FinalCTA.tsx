"use client";

export default function FinalCTA() {
  return (
    <section id="about" className="border-t border-[#1a1a22]">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-12 text-center">
        <h2 className="text-[36px] font-medium tracking-[-1px] text-white">Your skill. Your rank. Your move.</h2>
        <p className="mt-3 text-[14px] text-[#888]">Free to start. No credit card. Climb from your phone or desktop.</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/auth/signup";
          }}
          className="mt-6 rounded-[8px] bg-[#FF5E00] px-8 py-3.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Play free →
        </button>
      </div>
    </section>
  );
}

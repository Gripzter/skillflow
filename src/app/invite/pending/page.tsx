export default function InvitePendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center">
      <div className="mb-8 text-2xl font-bold text-[#FFFF00]">SkillFlow</div>
      <h1 className="text-3xl font-semibold lowercase text-white">application received.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#C8C8D4]">
        AX reviews every creator personally. You&apos;ll hear from us within 48 hours.
      </p>
      <p className="mt-3 max-w-md text-sm text-[#7A7A8E]">
        In the meantime, check out{" "}
        <a href="https://skillflow.gg" className="text-[#FFFF00] underline">
          skillflow.gg
        </a>
      </p>
    </div>
  );
}

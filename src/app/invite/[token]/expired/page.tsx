export default function InviteExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center">
      <div className="mb-8 text-2xl font-bold text-[#FFFF00]">SkillFlow</div>
      <h1 className="text-3xl font-semibold lowercase text-white">this invite has expired.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#7A7A8E]">
        Invite links are valid for 7 days. If you received this from SkillFlow, reach out to{" "}
        <a href="mailto:ax@skillflow.gg" className="text-[#FFFF00] underline">
          ax@skillflow.gg
        </a>{" "}
        for a new one.
      </p>
    </div>
  );
}

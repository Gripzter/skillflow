"use client";

export default function CreatorNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-8 flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">SkillFlow</span>
        <span
          className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black"
          style={{ background: "#FFFF00" }}
        >
          creator
        </span>
      </div>

      <h1 className="text-3xl font-semibold lowercase text-white">creator access required.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#7A7A8E]">
        this area is for invited game creators only. if you received an invite from skillflow,
        contact{" "}
        <a href="mailto:ax@skillflow.gg" className="text-[#FFFF00] underline">
          ax@skillflow.gg
        </a>
      </p>
      <p className="mt-2 max-w-md text-sm text-[#7A7A8E]">
        you don&apos;t have a creator account. if you received an invite, contact{" "}
        <a href="mailto:ax@skillflow.gg" className="text-[#FFFF00] underline">
          ax@skillflow.gg
        </a>
      </p>

      <button
        type="button"
        onClick={() => {
          window.location.href = "/";
        }}
        className="mt-8 rounded-lg px-6 py-3 text-sm font-medium lowercase text-black"
        style={{ background: "#FFFF00" }}
      >
        back to skillflow
      </button>
    </div>
  );
}

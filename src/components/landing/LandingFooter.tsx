import Wordmark from "@/components/Wordmark";
import CookieSettingsButton from "@/components/CookieSettingsButton";

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#1a1a22]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-8 py-6 text-[11px] text-[#666] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Wordmark href="" size="sm" className="text-[16px]" />
          <span className="text-[#444]">© 2026 SkillFlow, operated by Xmas Group</span>
        </div>

        <div style={{ display: "flex", gap: 20, fontSize: 11, color: "#666", flexWrap: "wrap" }}>
          <a href="/terms" style={{ color: "#666" }}>
            Terms
          </a>
          <a href="/privacy" style={{ color: "#666" }}>
            Privacy
          </a>
          <CookieSettingsButton
            className="cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] hover:text-white"
          >
            Cookie Settings
          </CookieSettingsButton>
          <a href="/acceptable-use" style={{ color: "#666" }}>
            Acceptable Use
          </a>
          <a href="/skillies" style={{ color: "#666" }}>
            About Skillies
          </a>
          <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" style={{ color: "#666" }}>
            Discord
          </a>
          <a href="https://x.com/skillflowgg" target="_blank" rel="noopener noreferrer" style={{ color: "#666" }}>
            Twitter
          </a>
        </div>
      </div>
    </footer>
  );
}

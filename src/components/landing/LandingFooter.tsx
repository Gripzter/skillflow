export default function LandingFooter() {
  return (
    <footer className="border-t border-[#1a1a22]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-8 py-6 text-[11px] text-[#666] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-[3px] rounded-[2px] bg-[#FFFF00]" />
          <span>skillflow</span>
          <span className="text-[#444]">© 2026 Xmas Group</span>
        </div>

        <div style={{ display: "flex", gap: 20, fontSize: 11, color: "#666", flexWrap: "wrap" }}>
          <a href="/terms" style={{ color: "#666" }}>
            Terms
          </a>
          <a href="/privacy" style={{ color: "#666" }}>
            Privacy
          </a>
          <a href="/acceptable-use" style={{ color: "#666" }}>
            Acceptable Use
          </a>
          <a href="/skillies" style={{ color: "#666" }}>
            About Skillies
          </a>
          <a href="#" style={{ color: "#666" }}>
            Discord
          </a>
          <a href="#" style={{ color: "#666" }}>
            Twitter
          </a>
        </div>
      </div>
    </footer>
  );
}

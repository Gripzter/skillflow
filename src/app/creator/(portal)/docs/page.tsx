import fs from "fs";
import path from "path";
import CreatorDocsContent from "@/components/creator/CreatorDocsContent";

export default function CreatorDocsPage() {
  const docsPath = path.join(process.cwd(), "lib", "sdk-docs.md");
  let markdown = "";

  try {
    markdown = fs.readFileSync(docsPath, "utf8");
  } catch {
    markdown = "# documentation unavailable\n\nCould not load sdk-docs.md.";
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold lowercase text-white">documentation</h1>
      <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-6 sm:p-8">
        <CreatorDocsContent markdown={markdown} />
      </div>
    </div>
  );
}

import Link from "next/link";

type WordmarkProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { text: "text-lg", bar: "h-5 w-[3px]", gap: "gap-2" },
  md: { text: "text-2xl", bar: "h-6 w-[4px]", gap: "gap-2.5" },
  lg: { text: "text-5xl", bar: "h-12 w-[6px]", gap: "gap-4" },
} as const;

export default function Wordmark({
  href = "/play",
  size = "sm",
  className = "",
}: WordmarkProps) {
  const s = sizeMap[size];

  const content = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <span
        aria-hidden="true"
        className={`${s.bar} inline-block bg-[#FFFF00]`}
      />
      <span
        className={`select-none font-black leading-none tracking-tight text-white lowercase ${s.text}`}
        style={{ fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.03em" }}
      >
        skillflow
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}

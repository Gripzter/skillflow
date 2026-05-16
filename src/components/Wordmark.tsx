import Link from "next/link";

type WordmarkProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
} as const;

export default function Wordmark({
  href = "/play",
  size = "sm",
  className = "",
}: WordmarkProps) {
  const content = (
    <span
      className={`select-none font-black leading-none tracking-tight ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}
    >
      <span className="text-white">Skill</span>
      <span className="text-[#FFFF00]">Flow</span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}

"use client";

type SkilliesIconProps = {
  size?: number;
  className?: string;
};

export default function SkilliesIcon({ size = 20, className = "" }: SkilliesIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/skillies-token.png"
      alt="Skillies token"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

"use client";

type SPIconProps = {
  size?: number;
  className?: string;
};

export default function SPIcon({ size = 20, className = "" }: SPIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/sp-token.png"
      alt="SP token"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

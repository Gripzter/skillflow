type Props = {
  count: number;
  color: "yellow" | "red";
};

export default function BlockadeWallPips({ count, color }: Props) {
  const textColor = color === "yellow" ? "text-[#FFFF00]" : "text-[#FF6B6B]";
  return (
    <p className={`text-xs font-medium ${textColor}`}>
      Walls: {count}
    </p>
  );
}

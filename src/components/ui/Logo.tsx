import { IconCamera } from "@/components/ui/icons";

export default function Logo({
  light = false,
  size = "md"
}: {
  light?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7 rounded-[0.55rem]" : "h-8 w-8 rounded-[0.65rem]";
  const icon = size === "sm" ? 15 : 17;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`relative flex ${box} items-center justify-center overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm`}
      >
        <IconCamera width={icon} height={icon} className="text-white" strokeWidth={2} />
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-white/15 blur-[2px]" />
      </span>
      <span
        className={`text-[17px] font-semibold tracking-tight ${
          light ? "text-white" : "text-ink-900"
        }`}
      >
        Vibe Studio
      </span>
    </span>
  );
}
import type { LucideIcon } from "lucide-react";

/**
 * macOS Settings.app-style category badge.
 *
 * A colored, rounded-square tile with a white Lucide glyph centered inside.
 * The gradient + rounded corners match the visual language users see in
 * macOS 14+ System Settings (System = grey gear, Notifications = red bell,
 * Accessibility = blue person, etc.), which is what the user asked for.
 *
 * The gradient lives on the wrapper; the Lucide glyph takes `currentColor`
 * (white) so tint changes are single-source-of-truth.
 */

export type CategoryIconColor =
  | "graphite"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "brown";

const GRADIENTS: Record<CategoryIconColor, string> = {
  graphite: "linear-gradient(180deg, #8e8e93 0%, #636366 100%)",
  blue: "linear-gradient(180deg, #4ca7ff 0%, #0a84ff 100%)",
  indigo: "linear-gradient(180deg, #7d7dff 0%, #5e5ce6 100%)",
  purple: "linear-gradient(180deg, #c87aff 0%, #bf5af2 100%)",
  pink: "linear-gradient(180deg, #ff6aa4 0%, #ff375f 100%)",
  red: "linear-gradient(180deg, #ff6961 0%, #ff3b30 100%)",
  orange: "linear-gradient(180deg, #ffa34d 0%, #ff9500 100%)",
  yellow: "linear-gradient(180deg, #ffd666 0%, #ffcc00 100%)",
  green: "linear-gradient(180deg, #5bd778 0%, #30d158 100%)",
  teal: "linear-gradient(180deg, #55d6c8 0%, #30c8b6 100%)",
  cyan: "linear-gradient(180deg, #6accff 0%, #32ade6 100%)",
  brown: "linear-gradient(180deg, #c4916b 0%, #a2845e 100%)",
};

interface CategoryIconProps {
  icon: LucideIcon;
  color: CategoryIconColor;
  size?: number;
}

export function CategoryIcon({ icon: Icon, color, size = 18 }: CategoryIconProps) {
  const radius = Math.round(size * 0.26);
  const glyph = Math.round(size * 0.62);
  return (
    <span
      className="cat-badge"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: GRADIENTS[color],
      }}
    >
      <Icon
        size={glyph}
        strokeWidth={2.5}
        color="#ffffff"
        absoluteStrokeWidth
        aria-hidden
      />
    </span>
  );
}

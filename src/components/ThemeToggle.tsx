import { IconButton } from "@astryxdesign/core/IconButton";
import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../lib/pads";

type ThemeToggleProps = {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
};

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const next = theme === "light" ? "dark" : "light";
  const label = `Switch to ${next} theme`;

  return (
    <IconButton
      className={className ?? "no-drag"}
      variant="ghost"
      size="lg"
      label={label}
      tooltip={label}
      icon={theme === "dark" ? <Sun /> : <Moon />}
      onClick={onToggle}
    />
  );
}

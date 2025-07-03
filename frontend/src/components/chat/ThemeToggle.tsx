import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="p-3 rounded-xl glass-button glow-border smooth-transition"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <SunIcon className="w-5 h-5 text-accent" />
      ) : (
        <MoonIcon className="w-5 h-5 text-accent" />
      )}
    </button>
  );
}

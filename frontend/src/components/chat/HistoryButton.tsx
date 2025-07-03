import { ClockIcon } from "@heroicons/react/24/outline";

interface HistoryButtonProps {
  onClick: () => void;
}

export function HistoryButton({ onClick }: HistoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-xl glass-button glow-border smooth-transition"
      aria-label="View conversation history"
    >
      <ClockIcon className="w-5 h-5 text-accent" />
    </button>
  );
}

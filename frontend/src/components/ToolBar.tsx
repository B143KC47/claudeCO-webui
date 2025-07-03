import { useState } from "react";
import { 
  ComputerDesktopIcon, 
  CommandLineIcon, 
  FolderIcon,
  XMarkIcon 
} from "@heroicons/react/24/outline";
import { BrowserPanel } from "./toolbar/BrowserPanel";
import { TerminalPanel } from "./toolbar/TerminalPanel";
import { ExplorerPanel } from "./toolbar/ExplorerPanel";
import { BUTTON_STYLES } from "../utils/constants";

type ToolBarTab = "browser" | "terminal" | "explorer";

interface ToolBarProps {
  workingDirectory?: string;
}

export function ToolBar({ workingDirectory }: ToolBarProps) {
  const [activeTab, setActiveTab] = useState<ToolBarTab>("browser");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs = [
    {
      id: "browser" as const,
      label: "Browser",
      icon: ComputerDesktopIcon,
    },
    {
      id: "terminal" as const,
      label: "Terminal", 
      icon: CommandLineIcon,
    },
    {
      id: "explorer" as const,
      label: "Explorer",
      icon: FolderIcon,
    },
  ];

  const renderActivePanel = () => {
    switch (activeTab) {
      case "browser":
        return <BrowserPanel />;
      case "terminal":
        return <TerminalPanel workingDirectory={workingDirectory} />;
      case "explorer":
        return <ExplorerPanel workingDirectory={workingDirectory} />;
      default:
        return null;
    }
  };

  if (isCollapsed) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="px-3 py-2 glass-button glow-border smooth-transition rounded-lg text-sm text-secondary hover:text-primary"
        >
          Show Tools
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 glass-card rounded-xl glow-effect">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-accent/20 px-4 py-3">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg smooth-transition text-sm font-medium
                  ${isActive 
                    ? "bg-gradient-primary text-primary glow-effect" 
                    : "text-secondary hover:text-primary hover:bg-black-secondary/50"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-2 text-tertiary hover:text-primary smooth-transition rounded-lg hover:bg-black-secondary/50"
          aria-label="Collapse toolbar"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-4">
        {renderActivePanel()}
      </div>
    </div>
  );
} 
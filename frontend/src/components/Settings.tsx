import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, CogIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { MCPTab } from "./settings/MCPTab";
import { BillTab } from "./settings/BillTab";

type TabType = "mcp" | "bill";

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>("mcp");
  const navigate = useNavigate();

  const tabs = [
    {
      id: "mcp" as TabType,
      name: "MCP",
      icon: CogIcon,
      description: "MCP Server Configuration",
    },
    {
      id: "bill" as TabType,
      name: "Bill",
      icon: CurrencyDollarIcon,
      description: "Usage & Billing",
    },
  ];

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-black-primary smooth-transition">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-black-primary border-r border-accent">
          {/* Header */}
          <div className="p-6 border-b border-accent">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-secondary hover:text-primary smooth-transition mb-4"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              <span>Back</span>
            </button>
            <h1 className="text-primary text-gradient text-2xl font-bold tracking-tight">
              Settings
            </h1>
          </div>

          {/* Navigation */}
          <nav className="p-4">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg smooth-transition text-left ${
                      isActive
                        ? "bg-gradient-primary glow-effect text-primary"
                        : "glass-card hover:glow-effect text-secondary hover:text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{tab.name}</div>
                      <div className="text-xs opacity-70">{tab.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {activeTab === "mcp" && <MCPTab />}
            {activeTab === "bill" && <BillTab />}
          </div>
        </div>
      </div>
    </div>
  );
} 
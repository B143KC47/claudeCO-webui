import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeftIcon,
  CogIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { MCPTab } from "./settings/MCPTab";
import { BillTab } from "./settings/BillTab";
import { GeneralTab } from "./settings/GeneralTab";
import { DeviceTab } from "./settings/DeviceTab";
import { useLanguage } from "../contexts/LanguageContext";

type TabType = "general" | "mcp" | "bill" | "devices";

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tabs = [
    {
      id: "general" as TabType,
      name: t("settings.general"),
      icon: Cog6ToothIcon,
      description: t("settings.general.desc"),
    },
    {
      id: "mcp" as TabType,
      name: t("settings.mcp"),
      icon: CogIcon,
      description: t("settings.mcp.desc"),
    },
    {
      id: "bill" as TabType,
      name: t("settings.bill"),
      icon: CurrencyDollarIcon,
      description: t("settings.bill.desc"),
    },
    {
      id: "devices" as TabType,
      name: "Devices",
      icon: DevicePhoneMobileIcon,
      description: "Manage connected devices and mobile access",
    },
  ];

  const handleBack = () => {
    navigate(-1);
  };

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-black-primary smooth-transition">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-black-primary border-b border-accent">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-secondary hover:text-primary smooth-transition"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            <span>{t("nav.back")}</span>
          </button>
          <h1 className="text-primary text-gradient text-xl font-bold tracking-tight">
            {t("nav.settings")}
          </h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-secondary hover:text-primary smooth-transition"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Tab Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-black-primary border-b border-accent shadow-lg">
            <nav className="p-4">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg smooth-transition text-left ${
                        isActive
                          ? "bg-gradient-primary glow-effect text-primary"
                          : "glass-card hover:glow-effect text-secondary hover:text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{tab.name}</div>
                        <div className="text-xs opacity-70">
                          {tab.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        )}
      </div>

      <div className="flex h-screen lg:pt-0 pt-16">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 bg-black-primary border-r border-accent">
          {/* Header */}
          <div className="p-6 border-b border-accent">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-secondary hover:text-primary smooth-transition mb-4"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              <span>{t("nav.back")}</span>
            </button>
            <h1 className="text-primary text-gradient text-2xl font-bold tracking-tight">
              {t("nav.settings")}
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
                      <div className="text-xs opacity-70">
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 lg:p-8">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "mcp" && <MCPTab />}
            {activeTab === "bill" && <BillTab />}
            {activeTab === "devices" && <DeviceTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

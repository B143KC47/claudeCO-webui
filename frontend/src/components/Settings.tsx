import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeftIcon,
  CogIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { MCPTab } from "./settings/MCPTab";
import { BillTab } from "./settings/BillTab";
import { GeneralTab } from "./settings/GeneralTab";
import { DeviceTab } from "./settings/DeviceTab";
import { useLanguage } from "../contexts/LanguageContext";

type TabType = "general" | "mcp" | "bill" | "devices";

interface SearchableItem {
  id: string;
  title: string;
  description: string;
  tab: TabType;
  keywords: string[];
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
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

  // Searchable settings items
  const searchableItems: SearchableItem[] = [
    {
      id: "language",
      title: "Language",
      description: "Change application language",
      tab: "general",
      keywords: ["language", "中文", "english", "locale", "translation"],
    },
    {
      id: "theme",
      title: "Theme",
      description: "Switch between light and dark themes",
      tab: "general",
      keywords: ["theme", "dark", "light", "appearance", "mode"],
    },
    {
      id: "mcp-servers",
      title: "MCP Servers",
      description: "Manage Model Context Protocol servers",
      tab: "mcp",
      keywords: ["mcp", "servers", "tools", "plugins", "extensions"],
    },
    {
      id: "usage",
      title: "Usage & Billing",
      description: "View usage statistics and costs",
      tab: "bill",
      keywords: ["usage", "billing", "cost", "analytics", "statistics"],
    },
    {
      id: "devices",
      title: "Connected Devices",
      description: "Manage mobile and desktop devices",
      tab: "devices",
      keywords: ["devices", "mobile", "phone", "tablet", "authentication"],
    },
  ];

  // Filter search results
  const searchResults = searchQuery.trim()
    ? searchableItems.filter((item) => {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.keywords.some((keyword) => keyword.includes(query))
        );
      })
    : [];

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal(!showSearchModal);
        setSearchQuery("");
      }

      // Escape to close search
      if (e.key === "Escape" && showSearchModal) {
        setShowSearchModal(false);
        setSearchQuery("");
      }

      // Number keys 1-4 to switch tabs (when search is not open)
      if (!showSearchModal && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearchModal, tabs]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const handleSearchResultClick = (item: SearchableItem) => {
    setActiveTab(item.tab);
    setShowSearchModal(false);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-black-primary smooth-transition">
      {/* Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-2xl glass-card progressive-blur-heavy border-accent/30 rounded-2xl shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="p-4 border-b border-accent/20">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-tertiary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search settings..."
                  className="w-full pl-10 pr-10 py-3 bg-transparent text-primary text-lg placeholder-tertiary focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tertiary hover:text-primary smooth-transition"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-[400px] overflow-y-auto">
              {searchQuery.trim() === "" ? (
                <div className="p-8 text-center">
                  <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-accent opacity-50 mb-3" />
                  <p className="text-secondary">
                    Start typing to search settings...
                  </p>
                  <div className="mt-4 text-xs text-tertiary space-y-1">
                    <p>Try searching for: language, theme, devices, mcp</p>
                  </div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="p-2">
                  {searchResults.map((item) => {
                    const TabIcon =
                      tabs.find((t) => t.id === item.tab)?.icon ||
                      Cog6ToothIcon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSearchResultClick(item)}
                        className="w-full flex items-center gap-3 p-4 rounded-lg hover:bg-gradient-primary/20 smooth-transition text-left group"
                      >
                        <div className="p-2 bg-gradient-primary/10 rounded-lg border border-accent/20 group-hover:border-accent/40 smooth-transition">
                          <TabIcon className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-primary truncate">
                            {item.title}
                          </div>
                          <div className="text-sm text-secondary truncate">
                            {item.description}
                          </div>
                          <div className="text-xs text-tertiary mt-1">
                            {tabs.find((t) => t.id === item.tab)?.name} →
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-secondary">
                    No settings found for "{searchQuery}"
                  </p>
                  <p className="text-tertiary text-sm mt-2">
                    Try a different search term
                  </p>
                </div>
              )}
            </div>

            {/* Footer Hints */}
            <div className="p-3 border-t border-accent/20 flex items-center justify-between text-xs text-tertiary">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-black-secondary rounded border border-accent/20">
                    Esc
                  </kbd>
                  Close
                </span>
              </div>
              <span className="flex items-center gap-1">
                Press
                <kbd className="px-2 py-1 bg-black-secondary rounded border border-accent/20">
                  ⌘K
                </kbd>
                to toggle
              </span>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-3">
            <h1 className="text-primary text-gradient text-xl font-bold tracking-tight">
              {t("nav.settings")}
            </h1>
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-2 text-secondary hover:text-accent smooth-transition"
              title="Search settings (⌘K)"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </div>
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
            <div className="flex items-center justify-between">
              <h1 className="text-primary text-gradient text-2xl font-bold tracking-tight">
                {t("nav.settings")}
              </h1>
              <button
                onClick={() => setShowSearchModal(true)}
                className="p-2 text-secondary hover:text-accent smooth-transition rounded-lg"
                title="Search settings (⌘K)"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <div className="p-4 border-b border-accent/20">
            <button
              onClick={() => setShowSearchModal(true)}
              className="w-full flex items-center gap-2 p-3 glass-card hover:glow-effect smooth-transition rounded-lg text-secondary"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              <span className="text-sm">Search settings...</span>
              <kbd className="ml-auto px-2 py-1 text-xs bg-black-secondary rounded border border-accent/20">
                ⌘K
              </kbd>
            </button>
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
            <div key={activeTab} className="animate-tab-fade-in">
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "mcp" && <MCPTab />}
              {activeTab === "bill" && <BillTab />}
              {activeTab === "devices" && <DeviceTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

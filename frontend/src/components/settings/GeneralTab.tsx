import { useState } from "react";
import {
  LanguageIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../hooks/useTheme";

type Language = "en" | "zh";

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

export function GeneralTab() {
  const { language: currentLanguage, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isLoading] = useState(false);

  const handleLanguageChange = (language: Language) => {
    setLanguage(language);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-black-tertiary rounded w-48"></div>
        <div className="glass-card p-6">
          <div className="space-y-4">
            <div className="h-6 bg-black-tertiary rounded w-32"></div>
            <div className="space-y-3">
              <div className="h-16 bg-black-quaternary rounded"></div>
              <div className="h-16 bg-black-quaternary rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary text-gradient mb-2">
          {t("settings.general.title")}
        </h2>
        <p className="text-secondary">{t("settings.general.subtitle")}</p>
      </div>

      {/* Appearance Section */}
      <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-primary">Appearance</h3>
          </div>

          {/* Theme Toggle Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Light Theme Card */}
            <button
              onClick={() => theme === "dark" && toggleTheme()}
              className={`relative p-6 rounded-xl border-2 smooth-transition group ${
                theme === "light"
                  ? "border-accent bg-gradient-primary/20 shadow-lg shadow-accent/20"
                  : "border-accent/30 glass-card hover:border-accent/50 hover:shadow-md"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`p-4 rounded-xl ${
                    theme === "light"
                      ? "bg-gradient-primary/30"
                      : "bg-white/5 group-hover:bg-white/10"
                  } smooth-transition`}
                >
                  <SunIcon
                    className={`h-8 w-8 ${
                      theme === "light" ? "text-accent" : "text-secondary"
                    } smooth-transition`}
                  />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-primary">Light</div>
                  <div className="text-xs text-secondary mt-1">
                    Bright interface
                  </div>
                </div>
              </div>
              {theme === "light" && (
                <div className="absolute top-3 right-3">
                  <CheckIcon className="h-5 w-5 text-accent" />
                </div>
              )}
            </button>

            {/* Dark Theme Card */}
            <button
              onClick={() => theme === "light" && toggleTheme()}
              className={`relative p-6 rounded-xl border-2 smooth-transition group ${
                theme === "dark"
                  ? "border-accent bg-gradient-primary/20 shadow-lg shadow-accent/20"
                  : "border-accent/30 glass-card hover:border-accent/50 hover:shadow-md"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`p-4 rounded-xl ${
                    theme === "dark"
                      ? "bg-gradient-primary/30"
                      : "bg-white/5 group-hover:bg-white/10"
                  } smooth-transition`}
                >
                  <MoonIcon
                    className={`h-8 w-8 ${
                      theme === "dark" ? "text-accent" : "text-secondary"
                    } smooth-transition`}
                  />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-primary">Dark</div>
                  <div className="text-xs text-secondary mt-1">
                    Easy on the eyes
                  </div>
                </div>
              </div>
              {theme === "dark" && (
                <div className="absolute top-3 right-3">
                  <CheckIcon className="h-5 w-5 text-accent" />
                </div>
              )}
            </button>
          </div>

          <div className="mt-4 p-3 bg-black-quaternary/50 rounded-lg">
            <p className="text-xs text-secondary">
              <span className="font-medium text-primary">Tip:</span> Theme
              preference is saved automatically and synced across sessions.
            </p>
          </div>
        </div>
      </div>

      {/* Language Selection */}
      <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LanguageIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-primary">
              {t("settings.language")} / 语言
            </h3>
          </div>

          <div className="space-y-3">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full p-4 rounded-xl border-2 smooth-transition flex items-center justify-between group ${
                  currentLanguage === language.code
                    ? "border-accent bg-gradient-primary/20 shadow-lg shadow-accent/20"
                    : "border-accent/30 glass-card hover:border-accent/50 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="text-4xl transition-transform group-hover:scale-110"
                    role="img"
                    aria-label={language.name}
                  >
                    {language.flag}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-primary">
                      {language.name}
                    </div>
                    <div className="text-sm text-secondary">
                      {language.nativeName}
                    </div>
                  </div>
                </div>
                {currentLanguage === language.code && (
                  <CheckIcon className="h-5 w-5 text-accent flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-black-quaternary/50 rounded-lg">
            <p className="text-xs text-secondary">
              <span className="font-medium text-primary">Note:</span>{" "}
              {t("settings.language.note")}
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <CommandLineIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-primary">
              Keyboard Shortcuts
            </h3>
          </div>

          <div className="space-y-3">
            {/* Search Settings */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-black-quaternary/50 border border-accent/10 hover:border-accent/30 smooth-transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary/20 rounded-lg border border-accent/30">
                  <MagnifyingGlassIcon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-medium text-primary">
                    Search Settings
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    Quick access to any setting
                  </div>
                </div>
              </div>
              <kbd className="px-3 py-1.5 bg-black-secondary rounded-lg border border-accent/20 text-xs font-mono text-primary">
                ⌘K
              </kbd>
            </div>

            {/* Switch Tabs */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-black-quaternary/50 border border-accent/10 hover:border-accent/30 smooth-transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary/20 rounded-lg border border-accent/30">
                  <span className="text-accent font-bold text-sm">1-4</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-primary">
                    Switch Tabs
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    Jump between settings sections
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {["1", "2", "3", "4"].map((num) => (
                  <kbd
                    key={num}
                    className="px-2 py-1 bg-black-secondary rounded border border-accent/20 text-xs font-mono text-primary min-w-[24px] text-center"
                  >
                    {num}
                  </kbd>
                ))}
              </div>
            </div>

            {/* Close Modal */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-black-quaternary/50 border border-accent/10 hover:border-accent/30 smooth-transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-primary/20 rounded-lg border border-accent/30">
                  <XMarkIcon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-medium text-primary">
                    Close Dialogs
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    Close search or modals
                  </div>
                </div>
              </div>
              <kbd className="px-3 py-1.5 bg-black-secondary rounded-lg border border-accent/20 text-xs font-mono text-primary">
                Esc
              </kbd>
            </div>
          </div>

          <div className="mt-4 p-3 bg-black-quaternary/50 rounded-lg">
            <p className="text-xs text-secondary">
              <span className="font-medium text-primary">Tip:</span> Press{" "}
              <kbd className="px-1.5 py-0.5 bg-black-secondary rounded text-[10px] border border-accent/20">
                ⌘K
              </kbd>{" "}
              at any time to quickly search and navigate settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { LanguageIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "../../contexts/LanguageContext";

type Language = "en" | "zh";

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

const languages: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

export function GeneralTab() {
  const { language: currentLanguage, setLanguage, t } = useLanguage();
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

      {/* Current Language Display for Testing */}
      <div className="p-3 bg-black-quaternary rounded-lg text-sm text-secondary">
        Current language:{" "}
        <span className="text-primary font-medium">
          {currentLanguage === "en" ? "English" : "中文"}
        </span>
      </div>

      {/* Language Selection */}
      <div className="glass-card p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LanguageIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-primary">
              {t("settings.language")} / 语言
            </h3>
          </div>

          <div className="space-y-3">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full p-4 rounded-lg border-2 smooth-transition flex items-center justify-between ${
                  currentLanguage === language.code
                    ? "border-primary bg-gradient-primary glow-effect"
                    : "border-accent hover:border-secondary glass-card hover:glow-effect"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <div
                      className={`font-medium ${
                        currentLanguage === language.code
                          ? "text-primary"
                          : "text-primary"
                      }`}
                    >
                      {language.name}
                    </div>
                    <div
                      className={`text-sm ${
                        currentLanguage === language.code
                          ? "text-secondary"
                          : "text-secondary opacity-70"
                      }`}
                    >
                      {language.nativeName}
                    </div>
                  </div>
                </div>
                {currentLanguage === language.code && (
                  <CheckIcon className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-black-quaternary rounded-lg">
            <p className="text-sm text-secondary">
              <span className="font-medium text-primary">Note:</span>{" "}
              {t("settings.language.note")}
            </p>
          </div>
        </div>
      </div>

      {/* Future settings can be added here */}
      <div className="glass-card p-6 opacity-50">
        <h3 className="text-lg font-semibold text-primary mb-2">
          {t("settings.moreComing")}
        </h3>
        <p className="text-secondary text-sm">{t("settings.moreComingDesc")}</p>
      </div>
    </div>
  );
}

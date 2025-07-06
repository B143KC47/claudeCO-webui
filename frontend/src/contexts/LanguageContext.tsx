import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

type Language = "en" | "zh";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    "nav.back": "Back",
    "nav.settings": "Settings",
    "nav.newChat": "New Chat",

    // Settings
    "settings.general": "General",
    "settings.general.desc": "General Settings",
    "settings.general.title": "General Settings",
    "settings.general.subtitle": "Configure general application preferences",
    "settings.mcp": "MCP",
    "settings.mcp.desc": "MCP Server Configuration",
    "settings.bill": "Bill",
    "settings.bill.desc": "Usage & Billing",
    "settings.language": "Language",
    "settings.language.note":
      "Language changes will take effect immediately. Some parts of the application may require a refresh to fully update.",
    "settings.moreComing": "More Settings Coming Soon",
    "settings.moreComingDesc":
      "Additional general settings will be available in future updates.",

    // Project Selector
    "project.title": "Select Project Directory",
    "project.subtitle": "Choose a project directory to work with Claude",
    "project.configured": "Configured Projects",
    "project.configuredDesc": "Projects from your Claude configuration",
    "project.custom": "Custom Directory",
    "project.customDesc": "Enter a custom directory path",
    "project.enterPath": "Enter directory path...",
    "project.continue": "Continue",
    "project.noProjects": "No configured projects found",
    "project.configureHelp": "Configure projects in your Claude settings",

    // Chat
    "chat.placeholder": "Type a message...",
    "chat.send": "Send",
    "chat.thinking": "Claude is thinking...",
    "chat.error": "Error",
    "chat.abort": "Abort",
    "chat.newSession": "New Session",
    "chat.stop": "Stop",
    "chat.retry": "Retry",
    "chat.copy": "Copy",
    "chat.copied": "Copied!",

    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.success": "Success",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.continue": "Continue",
    "common.back": "Back",
    "common.next": "Next",
    "common.retry": "Retry",
    "common.refresh": "Refresh",

    // ChatPage
    "chat.title": "Claude Code Web UI",
    "chat.conversationHistory": "Conversation History",
    "chat.backToChat": "Back to chat",
    "chat.chat": "Chat",
    "chat.browser": "Browser",
    "chat.terminal": "Terminal",
    "chat.explorer": "Explorer",
    "chat.expandToolbar": "Expand toolbar",
    "chat.collapseToolbar": "Collapse toolbar",

    // Permission Dialog
    "permission.title": "Permission Required",
    "permission.message": "Claude needs permission to access:",
    "permission.allowOnce": "Allow Once",
    "permission.allowAlways": "Allow Always",
    "permission.deny": "Deny",

    // Tool Messages
    "tool.running": "Running",
    "tool.completed": "Completed",
    "tool.failed": "Failed",
    "tool.output": "Output",
    "tool.input": "Input",

    // Error Messages
    "error.somethingWrong": "Something went wrong",
    "error.tryAgain": "Please try again",
    "error.connectionLost": "Connection lost",
    "error.requestFailed": "Request failed",

    // Message Components
    "message.user": "User",
    "message.claude": "Claude",
    "message.system": "System",
    "message.result": "Result",
    "message.error": "Error",
    "message.message": "Message",
    "message.model": "Model",
    "message.session": "Session",
    "message.tools": "Tools",
    "message.available": "available",
    "message.cwd": "CWD",
    "message.permissionMode": "Permission Mode",
    "message.apiKeySource": "API Key Source",
    "message.duration": "Duration",
    "message.cost": "Cost",
    "message.tokens": "Tokens",
    "message.in": "in",
    "message.out": "out",

    // History & Sessions
    "history.title": "Session History",
    "history.noSessions": "No sessions found",
    "history.createNew": "Create New Session",
    "history.messages": "messages",
    "history.lastActive": "Last active",

    // Browser Panel
    "browser.title": "Embedded Browser",
    "browser.enterUrl": "Enter URL...",
    "browser.go": "Go",
    "browser.back": "Back",
    "browser.forward": "Forward",
    "browser.refresh": "Refresh",
    "browser.navigateTo": "Navigate to a URL to view web content",

    // Terminal Panel
    "terminal.title": "Terminal Output",
    "terminal.noCommands": "No commands executed yet",
    "terminal.runCommand": "Run a command to see output here",

    // Explorer Panel
    "explorer.title": "File Explorer",
    "explorer.currentDirectory": "Current Directory",
    "explorer.searchFiles": "Search files...",
    "explorer.noFiles": "No files found",
    "explorer.emptyDirectory": "Empty directory",
    "explorer.modified": "Modified",
    "explorer.size": "Size",

    // Thinking Mode
    "thinking.expanded": "Expanded",
    "thinking.standard": "Standard",
    "thinking.minimal": "Minimal",
    "thinking.disabled": "Disabled",
    "thinking.description":
      "Control how much detail Claude shares about its reasoning",
  },
  zh: {
    // Navigation
    "nav.back": "返回",
    "nav.settings": "设置",
    "nav.newChat": "新对话",

    // Settings
    "settings.general": "通用",
    "settings.general.desc": "通用设置",
    "settings.general.title": "通用设置",
    "settings.general.subtitle": "配置通用应用程序首选项",
    "settings.mcp": "MCP",
    "settings.mcp.desc": "MCP 服务器配置",
    "settings.bill": "账单",
    "settings.bill.desc": "使用量与计费",
    "settings.language": "语言",
    "settings.language.note":
      "语言更改将立即生效。应用程序的某些部分可能需要刷新才能完全更新。",
    "settings.moreComing": "更多设置即将推出",
    "settings.moreComingDesc": "未来更新中将提供更多通用设置。",

    // Project Selector
    "project.title": "选择项目目录",
    "project.subtitle": "选择一个项目目录以使用 Claude",
    "project.configured": "已配置的项目",
    "project.configuredDesc": "来自您的 Claude 配置的项目",
    "project.custom": "自定义目录",
    "project.customDesc": "输入自定义目录路径",
    "project.enterPath": "输入目录路径...",
    "project.continue": "继续",
    "project.noProjects": "未找到已配置的项目",
    "project.configureHelp": "在 Claude 设置中配置项目",

    // Chat
    "chat.placeholder": "输入消息...",
    "chat.send": "发送",
    "chat.thinking": "Claude 正在思考...",
    "chat.error": "错误",
    "chat.abort": "中止",
    "chat.newSession": "新会话",
    "chat.stop": "停止",
    "chat.retry": "重试",
    "chat.copy": "复制",
    "chat.copied": "已复制！",

    // Common
    "common.loading": "加载中...",
    "common.error": "错误",
    "common.success": "成功",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.save": "保存",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.close": "关闭",
    "common.continue": "继续",
    "common.back": "返回",
    "common.next": "下一步",
    "common.retry": "重试",
    "common.refresh": "刷新",

    // ChatPage
    "chat.title": "Claude Code Web UI",
    "chat.conversationHistory": "对话历史",
    "chat.backToChat": "返回聊天",
    "chat.chat": "聊天",
    "chat.browser": "浏览器",
    "chat.terminal": "终端",
    "chat.explorer": "文件管理器",
    "chat.expandToolbar": "展开工具栏",
    "chat.collapseToolbar": "折叠工具栏",

    // Permission Dialog
    "permission.title": "需要权限",
    "permission.message": "Claude 需要访问权限：",
    "permission.allowOnce": "允许一次",
    "permission.allowAlways": "始终允许",
    "permission.deny": "拒绝",

    // Tool Messages
    "tool.running": "运行中",
    "tool.completed": "已完成",
    "tool.failed": "失败",
    "tool.output": "输出",
    "tool.input": "输入",

    // Error Messages
    "error.somethingWrong": "出了点问题",
    "error.tryAgain": "请重试",
    "error.connectionLost": "连接丢失",
    "error.requestFailed": "请求失败",

    // Message Components
    "message.user": "用户",
    "message.claude": "Claude",
    "message.system": "系统",
    "message.result": "结果",
    "message.error": "错误",
    "message.message": "消息",
    "message.model": "模型",
    "message.session": "会话",
    "message.tools": "工具",
    "message.available": "可用",
    "message.cwd": "当前目录",
    "message.permissionMode": "权限模式",
    "message.apiKeySource": "API 密钥来源",
    "message.duration": "持续时间",
    "message.cost": "费用",
    "message.tokens": "令牌",
    "message.in": "输入",
    "message.out": "输出",

    // History & Sessions
    "history.title": "会话历史",
    "history.noSessions": "没有找到会话",
    "history.createNew": "创建新会话",
    "history.messages": "条消息",
    "history.lastActive": "最后活动",

    // Browser Panel
    "browser.title": "嵌入式浏览器",
    "browser.enterUrl": "输入网址...",
    "browser.go": "前往",
    "browser.back": "后退",
    "browser.forward": "前进",
    "browser.refresh": "刷新",
    "browser.navigateTo": "导航到 URL 以查看网页内容",

    // Terminal Panel
    "terminal.title": "终端输出",
    "terminal.noCommands": "尚未执行任何命令",
    "terminal.runCommand": "运行命令以在此处查看输出",

    // Explorer Panel
    "explorer.title": "文件浏览器",
    "explorer.currentDirectory": "当前目录",
    "explorer.searchFiles": "搜索文件...",
    "explorer.noFiles": "未找到文件",
    "explorer.emptyDirectory": "空目录",
    "explorer.modified": "修改时间",
    "explorer.size": "大小",

    // Thinking Mode
    "thinking.expanded": "详细",
    "thinking.standard": "标准",
    "thinking.minimal": "简洁",
    "thinking.disabled": "关闭",
    "thinking.description": "控制 Claude 分享其推理过程的详细程度",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem("language") as Language;
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "zh")) {
      setLanguageState(savedLanguage);
    }

    // Listen for language changes from other tabs/components
    const handleLanguageChange = (event: CustomEvent<Language>) => {
      setLanguageState(event.detail);
    };

    window.addEventListener(
      "languageChange",
      handleLanguageChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "languageChange",
        handleLanguageChange as EventListener,
      );
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    window.dispatchEvent(new CustomEvent("languageChange", { detail: lang }));
  };

  const t = (key: string): string => {
    // First try direct key lookup (flat structure)
    const currentLang = translations[language] as Record<string, string>;
    if (currentLang[key]) {
      return currentLang[key];
    }

    // Fallback to English if translation not found in current language
    const enLang = translations.en as Record<string, string>;
    if (enLang[key]) {
      return enLang[key];
    }

    // Return key if translation not found in any language
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

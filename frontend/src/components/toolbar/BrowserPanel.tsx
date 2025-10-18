import { useState, useRef, useEffect } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  XCircleIcon,
  CheckIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";

// Helper function to detect localhost patterns
function isLocalhost(url: string): boolean {
  return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0)(:\d+)?/i.test(url);
}

// Helper function to detect LAN IP patterns
function isLanIP(url: string): boolean {
  // Matches: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  return /^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?/.test(
    url,
  );
}

// Helper function to detect file protocol
function isFileProtocol(url: string): boolean {
  return /^file:\/\//i.test(url);
}

// Helper function to determine resource type
function getResourceType(url: string): "localhost" | "lan" | "file" | "web" {
  if (isFileProtocol(url)) return "file";
  const urlWithoutProtocol = url.replace(/^https?:\/\//, "");
  if (isLocalhost(urlWithoutProtocol)) return "localhost";
  if (isLanIP(urlWithoutProtocol)) return "lan";
  return "web";
}

// Helper function to extract file path from file:// URL
function extractFilePath(fileUrl: string): string {
  // Remove file:// protocol and decode URI components
  return decodeURIComponent(fileUrl.replace(/^file:\/\/\/?/, ""));
}

// Helper function to copy text to clipboard
function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch((err) => {
    console.error("Failed to copy to clipboard:", err);
  });
}

// Server option interface
interface ServerOption {
  id: string;
  name: string;
  icon: string;
  command: string;
  difficulty: "easy" | "medium" | "advanced";
  platforms: ("windows" | "mac" | "linux")[];
  speed: "fast" | "fastest" | "normal";
  needsInstall: boolean;
  description: string;
  tip?: string;
}

// Server options configuration
const serverOptions: ServerOption[] = [
  {
    id: "python",
    name: "Python HTTP Server",
    icon: "🐍",
    command: "python -m http.server 8000",
    difficulty: "easy",
    platforms: ["windows", "mac", "linux"],
    speed: "normal",
    needsInstall: false,
    description: "Built-in Python server, works everywhere",
    tip: "Run in the directory containing your HTML files",
  },
  {
    id: "nodejs",
    name: "Node.js HTTP Server",
    icon: "🟢",
    command: "npx http-server -p 8000",
    difficulty: "easy",
    platforms: ["windows", "mac", "linux"],
    speed: "fast",
    needsInstall: false,
    description: "Popular, fast, and reliable",
    tip: "npx downloads and runs without installation",
  },
  {
    id: "bun",
    name: "Bun Dev Server",
    icon: "🥟",
    command: "bunx serve -p 8000",
    difficulty: "easy",
    platforms: ["mac", "linux"],
    speed: "fastest",
    needsInstall: true,
    description: "Modern, blazing fast runtime",
    tip: "Install: curl -fsSL https://bun.sh/install | bash",
  },
  {
    id: "vite",
    name: "Vite Preview Server",
    icon: "⚡",
    command: "npx vite preview --port 8000",
    difficulty: "medium",
    platforms: ["windows", "mac", "linux"],
    speed: "fastest",
    needsInstall: false,
    description: "For Vite-built projects",
    tip: "First build with: npm run build",
  },
  {
    id: "deno",
    name: "Deno File Server",
    icon: "🦕",
    command:
      "deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts",
    difficulty: "medium",
    platforms: ["windows", "mac", "linux"],
    speed: "fast",
    needsInstall: true,
    description: "Secure, modern runtime",
    tip: "Install: curl -fsSL https://deno.land/install.sh | sh",
  },
  {
    id: "caddy",
    name: "Caddy Server",
    icon: "🔒",
    command: "caddy file-server --listen :8000",
    difficulty: "advanced",
    platforms: ["windows", "mac", "linux"],
    speed: "fast",
    needsInstall: true,
    description: "Auto HTTPS, production-ready",
    tip: "Install: brew install caddy (Mac) or download from caddyserver.com",
  },
  {
    id: "php",
    name: "PHP Built-in Server",
    icon: "🐘",
    command: "php -S localhost:8000",
    difficulty: "easy",
    platforms: ["windows", "mac", "linux"],
    speed: "normal",
    needsInstall: false,
    description: "For PHP projects",
    tip: "PHP must be installed on your system",
  },
];

export function BrowserPanel() {
  const [url, setUrl] = useState("https://react.dev");
  const [inputUrl, setInputUrl] = useState("https://react.dev");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(["https://react.dev"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [fileUrlError, setFileUrlError] = useState<{
    show: boolean;
    path: string;
  } | null>(null);
  const [selectedTab, setSelectedTab] = useState<"quick" | "all" | "advanced">(
    "quick",
  );
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-reset copied state after 2 seconds
  useEffect(() => {
    if (copiedCommand) {
      const timer = setTimeout(() => setCopiedCommand(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedCommand]);

  // Enhanced copy handler with visual feedback
  const handleCopy = (command: string) => {
    copyToClipboard(command);
    setCopiedCommand(command);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let newUrl = inputUrl.trim();

    // Block file:// protocol - browsers don't allow it in iframes
    if (isFileProtocol(newUrl)) {
      const filePath = extractFilePath(newUrl);
      setFileUrlError({
        show: true,
        path: filePath,
      });
      setIsLoading(false);
      return; // Don't proceed with loading
    }

    // Clear any previous file URL errors
    setFileUrlError(null);

    // Add protocol if missing
    if (newUrl && !newUrl.match(/^https?:\/\//)) {
      // Check if it looks like a search query
      if (newUrl.includes(" ") || !newUrl.includes(".")) {
        newUrl = `https://www.google.com/search?q=${encodeURIComponent(newUrl)}`;
      }
      // Check if it's localhost or LAN IP - use http://
      else if (isLocalhost(newUrl) || isLanIP(newUrl)) {
        newUrl = `http://${newUrl}`;
      }
      // Otherwise use https:// for public URLs
      else {
        newUrl = `https://${newUrl}`;
      }
    }

    if (newUrl) {
      setUrl(newUrl);
      setInputUrl(newUrl);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newUrl);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      setIsLoading(true);
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const newUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setUrl(newUrl);
      setInputUrl(newUrl);
      setIsLoading(true);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const newUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setUrl(newUrl);
      setInputUrl(newUrl);
      setIsLoading(true);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Force refresh iframe by temporarily storing and reassigning src
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;
    }
  };

  const handleHome = () => {
    const homeUrl = "https://react.dev";
    setUrl(homeUrl);
    setInputUrl(homeUrl);
    setIsLoading(true);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Navigation Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleBack}
          disabled={historyIndex <= 0}
          className="p-2 glass-button glow-border smooth-transition rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="w-4 h-4 text-accent" />
        </button>

        <button
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
          className="p-2 glass-button glow-border smooth-transition rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Go forward"
        >
          <ArrowRightIcon className="w-4 h-4 text-accent" />
        </button>

        <button
          onClick={handleRefresh}
          className="p-2 glass-button glow-border smooth-transition rounded-lg"
          aria-label="Refresh"
        >
          <ArrowPathIcon
            className={`w-4 h-4 text-accent ${isLoading ? "animate-spin" : ""}`}
          />
        </button>

        <button
          onClick={handleHome}
          className="p-2 glass-button glow-border smooth-transition rounded-lg"
          aria-label="Home"
        >
          <HomeIcon className="w-4 h-4 text-accent" />
        </button>
      </div>

      {/* Address Bar */}
      <form
        onSubmit={handleUrlSubmit}
        className="flex items-center gap-2 flex-shrink-0"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter URL or search query..."
            className="w-full px-4 py-2 pl-10 glass-input text-primary placeholder-text-tertiary rounded-lg"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-tertiary" />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-primary text-primary rounded-lg font-medium smooth-transition glow-effect"
        >
          Go
        </button>
      </form>

      {/* Resource Type Info Badge */}
      {url && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {getResourceType(url) === "localhost" && (
            <div className="flex items-center gap-2 px-3 py-1 glass-card rounded-lg text-xs">
              <InformationCircleIcon className="w-4 h-4 text-blue-500" />
              <span className="text-primary">Loading localhost resource</span>
            </div>
          )}
          {getResourceType(url) === "lan" && (
            <div className="flex items-center gap-2 px-3 py-1 glass-card rounded-lg text-xs">
              <InformationCircleIcon className="w-4 h-4 text-green-500" />
              <span className="text-primary">
                Loading LAN resource ({url.match(/\d+\.\d+\.\d+\.\d+/)?.[0]})
              </span>
            </div>
          )}
        </div>
      )}

      {/* File URL Error Panel - Enhanced with Multiple Options */}
      {fileUrlError?.show && (
        <div className="glass-card rounded-lg border-2 border-red-500/50 p-4 flex flex-col gap-3 flex-shrink-0 max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-primary font-semibold text-sm">
                Cannot Load Local File
              </h3>
              <p className="text-tertiary text-xs mt-1">
                Browsers block file:// URLs in iframes for security. Choose a
                local server below.
              </p>
            </div>
            <button
              onClick={() => setFileUrlError(null)}
              className="text-tertiary hover:text-primary transition-colors flex-shrink-0"
              aria-label="Close error"
            >
              ✕
            </button>
          </div>

          {/* File Path Display */}
          <div className="glass-input px-3 py-2 text-xs font-mono truncate text-tertiary">
            {fileUrlError.path}
          </div>

          {/* Tab Selector */}
          <div className="flex gap-1 border-b border-tertiary/20">
            {[
              { key: "quick", label: "⚡ Quick Start" },
              { key: "all", label: "📋 All Options" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() =>
                  setSelectedTab(tab.key as "quick" | "all" | "advanced")
                }
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  selectedTab === tab.key
                    ? "border-b-2 border-accent text-accent"
                    : "text-tertiary hover:text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-2">
            {selectedTab === "quick" && (
              <>
                <p className="text-xs text-secondary font-medium mb-3">
                  💡 Recommended for you:
                </p>
                {/* Show top 2 easiest options */}
                {serverOptions.slice(0, 2).map((option) => (
                  <div
                    key={option.id}
                    className="glass-card p-3 space-y-2 border border-accent/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className="text-xs text-primary font-medium">
                          {option.name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                          option.difficulty === "easy"
                            ? "bg-green-500/20 text-green-500 border-green-500/30"
                            : option.difficulty === "medium"
                              ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                              : "bg-red-500/20 text-red-500 border-red-500/30"
                        }`}
                      >
                        {option.difficulty.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-tertiary">
                      {option.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-tertiary bg-black-primary/30 px-2 py-1 rounded font-mono overflow-x-auto">
                        {option.command}
                      </code>
                      <button
                        onClick={() => handleCopy(option.command)}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-all flex-shrink-0 ${
                          copiedCommand === option.command
                            ? "bg-green-500 text-white"
                            : "glass-button text-accent hover:text-accent/80"
                        }`}
                      >
                        {copiedCommand === option.command ? (
                          <>
                            <CheckIcon className="w-3 h-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardIcon className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    {option.tip && (
                      <p className="text-xs text-tertiary flex items-start gap-1">
                        <span>💡</span>
                        <span>{option.tip}</span>
                      </p>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setSelectedTab("all")}
                  className="w-full text-xs text-accent hover:text-accent/80 py-2 glass-button rounded transition-colors"
                >
                  View All 7 Server Options →
                </button>
              </>
            )}

            {selectedTab === "all" && (
              <>
                <p className="text-xs text-secondary font-medium mb-3">
                  Choose any server option:
                </p>
                {serverOptions.map((option) => (
                  <div key={option.id} className="glass-card p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className="text-xs text-primary font-medium">
                          {option.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                            option.difficulty === "easy"
                              ? "bg-green-500/20 text-green-500 border-green-500/30"
                              : option.difficulty === "medium"
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                : "bg-red-500/20 text-red-500 border-red-500/30"
                          }`}
                        >
                          {option.difficulty.toUpperCase()}
                        </span>
                        {option.speed === "fastest" && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded border bg-purple-500/20 text-purple-500 border-purple-500/30">
                            FASTEST
                          </span>
                        )}
                        {!option.needsInstall && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded border bg-blue-500/20 text-blue-500 border-blue-500/30">
                            NO INSTALL
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-tertiary">
                      {option.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-tertiary bg-black-primary/30 px-2 py-1 rounded font-mono overflow-x-auto">
                        {option.command}
                      </code>
                      <button
                        onClick={() => handleCopy(option.command)}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-all flex-shrink-0 ${
                          copiedCommand === option.command
                            ? "bg-green-500 text-white"
                            : "glass-button text-accent hover:text-accent/80"
                        }`}
                      >
                        {copiedCommand === option.command ? (
                          <>
                            <CheckIcon className="w-3 h-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardIcon className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    {option.tip && (
                      <p className="text-xs text-tertiary flex items-start gap-1">
                        <span>💡</span>
                        <span>{option.tip}</span>
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Usage Instructions */}
            <div className="glass-card p-3 space-y-1 bg-accent/5 border border-accent/20">
              <p className="text-xs text-primary font-medium">📖 How to use:</p>
              <ol className="text-xs text-tertiary space-y-1 ml-4 list-decimal">
                <li>Copy a command above</li>
                <li>Open terminal in your file's directory</li>
                <li>Paste and run the command</li>
                <li>
                  Navigate to{" "}
                  <code className="text-accent bg-black-primary/30 px-1 rounded">
                    http://localhost:8000
                  </code>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Browser Frame */}
      <div className="flex-1 relative min-h-0">
        <div className="h-full glass-card rounded-lg overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-black-primary/50 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 text-primary">
                <ArrowPathIcon className="w-5 h-5 animate-spin text-accent" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-none"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads"
            title="Browser content"
          />
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-2 left-2 right-2 text-xs text-tertiary flex items-center justify-between bg-black-primary/80 backdrop-blur-sm rounded px-2 py-1">
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            <span className="truncate">Loaded: {url}</span>
            {/* Resource type badge */}
            {getResourceType(url) !== "web" && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-accent/20 text-accent">
                {getResourceType(url).toUpperCase()}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 flex-shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500" : "bg-green-500"}`}
            />
            {isLoading ? "Loading" : "Ready"}
          </span>
        </div>
      </div>
    </div>
  );
}

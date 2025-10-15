import { useState, useRef } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  XCircleIcon,
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

      {/* File URL Error Panel */}
      {fileUrlError?.show && (
        <div className="glass-card rounded-lg border-2 border-red-500/50 p-4 flex flex-col gap-3 flex-shrink-0">
          {/* Header */}
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-primary font-semibold text-sm">
                Cannot Load Local File
              </h3>
              <p className="text-tertiary text-xs mt-1">
                Browsers block file:// URLs in iframes for security. Use a local
                server instead.
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

          {/* Solutions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-secondary">Solutions:</p>

            {/* Option 1: Python */}
            <div className="glass-card p-3 space-y-2">
              <p className="text-xs text-primary font-medium">
                1. Start Python HTTP Server
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-tertiary bg-black-primary/30 px-2 py-1 rounded font-mono">
                  python -m http.server 8000
                </code>
                <button
                  onClick={() => copyToClipboard("python -m http.server 8000")}
                  className="text-xs text-accent hover:text-accent/80 transition-colors px-2 py-1 glass-button rounded"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Option 2: Node.js */}
            <div className="glass-card p-3 space-y-2">
              <p className="text-xs text-primary font-medium">
                2. Start Node.js HTTP Server
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-tertiary bg-black-primary/30 px-2 py-1 rounded font-mono">
                  npx http-server -p 8000
                </code>
                <button
                  onClick={() => copyToClipboard("npx http-server -p 8000")}
                  className="text-xs text-accent hover:text-accent/80 transition-colors px-2 py-1 glass-button rounded"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Option 3: Usage */}
            <div className="glass-card p-3 space-y-1">
              <p className="text-xs text-primary font-medium">
                3. Then navigate to:
              </p>
              <code className="text-xs text-accent block bg-black-primary/30 px-2 py-1 rounded font-mono">
                http://localhost:8000
              </code>
              <p className="text-xs text-tertiary mt-1">
                Run the command in the directory containing your HTML file
              </p>
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

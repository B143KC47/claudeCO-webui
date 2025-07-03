import { useState, useRef } from "react";
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  ArrowPathIcon,
  HomeIcon,
  MagnifyingGlassIcon 
} from "@heroicons/react/24/outline";

export function BrowserPanel() {
  const [url, setUrl] = useState("https://react.dev");
  const [inputUrl, setInputUrl] = useState("https://react.dev");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(["https://react.dev"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let newUrl = inputUrl.trim();
    
    // Add protocol if missing
    if (newUrl && !newUrl.match(/^https?:\/\//)) {
      // Check if it looks like a search query
      if (newUrl.includes(" ") || !newUrl.includes(".")) {
        newUrl = `https://www.google.com/search?q=${encodeURIComponent(newUrl)}`;
      } else {
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
    // Force refresh iframe
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
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
          <ArrowPathIcon className={`w-4 h-4 text-accent ${isLoading ? "animate-spin" : ""}`} />
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
      <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 flex-shrink-0">
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
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            title="Browser content"
          />
        </div>
        
        {/* Status Bar */}
        <div className="absolute bottom-2 left-2 right-2 text-xs text-tertiary flex items-center justify-between bg-black-primary/80 backdrop-blur-sm rounded px-2 py-1">
          <span className="truncate flex-1 mr-2">Loaded: {url}</span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-yellow-500" : "bg-green-500"}`} />
            {isLoading ? "Loading" : "Ready"}
          </span>
        </div>
      </div>
    </div>
  );
} 
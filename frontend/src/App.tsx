import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { DemoPage } from "./components/DemoPage";
import { Settings } from "./components/Settings";
import { MobileAuth } from "./components/MobileAuth";
import { DeviceAuthDialog } from "./components/DeviceAuthDialog";
import { LanguageProvider } from "./contexts/LanguageContext";
import { API_BASE_URL } from "./config/api";

function App() {
  const [showDeviceAuth, setShowDeviceAuth] = useState(false);
  const [hasPendingDevices, setHasPendingDevices] = useState(false);

  // Check for pending devices periodically
  useEffect(() => {
    const checkPendingDevices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/devices`);
        if (response.ok) {
          const data = await response.json();
          const pending = data.devices.some((d: any) => d.status === "pending");
          setHasPendingDevices(pending);
          
          // Auto-show dialog if there are pending devices
          if (pending && !showDeviceAuth) {
            setShowDeviceAuth(true);
          }
        }
      } catch (error) {
        console.error("Error checking pending devices:", error);
      }
    };

    // Check immediately and then every 5 seconds
    checkPendingDevices();
    const interval = setInterval(checkPendingDevices, 5000);
    
    return () => clearInterval(interval);
  }, [showDeviceAuth]);

  return (
    <LanguageProvider>
      <div className="fullscreen-container mobile-optimized">
        <Router>
          <Routes>
            <Route path="/" element={<ProjectSelector />} />
            <Route path="/projects/*" element={<ChatPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/mobile-auth" element={<MobileAuth />} />
          </Routes>
        </Router>
        
        {/* Device authorization dialog */}
        <DeviceAuthDialog 
          isOpen={showDeviceAuth} 
          onClose={() => setShowDeviceAuth(false)} 
        />

        {/* Notification indicator for pending devices */}
        {hasPendingDevices && !showDeviceAuth && (
          <button
            onClick={() => setShowDeviceAuth(true)}
            className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            Device Authorization Request
          </button>
        )}
      </div>
    </LanguageProvider>
  );
}

export default App;

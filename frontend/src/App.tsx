import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { DemoPage } from "./components/DemoPage";
import { Settings } from "./components/Settings";
import { MobileAuth } from "./components/MobileAuth";
import { DeviceAuthDialog } from "./components/DeviceAuthDialog";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ToastProvider } from "./contexts/ToastContext";

function App() {
  const [showDeviceAuth, setShowDeviceAuth] = useState(false);

  return (
    <LanguageProvider>
      <ToastProvider>
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
        </div>
      </ToastProvider>
    </LanguageProvider>
  );
}

export default App;

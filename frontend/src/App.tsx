import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { DemoPage } from "./components/DemoPage";
import { Settings } from "./components/Settings";
import { LanguageProvider } from "./contexts/LanguageContext";

function App() {
  return (
    <LanguageProvider>
      <div className="fullscreen-container mobile-optimized">
        <Router>
          <Routes>
            <Route path="/" element={<ProjectSelector />} />
            <Route path="/projects/*" element={<ChatPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Router>
      </div>
    </LanguageProvider>
  );
}

export default App;

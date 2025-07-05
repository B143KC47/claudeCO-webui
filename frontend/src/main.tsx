import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Global error handlers
window.addEventListener("unhandledrejection", (event) => {
  // Suppress Chrome extension errors
  if (event.reason?.message?.includes("message port closed")) {
    console.warn("Chrome extension communication error (suppressed)");
    event.preventDefault();
    return;
  }

  // Log other unhandled promise rejections
  console.error("Unhandled promise rejection:", event.reason);
});

window.addEventListener("error", (event) => {
  // Suppress Chrome extension errors
  if (event.message?.includes("message port closed")) {
    console.warn("Chrome extension communication error (suppressed)");
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

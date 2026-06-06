import React from "react";
import ReactDOM from "react-dom/client";
import TrayMenu from "./TrayMenu";
import "./App.css";

const THEME_STORAGE_KEY = "codex-switcher-theme";

try {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  document.documentElement.classList.toggle("dark", saved === "dark");
} catch {
  // Ignore storage errors; tray still renders in light mode.
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TrayMenu />
  </React.StrictMode>
);

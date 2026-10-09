import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { applyTheme, readTheme } from "./components/shared/ThemeToggle";
import "./styles/index.css";

applyTheme(readTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

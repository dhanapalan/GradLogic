import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { bootstrapSession } from "./lib/api";
import "./index.css";

// Access tokens live in memory only (never web storage), so a page reload
// must first exchange the httpOnly refresh cookie for a new token — before
// the router/guards render and would bounce the user to /auth/login.
bootstrapSession().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
});

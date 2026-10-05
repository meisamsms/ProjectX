import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Shell } from "./shell";
import { StaffAuthBoundary } from "./staff-auth/boundary";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw new Error("Application root missing");
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      {import.meta.env.VITE_STAFF_AUTH_ENABLED === "1" ? (
        <StaffAuthBoundary>
          <Shell staffConnected />
        </StaffAuthBoundary>
      ) : (
        <Shell />
      )}
    </BrowserRouter>
  </React.StrictMode>,
);

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Shell } from "./shell";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw new Error("Application root missing");
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </React.StrictMode>,
);

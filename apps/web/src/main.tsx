import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { ReservationWidgetPage } from "./reservations/widget-page";
import { Shell } from "./shell";
import { StaffAuthBoundary } from "./staff-auth/boundary";
import "./style.css";

function PublicBooking() {
  const { venueSlug = "" } = useParams();
  return <ReservationWidgetPage key={venueSlug} venueSlug={venueSlug} />;
}
const root = document.getElementById("root");
if (!root) throw new Error("Application root missing");
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/book/:venueSlug" element={<PublicBooking />} />
        <Route
          path="*"
          element={
            import.meta.env.VITE_STAFF_AUTH_ENABLED === "1" ? (
              <StaffAuthBoundary>
                <Shell staffConnected />
              </StaffAuthBoundary>
            ) : (
              <Shell />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

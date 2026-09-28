# Conceptual data-flow map

Product-level relationships from visible UI. Arrows are information dependencies, not claims about storage, APIs, service boundaries, or exact booking algorithms. Unverified writes are labeled.

```mermaid
flowchart TB
  VENUE["Venue context"] --> SHIFT["Shift settings"]
  ROOM["Rooms / tables / seating areas"] --> SHIFT
  LAYOUT["Floorplan layout"] --> SHIFT
  RULE["Access rules / policies"] --> AVAIL["Availability matrix"]
  SHIFT --> AVAIL
  AREA["Seating area selection"] --> AVAIL
  AVAIL --> FORM["Reservation form"]
  CLIENT["Client profile"] --> FORM
  FORM --> RES["Reservation; write unverified"]
  RES --> DETAIL["Reservation detail / table / status"]
  RES --> HOME["Home summaries"]
  RES --> REPORT["Reporting; detail deferred"]
  REQ["Request; conversion UNKNOWN"] -.-> RES
  RES --> COMMS["Guest communications; delivery unverified"]
```

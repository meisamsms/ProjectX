# Cross-module dependency map

Arrows mean proposed **must precede** implementation prerequisites. They do not describe the reference application's backend. Optional integration edges and reasons are in `../dependencies.json`.

```mermaid
flowchart TB
  FOUND_001["Resolve architecture and document gaps"]
  FOUND_002["Identity, access and venue context"]
  FOUND_003["Data contracts and persistence foundations"]
  FOUND_004["Navigation shell and verification harness"]
  MOD_01["Home"]
  MOD_02["Reservations"]
  MOD_03["Requests"]
  MOD_04["Clients"]
  MOD_05["Marketing"]
  MOD_06["Voice AI"]
  MOD_07["Online Sales"]
  MOD_08["Reporting"]
  MOD_09["General Settings"]
  MOD_10["Integrations"]
  MOD_11["Availability"]
  MOD_12["Widgets"]
  MOD_13["Floorplan"]
  MOD_14["People"]
  MOD_15["Guest-Facing Language"]
  MOD_16["Imports"]
  FOUND_001 --> FOUND_002
  FOUND_001 --> FOUND_003
  FOUND_002 --> FOUND_003
  FOUND_002 --> FOUND_004
  FOUND_003 --> FOUND_004
  FOUND_004 --> MOD_01
  MOD_02 --> MOD_01
  MOD_03 --> MOD_01
  FOUND_004 --> MOD_02
  MOD_04 --> MOD_02
  MOD_11 --> MOD_02
  MOD_13 --> MOD_02
  MOD_14 --> MOD_02
  FOUND_004 --> MOD_03
  MOD_04 --> MOD_03
  MOD_11 --> MOD_03
  MOD_14 --> MOD_03
  FOUND_004 --> MOD_04
  MOD_09 --> MOD_04
  MOD_14 --> MOD_04
  FOUND_004 --> MOD_05
  MOD_04 --> MOD_05
  MOD_02 --> MOD_05
  MOD_15 --> MOD_05
  FOUND_004 --> MOD_06
  MOD_02 --> MOD_06
  MOD_11 --> MOD_06
  FOUND_004 --> MOD_07
  MOD_02 --> MOD_07
  MOD_04 --> MOD_07
  FOUND_004 --> MOD_08
  MOD_02 --> MOD_08
  MOD_03 --> MOD_08
  MOD_04 --> MOD_08
  FOUND_004 --> MOD_09
  MOD_14 --> MOD_09
  FOUND_004 --> MOD_10
  MOD_09 --> MOD_10
  MOD_14 --> MOD_10
  FOUND_004 --> MOD_11
  MOD_09 --> MOD_11
  MOD_13 --> MOD_11
  FOUND_004 --> MOD_12
  MOD_11 --> MOD_12
  MOD_02 --> MOD_12
  MOD_15 --> MOD_12
  FOUND_004 --> MOD_13
  MOD_09 --> MOD_13
  MOD_14 --> MOD_13
  FOUND_004 --> MOD_14
  FOUND_004 --> MOD_15
  MOD_09 --> MOD_15
  FOUND_004 --> MOD_16
  MOD_04 --> MOD_16
  MOD_02 --> MOD_16
```

# 3D Map Migration Plan (Full Parity)

## Goal
Migrate the current frontline map experience from Leaflet-based 2D tactical map to a 3D-capable map stack, preserving all existing behaviors before introducing new 3D-only capabilities.

## Current Surface To Migrate
Primary live surface is `frontend/src/components/FrontlineMap.jsx` and related backend realtime APIs/events.

### Frontend features currently present
- Globe + tactical map mode switch logic.
- Realtime subscriptions via Socket.IO.
- Frontline zones rendering.
- Zone pulse effect for accepted zones.
- Logistics routes rendering with pending/accepted styles.
- Convoy routes + moving convoy marker animation.
- DCSAR link-to-nearest-airbase + pulse marker + status styles.
- Airport markers with custom visibility (glow + core).
- Overlay controls and filters.
- Zone details modal.
- Logistics mission details modal with ISO payload details.
- DCSAR details modal.
- Focus behavior, zoom behavior, selection/hover behavior.

### Backend contracts currently consumed by map
- `GET /api/frontline-zones`
- `POST /api/frontline-zones/:id/accept`
- `GET /api/combat-missions`
- `GET /api/missions`
- `GET /api/convoys`
- `GET /api/dcsar`
- `GET /api/feed`
- Socket events:
  - `frontline:updated`
  - `combat-missions:updated`
  - `missions:updated`
  - `convoys:updated`
  - `dcsar:updated`
  - `feed:updated`

## Target Stack
- `maplibre-gl` for camera pitch/bearing/rotation and vector-style rendering.
- React wrapper via direct imperative integration or `react-map-gl/maplibre`.
- Optional 3D object layer via custom WebGL layer (phase 2+), fed by JSON points.

## Migration Strategy
Do not big-bang replace the current map.
Use parallel-run mode with a feature flag and parity checklist.

## Execution Plan

### Phase 0 - Baseline freeze and instrumentation
- Add feature flag: `VITE_MAP_ENGINE=leaflet|maplibre`.
- Capture baseline screenshots/short recordings for all key interactions.
- Add lightweight perf logs (FPS-ish, draw count, update frequency).
- Freeze map-related behavior changes until parity is achieved.

Exit criteria:
- Baseline artifacts stored.
- Feature flag active with Leaflet default.

### Phase 1 - Engine bootstrap (MapLibre shell)
- Add MapLibre dependencies and base map container component.
- Implement map init, style loading, camera defaults.
- Recreate focus API:
  - set center
  - set zoom
  - animate to target
- Recreate interactions:
  - click selection
  - hover highlight hooks
  - zoom watcher callback

Exit criteria:
- MapLibre map mounts reliably.
- No regressions in app boot/runtime.

### Phase 2 - Data adapter layer (critical for parity)
- Create a normalization layer that converts current domain data into render-ready collections:
  - zones
  - logistics routes
  - convoys (route + moving point)
  - dcsar (point + pulse + nearest link)
  - airports
- Keep same identifiers currently used by modals and panels.
- Keep same filtering semantics as current `FrontlineMap`.

Exit criteria:
- Adapter outputs match current UI counts and IDs.

### Phase 3 - Render parity by layer
- Zones:
  - color by status
  - selection radius/outline
  - accepted operation pulse effect.
- Grid connections:
  - thin dashed links.
- Logistics routes:
  - style by mission status.
- Convoys:
  - route polyline
  - moving icon behavior.
- DCSAR:
  - nearest-airbase link
  - pulse ring
  - accepted/pending style.
- Airports:
  - core + glow visibility style.

Exit criteria:
- Visual parity checklist passed against baseline.

### Phase 4 - UI interactions and modals parity
- Rewire map picks to existing UI state:
  - selected zone
  - selected logistics mission
  - selected DCSAR task
  - selected airport.
- Ensure `View Details` flows still work.
- Ensure `Accept` actions (missions, DCSAR, zone op) still work and update in realtime.

Exit criteria:
- Full action matrix verified end-to-end.

### Phase 5 - Realtime behavior hardening
- Validate Socket.IO updates do not leak listeners on remount.
- Throttle/reconcile high-frequency updates (convoys, DCSAR).
- Ensure pulse/timer visuals stay synced after reconnect.

Exit criteria:
- 30+ minute soak test with no state drift or memory leak symptoms.

### Phase 6 - 3D controls and camera UX
- Add pitch/bearing controls.
- Add middle-mouse (wheel click drag) orbit behavior.
- Define sane constraints:
  - min/max pitch
  - min/max zoom
  - bounds clamp.

Exit criteria:
- 3D camera UX stable on desktop.

### Phase 7 - 3D object injection (new capability)
- Define object source schema (JSON):
  - `id`, `lat`, `lon`, `alt`, `heading`, `model`, `scale`.
- Render first batch of static 3D objects on specified points.
- Add update path for dynamic objects if needed.

Exit criteria:
- At least one static object set rendered correctly and selectable.

### Phase 8 - Cutover and cleanup
- Flip default flag to MapLibre.
- Keep Leaflet fallback for one release window.
- Remove dead Leaflet map code after stabilization.

Exit criteria:
- Production default on MapLibre.
- No P1/P2 regressions for one release cycle.

## Full Parity Checklist (Do Not Skip)
- Zone colors and statuses.
- Zone accepted pulse.
- Zone hover/selection.
- Zone details modal.
- Zone accept rules and timer UI.
- Logistics routes styles.
- Logistics mission modal and action buttons.
- Convoy line and moving marker.
- DCSAR line, marker, pulse, and accept/complete.
- Airport marker visibility style.
- Overlay filter toggles and filtering semantics.
- Feed panel behavior.
- Socket reconnect behavior.
- Focus behavior when selecting items.
- Zoom-dependent behaviors.

## QA Matrix
- Functional:
  - Every current map action works.
  - Every API mutation updates map and panels.
- Visual:
  - Color/style parity.
  - Pulse effects parity.
- Realtime:
  - Websocket updates during user interaction.
  - Reconnect after backend restart.
- Performance:
  - CPU/GPU usage at idle and during updates.
  - Frame stability with full overlays enabled.

## Risks
- Rewriting draw logic and interaction picking simultaneously can create regressions.
- Convoy animation and pulse layering may be expensive if not optimized.
- Different projection/rendering model can alter perceived positions/styles.

Mitigation:
- Layer-by-layer parity, not feature-by-feature random rewrites.
- Keep fallback flag.
- Add screenshot diff checks for critical scenes.

## Rollback Plan
- Feature flag fallback to Leaflet at runtime/build-time.
- Keep old map component intact until MapLibre passes soak + release validation.

## Suggested Delivery Cadence
- Sprint 1: Phase 0-2
- Sprint 2: Phase 3-4
- Sprint 3: Phase 5-6
- Sprint 4: Phase 7-8


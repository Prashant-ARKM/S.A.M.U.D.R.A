# S.A.M.U.D.R.A. — Frontend Redesign Brief

## IMPORTANT: READ THIS FIRST

This is a **frontend visual redesign of the existing S.A.M.U.D.R.A. project**.

The existing application's functionality, pipeline, components, data flow, calculations, mock data, backend/API behavior, and interactions are the source of truth.

### DO NOT rebuild the application architecture.

### DO NOT replace the existing workflow.

### DO NOT delete existing components.

### DO NOT invent new modules or workflows.

### DO NOT change how the system works just to make the redesign easier.

The goal is:

> **Make the existing S.A.M.U.D.R.A. prototype look and feel like a polished, credible, light-themed government/maritime intelligence system while preserving its existing functionality.**

---

# 0. ACTUAL PROJECT FILE MAP (READ BEFORE EDITING ANYTHING)

This section lists the REAL current files and what each one actually renders
today. It exists because a generic description of "a maritime dashboard" is
not enough to redesign this specific codebase without guessing. If anything
below conflicts with what you find in the repository, trust the repository —
this is a snapshot, not a spec, and the app evolves.

## Shell

- `src/App.jsx` — header, pipeline stepper, empty state (map + "Trigger
  Incident" / "Report a Spill"), main layout, Investigation Log sidebar,
  modal mounting. Owns `activeStage`, `stageStatuses`, `incident` state.
- `src/index.css` — global CSS variables and base styles (Tailwind).

## Shared UI

- `src/components/SectionCard.jsx` — the numbered card wrapper every
  pipeline section uses (number badge, title, status pill). Redesigning
  this one file changes the frame around all seven sections at once.
- `src/components/StatusBadge.jsx` — small colored status pill.

## Pipeline sections

All seven take `data` (the full incident object) and `status` (`'Pending'
| 'Processing' | 'Complete'`) as props from `App.jsx`.

- `Section1_IncidentTrigger.jsx` — satellite metadata, coordinates, a
  "📍 Reported Zone" badge + user's note when the incident came from Report
  a Spill instead of Trigger Incident.
- `Section2_DataIngestion.jsx` — **five** sources, not three: SAR, AIS,
  Ocean/Current, Wind, Meteorological.
- `Section3_SlickAnalysis.jsx` — **three** side-by-side panels, not two:
  - **Panel A** — raw SAR scene (grayscale speckle raster, canvas-rendered)
  - **Panel B** — same scene with the detected slick overlay + optional
    look-alike outline (toggle: "Show Rejected Look-Alike")
  - **Panel C** — Electro-Optical (EO) validation. A real optical pass is
    only sometimes available (cloud cover / daylight conditions); when
    unavailable it shows an explicit "EO Unavailable" state with the
    reason (e.g. "Night pass — sun elevation 4°"), not a broken image.
  Plus: Classification Confidence bars (Oil / Look-Alike / Clean /
  Unknown), Slick Properties (length/width/area/orientation/perimeter), a
  **Spill Age Estimate** card (Bonn Appearance Code, estimated volume,
  weathering stage, cross-checked against Step 4's hindcast), and a
  Nearest AIS Suspects list.
- `Section4_BackwardReconstruction.jsx` — origin point, release time
  window, uncertainty radius, particle ensemble.
- `Section5_ForwardDriftTrace.jsx` — forecast path/corridor, ensemble
  trajectories.
- `Section6_VesselIdentification.jsx` — ranked AIS candidates in a table.
  Each row has a **Behaviour Timeline** bar (a 72h strip, not a plain
  number): red segment = AIS dark period, amber segment = loitering,
  purple diamond = a sudden speed drop near closest approach. Hovering
  each shows exact hours/knots.
- `Section7_EvidenceFusion.jsx` — handles **two** outcomes, not one:
  - **Attributed** — a "🎯 Most Probable Candidate" card with a circular
    score ring and four sub-score rings (Spatial / Temporal / Heading /
    Behavioural).
  - **Unknown** — a "❓ Source Unknown" card, roughly 28% of runs, when no
    candidate clears the attribution confidence threshold. Still shows the
    closest partial lead, explicitly labeled "not attributed."
  Also shows a **Counterfactual Simulation** badge per candidate
  (🔄 Consistent / Partial / Inconsistent — whether forward-drifting that
  vessel's own reported position would actually reach the observed slick),
  and a Ranked Suspects card grid with icon flags (📡 AIS gap, ⚡ speed
  anomaly, ⚓ loitering) instead of a text-only list.

## Entry points beyond "Trigger Incident"

- `ReportSpillModal.jsx` — a second way to start an investigation: pick a
  location by map click, a searchable list of known Indian ports, or
  manual lat/lon entry, plus a free-text note. Submits to an
  "🔍 Investigate" action.
- `CleanScanResult.jsx` — shown **instead of** the seven-stage pipeline
  when a reported zone comes back with no anomaly (~32% of Report-a-Spill
  investigations). This is a genuine, honest possible outcome — not an
  error state — and needs its own visual treatment, not a repurposed
  error/empty component.

## Data/logic layer — visual redesign only, do not touch

`src/data/generateIncident.js`, `generateIngestion.js`, `generateSarScene.js`,
`generateSarRaster.js`, `generateEoRaster.js`, `generateEoValidation.js`,
`generateHindcast.js`, `generateForecast.js`, `generateVesselAttribution.js`,
`generateEvidenceFusion.js`, `generateCounterfactual.js`,
`generateSpillAge.js`, `generateReportedScan.js`, `sceneGeometry.js`,
`rng.js`. These compute every number and label the components above
display — redesign how the numbers are presented, never what they are.

---

# 1. PROJECT CONTEXT

S.A.M.U.D.R.A. is a maritime pollution intelligence and investigation prototype.

The existing project already contains its own workflow and components.

The existing seven-stage pipeline is:

```text
01. INCIDENT TRIGGER
          ↓
02. DATA INGESTION
          ↓
03. SLICK ANALYSIS
          ↓
04. BACKWARD RECONSTRUCTION
          ↓
05. FORWARD DRIFT TRACE
          ↓
06. VESSEL IDENTIFICATION
          ↓
07. EVIDENCE FUSION
```

This pipeline must remain intact.

The redesign should improve how this pipeline is presented, not replace it.

---

# 2. EXISTING FUNCTIONALITY IS THE SOURCE OF TRUTH

Before modifying any file:

1. Inspect the existing implementation.
2. Understand what the existing component does.
3. Preserve its props and behavior unless a purely visual change is required.
4. Preserve existing data structures.
5. Preserve existing mock/simulation logic.
6. Preserve existing API/backend integration.
7. Preserve existing user interactions.
8. Preserve existing navigation/workflow.
9. Preserve existing calculations.
10. Preserve existing output.

If a visual redesign appears to require a functional change, **do not make that functional change**.

Find a visual implementation that works with the existing functionality.

---

# 3. DO NOT DO THESE THINGS

Do NOT:

- Delete the existing seven pipeline components.
- Replace existing sections with a new application architecture.
- Create a new `Command Center` application architecture unless it already exists.
- Create a new `Attribution` module to replace Vessel Identification.
- Create a new `Evidence` application to replace Evidence Fusion.
- Create a new Analytics system unless the existing project already contains it.
- Replace existing components with unrelated components.
- Change the existing data generators.
- Change existing scientific/model logic.
- Change existing SAR processing behavior.
- Change existing vessel attribution logic.
- Change existing drift logic.
- Change existing evidence logic.
- Change backend/API behavior.
- Change routes unnecessarily.
- Remove existing functionality because it does not fit the new design.
- Add fake functionality merely to make the interface look more complete.
- Present simulated data as real-world evidence.
- Introduce a dark cyberpunk aesthetic.
- Turn the project into a generic SaaS dashboard.

---

# 4. PRIMARY DESIGN GOAL

The desired result is:

```text
EXISTING S.A.M.U.D.R.A.
          +
VISUAL / UX POLISH
          ↓
POLISHED LIGHT-THEME MARITIME
INTELLIGENCE INTERFACE
```

The application should communicate:

- Government-grade
- Scientific
- Maritime
- Geospatial
- Investigative
- Evidence-oriented
- Professional
- Reliable
- Technical

It should NOT communicate:

- Gaming
- Cyberpunk
- Cryptocurrency
- Consumer social media
- Generic AI startup
- "AI magic"
- Hacker terminal

---

# 5. TARGET USERS

The interface should be appropriate for:

- Indian Coast Guard / maritime surveillance personnel
- Maritime investigators
- Pollution-control authorities
- Port authorities
- Maritime researchers
- Environmental agencies
- Maritime insurance / P&I investigators
- Shipping companies conducting defensive investigations
- Technical evaluators and government/hackathon judges

The UI should be understandable to both technical and non-technical government users.

---

# 6. LIGHT THEME

The final design should be **light-theme-first**.

Do NOT use the previous dark command-center theme.

The reason is that this is a data-heavy, government/scientific application where readability of:

- Maps
- Satellite imagery
- Tables
- Evidence
- Coordinates
- Charts
- Reports
- Vessel information

is more important than creating a dark futuristic aesthetic.

---

# 7. COLOR PALETTE

Use the following as the starting design system.

## Background

```text
Page background:
#F4F7FA

Secondary background:
#EEF4F7
```

## Surfaces

```text
Primary card:
#FFFFFF

Secondary card:
#F8FBFC
```

## Maritime / Brand Colors

```text
Deep Navy:
#123047

Dark Navy:
#0B2538

Ocean Blue:
#147EAF

Ocean Cyan:
#20A6C7
```

## Text

```text
Primary text:
#172B38

Secondary text:
#627785

Muted text:
#8497A3
```

## Borders

```text
Primary border:
#D5E1E7

Strong border:
#B9CBD5
```

## Status

```text
Success:
#25805F

Warning:
#C68A16

Critical:
#C9434E

Information:
#147EAF
```

Use status colors sparingly.

Do not make the entire interface colorful.

---

# 8. DESIGN LANGUAGE

The interface should use:

- White surfaces
- Very light blue/grey backgrounds
- Navy headings
- Ocean-blue interactive elements
- Thin subtle borders
- Small or moderate border radius
- Very subtle shadows
- Clean alignment
- Clear whitespace
- Strong information hierarchy

Avoid:

- Huge rounded cards
- Excessive glassmorphism
- Neon effects
- Excessive gradients
- Excessive shadows
- Giant decorative illustrations
- Excessive animations

---

# 9. TYPOGRAPHY

Use a clean modern sans-serif.

Preferred:

```text
Inter
```

or:

```text
IBM Plex Sans
```

Technical data can use:

```text
IBM Plex Mono
```

or:

```text
JetBrains Mono
```

Use monospace for:

- Coordinates
- UTC timestamps
- IMO numbers
- MMSI
- Sensor IDs
- Model IDs
- Technical identifiers

---

# 10. GLOBAL APPLICATION SHELL

Redesign the existing application shell without changing its behavior.

The shell should have:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ S.A.M.U.D.R.A.                         SYSTEM ONLINE ●              │
│ Maritime Pollution Intelligence       23 SEP 2026 · 14:32 UTC      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                 EXISTING APPLICATION CONTENT                        │
│                                                                     │
│                                                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ SAR ●   AIS ●   WEATHER ●   OCEAN ●                  SYSTEM READY  │
└─────────────────────────────────────────────────────────────────────┘
```

Do not introduce a new navigation architecture if the current project does not require one.

Improve the existing header/navigation instead.

---

# 11. HEADER

The header should communicate:

```text
S.A.M.U.D.R.A.
MARITIME POLLUTION INTELLIGENCE
```

And show useful system metadata such as:

```text
SYSTEM ONLINE ●
23 SEP 2026 · 14:32 UTC
```

If the existing project already has controls, preserve them.

Do not remove working controls just to simplify the header.

---

# 12. PIPELINE NAVIGATION

The existing seven-stage pipeline should become visually connected.

Use a visual progress/navigation indicator.

Example:

```text
● 01         ● 02          ● 03          ○ 04
INCIDENT → INGESTION → SLICK → HINDCAST

○ 05          ○ 06          ○ 07
FORECAST → VESSEL → EVIDENCE
```

The indicator should reflect the existing application state.

It must not introduce a new workflow.

---

# 13. INCIDENT TRIGGER

Keep the existing Incident Trigger functionality.

Improve its visual presentation.

Suggested structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ INCIDENT TRIGGER                                             │
│                                                              │
│ NEW MARITIME EVENT                                           │
│                                                              │
│ Detection source       SAR / Satellite                       │
│ Timestamp              23 SEP 2026 · 09:42 UTC               │
│ Location               18.92° N · 72.81° E                   │
│                                                              │
│ STATUS                                                       │
│ ● DETECTION RECEIVED                                         │
│                                                              │
│                         [ CONTINUE ]                          │
└──────────────────────────────────────────────────────────────┘
```

The exact information should remain based on the existing component.

---

# 14. DATA INGESTION

Keep the existing Data Ingestion logic. `Section2_DataIngestion.jsx`
currently ingests **five** sources, not three — the redesign must show all
five as equal peers, not feature four of them:

```text
DATA INGESTION

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SAR          │ │ AIS          │ │ OCEAN /      │ │ WIND FIELD   │ │ METEOROLOGICAL│
│              │ │              │ │ CURRENT      │ │              │ │              │
│ AVAILABLE ✓  │ │ AVAILABLE ✓  │ │ AVAILABLE ✓  │ │ AVAILABLE ✓  │ │ AVAILABLE ✓  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

Each card already carries real metadata (e.g. satellite name, AIS coverage
%, current speed/direction, wind speed/direction) — surface a couple of
the most decision-relevant metadata fields on the card face itself rather
than hiding everything behind a click; this is what lets an investigator
sanity-check the pipeline's inputs at a glance.

Use clear status labels.

Do not use color alone to communicate status.

---

# 15. SLICK ANALYSIS

This should be one of the strongest visual sections, and it has the most
existing functionality to preserve. `Section3_SlickAnalysis.jsx` currently
renders **three** panels, a Classification Confidence block, a Slick
Properties block, and a Spill Age Estimate block — all of it real,
computed data, not placeholder text.

Suggested layout:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SLICK ANALYSIS                                                              │
├───────────────────┬───────────────────┬─────────────────────┬──────────────┤
│                   │                   │                     │ CLASSIFICATION│
│   A · RAW SAR     │  B · DETECTED     │  C · EO VALIDATION   │ Oil      86% │
│                   │  (+ overlay)      │  (or "Unavailable")  │ Look-alike 6%│
│                   │       ▓▓▓         │                     │ Clean     5% │
│                   │     ▓▓▓▓▓         │                     ├──────────────┤
│                   │       ▓▓          │                     │ SLICK PROPS  │
│                   │                   │                     │ Length 3108m │
│                   │                   │                     │ Area 2.1km²  │
├───────────────────┴───────────────────┴─────────────────────┤ Orientation  │
│ SPILL AGE ESTIMATE — Bonn Code 2 (Rainbow), ~18h, "Recent"   │ 27°          │
└─────────────────────────────────────────────────────────────┴──────────────┘
```

Panel C is conditional — it is correct and intentional for it to often show
"EO Unavailable" with a reason (cloud cover / night pass) instead of an
image. Do not force an image into Panel C when the underlying data says
none is available; design a clean, equally polished unavailable-state
instead (see Section 36, Error/Unavailable States).

The "Show Rejected Look-Alike" toggle above the panels is existing,
functional, and must be preserved.

Use a clean white/light interface around the imagery. The imagery itself
(the SAR/EO canvases) is intentionally dark/black — that is correct and
realistic (real sensor imagery is dark); only the chrome around it should
be light-themed.

Do not interfere with the actual image-analysis functionality.

---

# 16. CLEAN SCAN RESULT

`CleanScanResult.jsx` exists and is shown INSTEAD of the seven-stage
pipeline when a Report-a-Spill investigation finds nothing. This is not a
generic "detection found/not found" placeholder — redesign it to match
what it actually contains:

```text
✅ NO ANOMALY DETECTED
Reported zone investigated — the SAR pass came back clean

┌──────────────────────────────────────────────────┐
│              [ map, marker + scan-radius circle ] │
└──────────────────────────────────────────────────┘

Reported At        18.95°N, 72.95°E
Scan Radius        22 km
Area Scanned       1,521 km²
Satellite Pass     Sentinel-1A

Reported Notes
"Fishing crew reported a sheen near the outer anchorage..."

No dark, low-backscatter region consistent with an oil slick signature
was found within the scanned area on this pass. This does not rule out
a spill outside the scan radius, one too small to resolve, or one that
has since dispersed — a clean result is not the same as a guarantee.

[ 📍 REPORT ANOTHER ZONE ]
```

The honest caveat paragraph at the bottom is existing copy and must be
kept — it is a deliberate design choice (do not oversell a clean result
as certainty), not filler text to be trimmed.

Keep the existing output and actions.

---

# 17. BACKWARD RECONSTRUCTION

Keep the existing Backward Reconstruction logic.

Make the map the primary visual.

Example:

```text
BACKWARD RECONSTRUCTION

                    PROBABLE
                  SOURCE REGION
                       ●
                       │
                       │
                       │
                       ●
                     SLICK

Direction
← Previous movement

Time window
-24h → NOW

Confidence
81%
```

The map should clearly distinguish:

- Observed slick
- Reconstructed path
- Probable source region
- Uncertainty

Use:

```text
PROBABLE SOURCE REGION
```

rather than:

```text
SOURCE OF POLLUTION
```

unless the underlying system actually establishes that fact.

---

# 18. FORWARD DRIFT TRACE

Keep the existing Forward Drift Trace functionality.

Use an intuitive timeline.

```text
NOW              +6H              +12H             +24H
 ●────────────────●─────────────────●─────────────────●
SLICK            FORECAST          FORECAST          FORECAST
```

The map should show the forecast path/corridor.

Include existing model information where available.

Make uncertainty visually understandable.

---

# 19. VESSEL IDENTIFICATION

Keep the existing Vessel Identification functionality.
`Section6_VesselIdentification.jsx` renders a ranked table of AIS
candidates (all IMO numbers are real-format 7-digit, e.g. `IMO 8341207`),
each scored on four named dimensions — use these exact labels, not
generic substitutes:

```text
VESSEL IDENTIFICATION

#1  MT VINDHYA                              IMO 8341207
    Distance 4.3 km

    Spatial      91%    Temporal     93%
    Heading      84%    Behavioural  70%

    Behaviour Timeline (72h):
    ├─────[████ AIS GAP ████]──────◆────────────┤
    0h                          speed anomaly  72h

[ VIEW TRACK ]  [ VIEW DETAILS ]
```

"Heading" — not "Track compatibility" or "SAR match" — is the correct
label; it is a heading-vs-bearing consistency score and has nothing to do
with SAR imagery. The Behaviour Timeline bar (red = AIS dark period, amber
= loitering, purple diamond = sudden speed drop) is real, computed data
per vessel and should stay a first-class visual element in the row, not a
tooltip-only detail.

Use language such as:

```text
Candidate vessel
Correlation / evidence score
Investigative relevance
```

Avoid:

```text
Guilty vessel
Confirmed polluter
Responsible ship
```

unless such information is actually established by the underlying system/data.

---

# 20. VESSEL TRACK

Vessel tracks are displayed on the map inside `Section6_VesselIdentification.jsx`
itself — this is not a separate screen or route. Where the existing
application displays a vessel track, improve the map presentation without
introducing a new page/route for it.

Example:

```text
                 CURRENT
                   🚢
                  /
                 /
                /
               /
              ●
         RELEVANT POSITION
```

Use a clear distinction between:

- Current vessel location
- Historical track
- Incident
- Slick
- Reconstructed path

Do not introduce new tracking functionality if it doesn't already exist.

---

# 21. EVIDENCE FUSION

Keep the existing Evidence Fusion functionality.
`Section7_EvidenceFusion.jsx` has TWO distinct outcomes that must both be
designed for — do not design only the "success" case:

```text
EVIDENCE FUSION

── OUTCOME A: ATTRIBUTED (~72% of runs) ──────────────────────
🎯 MOST PROBABLE CANDIDATE

   (score ring)   MT VINDHYA                🔄 ✓ Consistent 78%
      87%         IMO 8341207

   Spatial ○  Temporal ○  Heading ○  Behavioural ○
    91%        93%          84%         70%

   Composite 82.4% × reconstruction-confidence adjustment
   = Association score 87.0%

── OUTCOME B: UNKNOWN (~28% of runs) ──────────────────────────
❓ SOURCE UNKNOWN

   No candidate vessel meets the confidence threshold for
   attribution. May mean the discharging vessel was not
   transmitting usable AIS, or this was not a vessel source.

   Closest partial match — not attributed:  MT NEPTUNE STAR (34%)
```

The 🔄 counterfactual badge (Consistent / Partial / Inconsistent) on each
candidate is an independent corroboration check — whether forward-
drifting that vessel's own AIS position would physically reach the
observed slick. When it contradicts the top-ranked candidate (ranks #1 on
AIS evidence but "Inconsistent" on the drift check), the existing UI shows
a prominent red "⚠ Contradicting evidence" warning box — preserve this
visibility; do not bury contradicting evidence in a tooltip or small badge.

The user should be able to understand which evidence sources — spatial,
temporal, heading, behavioural, and the counterfactual check — contribute
to the result, and see clearly when the system is NOT confident, not only
when it is.

---

# 22. REPORT SPILL MODAL

Keep the existing Report Spill Modal functionality. `ReportSpillModal.jsx`
is a location-picker + note form, NOT an incident-confirmation form — there
is no incident yet at this point, so fields like "Incident ID" or
"Confidence" do not apply here (those only exist after the system has
investigated and found something, in the pipeline itself). Its real
fields are:

```text
┌───────────────────────────────────────────────────────────────┐
│ 📍 REPORT A SPILL                                          ×  │
│ Flag a zone for investigation — the system scans it and      │
│ reports what it actually finds, including a clean result.    │
├───────────────────────────────┬───────────────────────────────┤
│ CLICK MAP TO DROP PIN          │ OR ENTER COORDINATES          │
│                                 │ [ Lat ] [ Lon ]                │
│   [ interactive map ]          │                                │
│                                 │ OR PICK A KNOWN ZONE           │
│                                 │ [ search: "kandla" ]           │
│                                 │  Kandla Port, Gujarat          │
│                                 │  New Mangalore Port            │
├─────────────────────────────────────────────────────────────────┤
│ NOTES (optional)                                                │
│ [ e.g. Fishing crew reported a sheen near the outer anchorage ] │
├─────────────────────────────────────────────────────────────────┤
│ Selected: 23.03°N, 70.22°E              [ CANCEL ] [ 🔍 INVESTIGATE ] │
└─────────────────────────────────────────────────────────────────┘
```

All three location-input methods (map click, manual lat/lon, known-zone
search) are existing and functional — preserve all three, do not collapse
them into one.

Do not change what the modal actually does.

---

# 23. SECTION CARDS

If the existing project uses SectionCard, redesign the shared component so that all sections automatically become visually consistent.

Suggested characteristics:

```text
Background:
#FFFFFF

Border:
#D5E1E7

Radius:
8–12px

Shadow:
very subtle

Heading:
#123047

Accent:
#147EAF
```

Avoid every section having a completely different visual style.

---

# 24. STATUS BADGES

Redesign StatusBadge consistently.

Examples:

```text
● ONLINE
● PROCESSING
● READY
● WARNING
● ERROR
```

Use:

- Icon + text
- Color + text
- Accessible contrast

Do not rely on color alone.

---

# 25. MAP DESIGN

Maps should look professional and light.

Avoid a dark cyberpunk map.

Use:

- Light base map
- White/grey geographic surfaces
- Navy coastline
- Ocean blue
- Cyan incident highlights
- Amber warning regions
- Controlled red for critical incidents

Map elements should remain readable when multiple layers are active.

---

# 26. MAP LEGEND

Use a compact legend.

Example:

```text
LEGEND

● Incident
● Vessel
━ AIS Track
▒ Slick
→ Ocean Current
╱ Drift Path
```

The legend should be visible when needed but not dominate the map.

---

# 27. DATA TABLES

For data-heavy views, use light tables.

Example:

```text
┌─────────────────────────────────────────────────────────────┐
│ VESSEL          IMO        DISTANCE       CORRELATION       │
├─────────────────────────────────────────────────────────────┤
│ MV OCEAN STAR   1234567    8.4 km         91%              │
│ BLUE HORIZON    7654321    12.1 km        72%              │
└─────────────────────────────────────────────────────────────┘
```

Use:

- Clear headers
- Alternating subtle row backgrounds
- Hover state
- Compact technical typography
- Good whitespace

---

# 28. DATA VISUALIZATION

Charts should use the maritime palette.

Prefer:

- Navy
- Ocean blue
- Cyan
- Muted grey
- Amber for warnings
- Red only for critical values

Do not use a rainbow palette.

Charts should prioritize readability over decoration.

---

# 29. TIMELINES

Investigation timelines should be clean.

Example:

```text
09:42 UTC
● SAR scene received

09:44 UTC
● Potential slick detected

09:47 UTC
● AIS correlation started

10:03 UTC
● Backward reconstruction completed

10:17 UTC
● Forward drift model completed
```

Use the existing timeline/events where available.

---

# 30. CONFIDENCE DISPLAY

Confidence values should be visually prominent but scientifically framed.

Example:

```text
DETECTION CONFIDENCE

87%

HIGH
```

The interface should not imply:

```text
87% = 87% legal certainty
```

Use supporting labels such as:

```text
Model confidence
Detection confidence
Correlation score
```

depending on what the value actually represents.

---

# 31. GOVERNMENT / OPERATIONAL FEEL

Use:

- Precise labels
- Technical metadata
- UTC timestamps
- Coordinates
- Source identifiers
- Clear status
- Structured reports
- Consistent terminology
- Clean tables
- Restrained visual design

Avoid marketing phrases such as:

```text
AI MAGIC
REVOLUTIONARY AI
100% AUTOMATED
```

unless they are explicitly part of the existing project and factually supported.

---

# 32. INFORMATION HIERARCHY

The visual hierarchy should communicate:

```text
WHAT HAPPENED?
        ↓
INCIDENT

WHAT WAS OBSERVED?
        ↓
SAR / DATA

WHAT WERE THE CONDITIONS?
        ↓
WEATHER / OCEAN

WHERE COULD IT HAVE ORIGINATED?
        ↓
BACKWARD RECONSTRUCTION

WHERE COULD IT MOVE?
        ↓
FORWARD DRIFT

WHICH VESSELS CORRELATE?
        ↓
VESSEL IDENTIFICATION

WHAT DOES THE COMBINED EVIDENCE SHOW?
        ↓
EVIDENCE FUSION
```

This is a presentation hierarchy, not a replacement workflow.

---

# 33. RESPONSIVE DESIGN

Desktop is the primary target because this is a data-heavy operational application.

Support:

- Desktop
- Laptop
- Tablet
- Smaller displays

Do not simply shrink desktop layouts.

For smaller screens:

- Stack cards
- Collapse side panels
- Make tables horizontally scrollable
- Allow maps to expand
- Preserve readable typography

Do not remove functionality.

---

# 34. ANIMATION

Use subtle animation.

Good:

- Section transitions
- Loading indicators
- Map layer transitions
- Timeline movement
- Button hover
- Modal transitions
- Pipeline progress

Avoid:

- Constant particles
- Neon glow
- Cyberpunk scanning effects everywhere
- Huge page transitions
- Excessive parallax
- Decorative animation that interferes with data

Animation should communicate state.

---

# 35. LOADING STATES

Use informative loading states.

Example:

```text
PROCESSING SAR SCENE

████████████████░░░░ 82%

Extracting potential slick geometry...
```

Use existing processing states if already implemented.

Do not fabricate processing steps.

---

# 36. ERROR STATES

Use useful explanations.

Example:

```text
DATA SOURCE UNAVAILABLE

Oceanographic data could not be retrieved.

Last available update:
23 SEP · 13:58 UTC

[ RETRY ]
```

Do not use vague messages such as:

```text
Something went wrong.
```

---

# 37. EMPTY STATES

Example:

```text
NO INCIDENT DATA AVAILABLE

No incidents match the current
selection.

[ RESET FILTERS ]
```

Keep empty states consistent.

---

# 38. ACCESSIBILITY

The redesign should:

- Maintain strong text contrast
- Not rely only on color
- Use visible focus states
- Use labels for icons
- Support keyboard navigation where practical
- Keep buttons readable
- Keep data tables legible
- Avoid tiny technical text

---

# 39. NO FUNCTIONAL REGRESSION

After redesigning each component, verify:

### Incident Trigger

- Existing action still works.

### Data Ingestion

- Existing sources still load.

### Slick Analysis

- Existing analysis still runs.

### Clean Scan Result

- Existing results still display.

### Backward Reconstruction

- Existing model/output still works.

### Forward Drift Trace

- Existing forecast still works.

### Vessel Identification

- Existing vessel data still appears.

### Evidence Fusion

- Existing evidence output still works.

### Report Spill Modal

- Existing report workflow still works.

---

# 40. FILE-SAFETY RULE

Do not delete existing files merely because a new design does not use them immediately.

Do not create a replacement component until you have verified whether the existing component can be restyled.

Prefer:

```text
MODIFY EXISTING COMPONENT
```

over:

```text
DELETE EXISTING COMPONENT
CREATE NEW COMPONENT
```

When adding a new purely visual helper component is genuinely necessary, keep the original functionality intact.

---

# 41. IMPLEMENTATION STRATEGY

Work incrementally.

### Phase 1 — Global design system

Modify:

- Global colors
- Typography
- Spacing
- Buttons
- Cards
- Borders
- Status badges
- Backgrounds

### Phase 2 — Application shell

Improve:

- Header
- Existing navigation
- Pipeline indicator
- Page container

### Phase 3 — Existing pipeline sections

Redesign one at a time:

```text
Incident Trigger
↓
Data Ingestion
↓
Slick Analysis
↓
Clean Scan Result
↓
Backward Reconstruction
↓
Forward Drift Trace
↓
Vessel Identification
↓
Evidence Fusion
```

### Phase 4 — Existing modals / supporting UI

Redesign:

- Report Spill Modal
- SectionCard
- StatusBadge
- Existing controls

### Phase 5 — Responsive polish

Test:

- Desktop
- Laptop
- Tablet

### Phase 6 — Final visual consistency pass

Check:

- Spacing
- Typography
- Colors
- Alignment
- Borders
- Button hierarchy
- Status indicators
- Maps
- Tables
- Modals

---

# 42. GIT-SAFE DEVELOPMENT

Make changes incrementally.

After each major stage, stop and verify the application.

Recommended checkpoints:

```text
Checkpoint 1
Global theme

Checkpoint 2
Application shell

Checkpoint 3
Pipeline sections 1–3

Checkpoint 4
Pipeline sections 4–7

Checkpoint 5
Supporting components

Checkpoint 6
Responsive/final polish
```

Do not make hundreds of unrelated changes in one pass.

---

# 43. IMPORTANT INSTRUCTION FOR AI CODING AGENT

Before modifying the project:

```text
INSPECT THE EXISTING PROJECT FIRST.
```

Identify:

- Current App.jsx
- Current CSS
- Existing components
- Existing imports
- Existing data flow
- Existing event handlers
- Existing state
- Existing API calls
- Existing model/simulation logic

Then make the smallest changes necessary for the visual redesign.

If you are unsure whether a piece of code is functional or visual:

**preserve it.**

Do not delete it.

---

# 44. FINAL DESIGN TARGET

The finished application should look like:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ S.A.M.U.D.R.A.                              SYSTEM ONLINE ●         │
│ Maritime Pollution Intelligence                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 01 INCIDENT → 02 DATA → 03 SLICK → 04 HINDCAST → 05 FORECAST      │
│                                      → 06 VESSEL → 07 EVIDENCE      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         EXISTING WORKSPACE                          │
│                                                                     │
│              Clean light maritime/GIS interface                     │
│                                                                     │
│              Existing functionality preserved                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ SAR ●    AIS ●    WEATHER ●    OCEAN ●              SYSTEM READY   │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 45. FINAL PRINCIPLE

The redesign should answer:

> "How can we make the S.A.M.U.D.R.A. that already exists look significantly more professional?"

It should NOT answer:

> "How can we build a different maritime application?"

The existing S.A.M.U.D.R.A. is the product.

The redesign is only the presentation layer.

---

# FINAL ONE-LINE BRIEF

**Redesign the complete existing S.A.M.U.D.R.A. frontend into a clean, light, government-grade maritime intelligence interface, while preserving the existing components, seven-stage pipeline, functionality, data flow, model logic, and interactions exactly as they currently work.**

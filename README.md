# 🛰 S.A.M.U.D.R.A

**S**atellite **A**IS **M**aritime **U**nified **D**etection, **R**econstruction & **A**ttribution

SAMUDRA is an interactive, front-end-only simulation of a maritime oil-spill forensics pipeline. It walks through the full investigative workflow — from satellite detection of a slick to identifying the vessel most likely responsible — as a seven-stage animated dashboard, using entirely synthetic but physically-motivated data.

Built for **Smart India Hackathon (SIH) 2026**. This is our internal-hackathon-shortlisted submission ahead of the main SIH round.

> ⚠️ All data in this app is **synthetically generated**. No live satellite, AIS, or oceanographic feeds are used. This is a demo/prototype of what such a system's UI and reasoning pipeline could look like, not an operational tool.

## What it does

Clicking **"Trigger Incident"** generates a self-consistent synthetic maritime pollution event and runs it through seven stages:

| # | Stage | Description |
|---|-------|-------------|
| 1 | **Incident Trigger** | A satellite (SAR) pass detects a possible slick and opens a new incident. |
| 2 | **Multi-Source Data Ingestion** | Pulls in synthetic SAR, historical AIS, ocean current, wind, and meteorological data relevant to the incident window. |
| 3 | **Slick Analysis** | Runs a mock detector over a synthetic SAR scene (speckle noise + oil patch + look-alike) to classify and measure the slick. |
| 4 | **Backward Source Reconstruction (Hindcast)** | Integrates ocean current + wind drift backward in time from the observed slick to estimate a probable origin and release window, with an uncertainty ensemble. |
| 5 | **Forward Drift Trace (Forecast)** | Seeds particles at the reconstructed origin and projects the slick's future movement using the same drift physics, forward in time. |
| 6 | **Vessel Identification** | Cross-references synthetic historical AIS tracks against the reconstructed origin/time window, scoring candidate vessels by spatial, temporal, and behavioural overlap. |
| 7 | **Evidence Fusion** | Combines the reconstruction, forecast, and vessel-attribution confidence scores into a single ranked hypothesis — presented as decision support with explicit uncertainty, never a verdict. |

Each stage can be stepped through manually or auto-played, with a live "Investigation Log" tracking events as they happen, and results rendered on an interactive Leaflet map alongside charts (via Recharts).

### Design principles baked into the code

- **Deterministic, seeded data** — every generator derives its numbers from a shared seed (`src/data/rng.js`) rather than independent `Math.random()` calls, so a given incident is internally consistent and reproducible.
- **Causal pipeline, not independent randomness** — later stages consume the actual outputs of earlier stages (e.g. the hindcast uses the same drift model as the forecast; vessel scores are derived from real AIS-style tracks, not random numbers).
- **Detector vs. ground truth** — the synthetic SAR "detector" only sees the noisy scene, not the hidden ground truth, so its output is a realistic estimate rather than a lookup.
- **Swappable stand-ins** — each mock module (hindcast, forecast, vessel attribution) is written to be a drop-in replacement target for a real system (e.g. OpenDrift/OpenOil for drift physics) without changing the call sites.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [React Leaflet](https://react-leaflet.js.org/) for the map
- [Recharts](https://recharts.org/) for charts
- [Oxlint](https://oxc.rs/) for linting

## Getting started

```bash
# install dependencies
npm install

# start the dev server
npm run dev

# build for production
npm run build

# preview the production build
npm run preview

# lint
npm run lint
```

## Project structure

```
src/
├── App.jsx                     # Top-level layout, incident lifecycle, stage sequencing
├── components/
│   ├── Section1_IncidentTrigger.jsx
│   ├── Section2_DataIngestion.jsx
│   ├── Section3_SlickAnalysis.jsx
│   ├── Section4_BackwardReconstruction.jsx
│   ├── Section5_ForwardDriftTrace.jsx
│   ├── Section6_VesselIdentification.jsx
│   ├── Section7_EvidenceFusion.jsx
│   ├── SectionCard.jsx         # Shared card shell for each stage
│   └── StatusBadge.jsx         # Pending / Processing / Complete indicator
└── data/
    ├── rng.js                  # Shared seeded RNG
    ├── generateIncident.js     # Orchestrates all generators into one incident object
    ├── generateSarScene.js     # Step 1/3: synthetic SAR scene + detection
    ├── generateSarRaster.js    # Visualization-only SAR raster for the UI
    ├── generateIngestion.js    # Step 2: multi-source data ingestion
    ├── generateHindcast.js     # Step 4: backward drift reconstruction
    ├── generateForecast.js     # Step 5: forward drift forecast
    ├── generateVesselAttribution.js # Step 6: AIS vessel scoring
    └── generateEvidenceFusion.js    # Step 7: final ranked hypothesis
```

## Status

This is a prototype/demo UI built to explore how a multi-stage maritime forensics pipeline could be visualized and explained, with synthetic data standing in for the real satellite, AIS, and environmental data sources such a system would eventually integrate.

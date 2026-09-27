<div align="center">

# 🛰️ S.A.M.U.D.R.A.

*Satellite Assisted Marine Understanding, Detection, Routing & Attribution*

**A maritime pollution intelligence & investigation prototype — Smart India Hackathon 2026**

[![SIH 2026](https://img.shields.io/badge/SIH-2026-4A6FA5?style=flat-square)](https://sih2026.vuce.in/ps/SIH26143)
[![PS ID 26143](https://img.shields.io/badge/PS%20ID-26143-4A6FA5?style=flat-square)](https://sih2026.vuce.in/ps/SIH26143)
[![NTRO](https://img.shields.io/badge/Org-NTRO-4A6FA5?style=flat-square)](https://sih2026.vuce.in/ps/SIH26143)
[![Disaster Management](https://img.shields.io/badge/Theme-Disaster%20Management-4A6FA5?style=flat-square)](https://sih2026.vuce.in/ps/SIH26143)
&nbsp;
[![React 19](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-20232A?style=flat-square&logo=vite&logoColor=646CFF)](https://vitejs.dev)
[![Status: Prototype](https://img.shields.io/badge/status-prototype-lightgrey?style=flat-square)]()

### [▶ Watch Demo Video](https://youtu.be/G-IyEcj6BLo) &nbsp;·&nbsp; [🔗 Live Prototype](https://s-a-m-u-d-r-a.vercel.app/) &nbsp;·&nbsp; **Team CheatCode** (ID 143744)

</div>

<br>

<div align="center">

[![Watch the demo](https://img.youtube.com/vi/G-IyEcj6BLo/hqdefault.jpg)](https://youtu.be/G-IyEcj6BLo)

*Click to watch the full walkthrough on YouTube*

</div>

<br>

## The Problem

Marine oil spills cause severe, lasting damage to coastal ecosystems — and in most cases, the vessel responsible is never identified. Existing monitoring is manual, slow, and rarely connects *what was spilled* to *who spilled it*.

**Problem Statement SIH26143** (National Technical Research Organisation) asks for an automated pipeline that can:

1. **Detect** oil slicks from satellite imagery (SAR/EO) and characterize their geometry and age
2. **Trace** the slick backward to its likely origin point and time, and **forecast** its future drift, using oceanographic and meteorological data
3. **Attribute** the spill to a responsible vessel by reconstructing historical AIS traffic around the origin window and scoring candidates on proximity, trajectory, and behavior — filtering out irrelevant traffic

S.A.M.U.D.R.A. is our answer: an end-to-end investigation pipeline, wrapped in an explainable dashboard built for the people who'd actually have to act on its output — Coast Guard analysts, pollution-control authorities, and maritime investigators.

<br>

## What It Does

The system runs every incident through **seven investigation stages**, each visualized as its own step in an auditable pipeline:

```
01 · INCIDENT TRIGGER  →  02 · DATA INGESTION  →  03 · SLICK ANALYSIS  →  04 · BACKWARD RECON
                                          ↓
07 · EVIDENCE FUSION  ←  06 · VESSEL IDENTIFICATION  ←  05 · FORWARD DRIFT TRACE
```

| Stage | What happens |
|:--|:--|
| **1 · Incident Trigger** | A SAR pass flags a candidate slick, or an investigator manually reports a zone (see *Report a Spill* below) |
| **2 · Data Ingestion** | Pulls five coherent data sources for the incident window: Sentinel-1 SAR, historical AIS, ocean/current, wind field, and meteorological data |
| **3 · Slick Analysis** | Segments the slick from SAR, cross-validates against an EO/optical pass when sky conditions allow, computes geometry (area, perimeter, elongation) and estimates spill age via a Bonn Appearance Code + weathering model |
| **4 · Backward Reconstruction** | Runs a hindcast (OpenDrift/OpenOil-style) to estimate the probable origin point, release-time window, and uncertainty radius |
| **5 · Forward Drift Trace** | Forecasts the slick's future path so responders know where it's headed, not just where it came from |
| **6 · Vessel Identification** | Reconstructs historical AIS tracks through the origin window and scores each vessel on **spatial, temporal, heading, and behavioral** evidence — AIS gaps, sudden speed drops, and loitering are surfaced explicitly |
| **7 · Evidence Fusion** | Fuses all four scores into a single ranked hypothesis, cross-checked by a **counterfactual simulation** (does forward-drifting the candidate vessel's own position actually reach the slick?), and clearly flags an **"Unknown Source"** outcome when nothing meets the confidence bar — rather than forcing a guess |

**Two ways to start an investigation:**
- ⚡ **Trigger Incident** — simulates an automatic satellite-triggered detection
- 📍 **Report a Spill** — an investigator flags a zone (map click, lat/lon, or searchable Indian port list); the system investigates and honestly reports back, including a **clean result** when no anomaly is found

<br>

## Why It's Designed This Way

- **Evidence, not accusation.** Every attribution ships with a confidence score and its supporting evidence — spatial, temporal, heading, behavioral — rather than a flat "guilty" verdict. Vessel attribution has real legal and commercial consequences, so the system is built to support an investigation, not replace one.
- **Corroboration by counterfactual.** The top-ranked vessel by AIS correlation isn't taken at face value — its own reported track is forward-drifted independently to check whether it could physically produce the observed slick. When the two disagree, the UI surfaces a contradicting-evidence warning instead of quietly picking a winner.
- **"We don't know" is a valid answer.** In scenarios where no vessel clears the attribution threshold, S.A.M.U.D.R.A. reports an honest Unknown Source outcome rather than force-ranking a false positive.
- **Built for the people who'd use it.** The interface deliberately avoids "AI magic" framing — coordinates, UTC timestamps, IMO numbers, and model confidence are shown as what they are: inputs to a human investigator's decision, not a verdict.

<br>

## What's Real vs. What's Mocked

*(read this before a demo — we'd rather say it than have someone find out by digging)*

| | |
|:--|:--|
| ✅ **Real** | The full pipeline UI/UX; the evidence-scoring math (weighted spatial/temporal/heading/behavioral composite with exponential decay — not linear or random); the counterfactual-consistency check; the drift-hindcast/forecast interaction model; the two-outcome (Attributed / Unknown) evidence-fusion logic |
| 🔶 **Mocked for demo** | The satellite pixels, AIS feed, and oceanographic data are seeded, deterministic synthetic generators — not a trained segmentation model or a live data feed |

Every section names its intended real-world source inline (e.g. *"Panels A/B would be actual Sentinel-1 pixels run through a trained segmentation model such as DeepLabV3+, not a rendered texture"*), so the gap between prototype and production is explicit, not hidden.

Production integration would replace the synthetic generators in `src/data/` with: Sentinel-1 SAR imagery run through a trained segmentation model (DeepLabV3+/U-Net), real historical AIS (Indian Coast Guard / DGS, supplementing global sources), and Copernicus Marine Service (CMEMS) ocean/wind fields — without changing the pipeline, scoring, or UI built around them.

<br>

## Tech Stack

| Layer | Technology |
|:--|:--|
| Frontend framework | React 19 + Vite |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet / React-Leaflet |
| Charts | Recharts |
| Linting | Oxlint |

*(Production backend for real satellite/AIS processing — FastAPI, PyTorch/DeepLabV3+, OpenDrift/OpenOil, PostGIS — is architected in the accompanying solution deck; this repo is the frontend/investigation-logic prototype.)*

<br>

## Getting Started

```bash
# clone
git clone https://github.com/<your-org>/S.A.M.U.D.R.A.git
cd S.A.M.U.D.R.A

# install
npm install

# run locally
npm run dev
```

Then open the printed local URL, click **⚡ Trigger Incident**, and step through the pipeline — use the playback controls (▶ / ⏭ / speed) in the header to auto-advance, or click through stage by stage.

```bash
npm run build      # production build
npm run preview    # preview the production build
npm run lint        # oxlint
```

<br>

## Project Structure

```
src/
├── App.jsx                    # shell: header, pipeline stepper, layout, investigation log
├── components/
│   ├── Section1_IncidentTrigger.jsx
│   ├── Section2_DataIngestion.jsx
│   ├── Section3_SlickAnalysis.jsx
│   ├── Section4_BackwardReconstruction.jsx
│   ├── Section5_ForwardDriftTrace.jsx
│   ├── Section6_VesselIdentification.jsx
│   ├── Section7_EvidenceFusion.jsx
│   ├── InvestigationMap.jsx     # map view shared across hindcast/forecast/vessel layers
│   ├── ReportSpillModal.jsx     # manual incident reporting
│   ├── CleanScanResult.jsx      # honest "nothing found" outcome
│   ├── HowItWorksTour.jsx
│   ├── SectionCard.jsx          # shared card frame for all 7 stages
│   └── StatusBadge.jsx
└── data/                       # deterministic, seeded incident/scenario generators
    ├── generateIncident.js
    ├── generateIngestion.js
    ├── generateSarScene.js
    ├── generateSarRaster.js
    ├── generateEoRaster.js
    ├── generateEoValidation.js
    ├── generateSpillAge.js
    ├── generateHindcast.js
    ├── generateForecast.js
    ├── generateVesselAttribution.js
    ├── generateEvidenceFusion.js
    ├── generateCounterfactual.js
    ├── generateReportedScan.js
    ├── sceneGeometry.js
    └── rng.js                  # seeded RNG — same incident always reproduces identically
```

<br>

## Problem Statement

| Field | Value |
|:--|:--|
| **PS ID** | 26143 |
| **Title** | Leveraging satellite imagery to determine Oil spills at sea along with AIS data correlations to identify vessel responsible for the spill |
| **Organization** | National Technical Research Organisation (NTRO) |
| **Theme** | Disaster Management |
| **Category** | Software |

## Team

**CheatCode** · Team ID 143744

## References

- Luo et al. (2024) — *A New Ship Tracing Technology from Oil Spills Based on Multi-Source Data*
- Longépé et al. (2015) — *Polluter Identification with Spaceborne Radar Imagery, AIS and Forward Drift Modeling*
- Liu & Zhang (2021) — *Tracing Illegal Oil Discharges from Vessels Using SAR and AIS in Bohai Sea of China*, Ocean & Coastal Management, Vol. 211
- Mumbai Oil Spills (2010–2011) — MSC Chitra collision and Uran pipeline leak, used as the drift/hindcast validation reference

**Datasets:** [MarineCadastre AIS](https://marinecadastre.gov/accessais/) (sample/synthetic for the demo region) · [Zenodo Sentinel-1 SAR Oil Spill Dataset](https://zenodo.org)

<br>

<div align="center">

*Built for Smart India Hackathon 2026 — Problem Statement 26143*

</div>

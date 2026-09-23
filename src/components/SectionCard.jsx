import { useState } from 'react';
import StatusBadge from './StatusBadge';

// Explainability Layer — one plain-language entry per pipeline stage,
// keyed by SectionCard's existing `number` prop. Purely additive: nothing
// here changes what a stage does or how it looks by default, it only adds
// an optional "What is this?" toggle next to the title. Collapsed by
// default, so the existing layout/density is unaffected until a user
// actually asks for the explanation.
const EXPLAINERS = {
  1: {
    question: 'Has an oil spill actually been detected, and where?',
    whatItDoes: 'Reads the satellite pass metadata and confirms a possible spill was flagged, with its rough location and time.',
    whatItMeans: "This confirms there's a case to investigate — every stage below builds on this one alert.",
  },
  2: {
    question: 'Do we have enough real-world data to investigate this properly?',
    whatItDoes: 'Pulls in five independent data feeds — satellite radar, ship-tracking history, ocean currents, wind, and weather — all matched to the same time and place as the alert.',
    whatItMeans: "If a source is missing or low-coverage, later stages are less reliable — this is the evidence foundation everything else stands on.",
  },
  3: {
    question: 'Is this actually oil, and how big or old is it?',
    whatItDoes: 'Analyzes the satellite image to outline the dark patch, measure its size and shape, and rule out look-alikes (like wind streaks) that are not oil.',
    whatItMeans: "Confirms it's a real spill — not a false alarm — and gives the hard numbers: size, shape, and roughly how long it's been there.",
  },
  4: {
    question: 'Where did this oil actually come from?',
    whatItDoes: "Runs the ocean current and wind data backward in time from the spill's location to trace where it must have started.",
    whatItMeans: "Gives a probable origin point and release time window — this is the place and time we'll search for a responsible vessel.",
  },
  5: {
    question: 'Where is this oil going to spread next?',
    whatItDoes: 'Runs the same current/wind model forward in time to predict how the slick will move and grow over the next day or two.',
    whatItMeans: 'Tells response teams where cleanup efforts matter most before the oil reaches new areas.',
  },
  6: {
    question: 'Which ships were near the origin at the right time?',
    whatItDoes: 'Searches historical ship-tracking (AIS) records for vessels near the origin point during the estimated release window, and flags suspicious behaviour like a ship going dark or slowing suddenly.',
    whatItMeans: "Produces a ranked list of suspect vessels — not proof of guilt, but a prioritized starting point for investigators.",
  },
  7: {
    question: "Putting it all together — what's the best conclusion?",
    whatItDoes: "Combines every score from the earlier stages into one ranking, and double-checks the top suspect by testing whether its own path could physically explain the spill.",
    whatItMeans: "Either names the most likely vessel with a confidence score, or honestly reports 'source unknown' if nothing is convincing enough — this is the final investigative output.",
  },
};

export default function SectionCard({ number, title, status, realDataNote, children }) {
  const [explainOpen, setExplainOpen] = useState(false);
  const explainer = EXPLAINERS[number];

  return (
    <section
      data-section={number}
      className={`rounded-lg border p-4 transition-all duration-700 ${
        status === 'Complete'
          ? 'border-[#BEDDCB] bg-white'
          : status === 'Processing'
            ? 'border-[#BFDCEA] bg-white animate-pulse'
            : 'border-[#D3DEE4] bg-white opacity-50'
      }`}
      style={{ boxShadow: '0 1px 2px rgba(18,52,74,0.04)' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="mono flex h-7 w-7 items-center justify-center rounded-md bg-[#EDF3F6] text-xs font-bold text-[#167EAD]">
            {String(number).padStart(2, '0')}
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#172A35]">{title}</h2>
          {explainer && (
            <button
              onClick={() => setExplainOpen((v) => !v)}
              aria-expanded={explainOpen}
              className={`ml-1 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                explainOpen
                  ? 'border-[#BFDCEA] bg-[#EAF4FA] text-[#12344A]'
                  : 'border-[#D3DEE4] bg-white text-[#8497A3] hover:border-[#BFDCEA] hover:text-[#167EAD]'
              }`}
            >
              ℹ️ What is this?
            </button>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {realDataNote && (
        <p className="mb-2 ml-[38px] flex items-start gap-1 text-[11px] leading-relaxed text-[#8497A3]">
          <span className="shrink-0">ℹ️</span>
          <span>{realDataNote}</span>
        </p>
      )}

      {explainer && explainOpen && (
        <div className="mb-3 ml-[38px] grid gap-2.5 rounded-md border border-[#D3DEE4] bg-[#EDF3F6] p-3 sm:grid-cols-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">The Question</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#172A35]">{explainer.question}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">What The System Does</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#172A35]">{explainer.whatItDoes}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">What The Result Means</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#172A35]">{explainer.whatItMeans}</p>
          </div>
        </div>
      )}

      <div className={`mt-3 transition-opacity duration-500 ${status === 'Pending' ? 'pointer-events-none' : ''}`}>
        {children}
      </div>
    </section>
  );
}
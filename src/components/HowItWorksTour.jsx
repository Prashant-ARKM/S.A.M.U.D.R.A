import { useEffect, useState } from 'react';

// Self-contained step copy for the tour — deliberately not shared with
// SectionCard's "What is this?" panel, so this file has zero coupling to
// anything else and can be deleted/disabled without touching another file.
const STEPS = [
  {
    section: 1,
    title: 'Incident Trigger',
    question: 'Has a spill actually been detected, and where?',
    whatItDoes: 'A satellite pass flags a possible slick — this stage confirms it and records the rough location and time.',
    whatItMeans: 'This is the starting alert. Every stage below investigates this one case.',
  },
  {
    section: 2,
    title: 'Data Ingestion',
    question: 'Do we have enough data to investigate properly?',
    whatItDoes: 'Five independent feeds are pulled in — radar imagery, ship-tracking history, ocean currents, wind, and weather.',
    whatItMeans: 'This is the evidence foundation everything else is built on.',
  },
  {
    section: 3,
    title: 'Slick Analysis',
    question: 'Is this actually oil, and how big is it?',
    whatItDoes: 'The satellite image is analyzed to outline the slick, measure it, and rule out look-alikes like wind streaks.',
    whatItMeans: 'Confirms it is a real spill and gives the hard numbers: size, shape, and rough age.',
  },
  {
    section: 4,
    title: 'Backward Reconstruction',
    question: 'Where did this oil come from?',
    whatItDoes: 'Ocean current and wind data are run backward in time from the slick to trace where it must have started.',
    whatItMeans: 'Gives a probable origin point and release time window — where we search for a responsible vessel.',
  },
  {
    section: 5,
    title: 'Forward Drift Trace',
    question: 'Where is the oil going next?',
    whatItDoes: 'The same current/wind model runs forward in time to predict how the slick spreads over the next day or two.',
    whatItMeans: 'Tells response teams where cleanup matters most before the oil reaches new areas.',
  },
  {
    section: 6,
    title: 'Vessel Identification',
    question: 'Which ships were near the origin at the right time?',
    whatItDoes: 'Historical ship-tracking (AIS) records are searched near the origin point, flagging suspicious behaviour like going dark.',
    whatItMeans: 'Produces a ranked list of suspect vessels — a starting point for investigators, not proof.',
  },
  {
    section: 7,
    title: 'Evidence Fusion',
    question: "Putting it together — what's the conclusion?",
    whatItDoes: 'Every score is combined into one ranking, and the top suspect is double-checked against the physical drift.',
    whatItMeans: "Names the most likely vessel with a confidence score, or honestly reports 'source unknown'.",
  },
];

export default function HowItWorksTour({ onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const step = STEPS[stepIndex];

  useEffect(() => {
    const el = document.querySelector(`[data-section="${step.section}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Measure after the smooth-scroll has had a moment to settle.
      const t = setTimeout(() => setTargetRect(el.getBoundingClientRect()), 350);
      return () => clearTimeout(t);
    }
    setTargetRect(null);
  }, [step.section]);

  useEffect(() => {
    function onScrollOrResize() {
      const el = document.querySelector(`[data-section="${step.section}"]`);
      if (el) setTargetRect(el.getBoundingClientRect());
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [step.section]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setStepIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isLast = stepIndex === STEPS.length - 1;

  // Panel position: just below the spotlighted section when found,
  // otherwise centered (e.g. before an incident has been triggered, so
  // the real sections aren't in the DOM yet).
  const panelStyle = targetRect
    ? {
        position: 'fixed',
        top: Math.min(targetRect.bottom + 12, window.innerHeight - 260),
        left: Math.max(12, Math.min(targetRect.left, window.innerWidth - 380)),
        zIndex: 10000,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      };

  return (
    <>
      {/* Dim everything except the spotlighted section (CSS spotlight trick). */}
      <div
        className="z-[9998] transition-all duration-300"
        style={
          targetRect
            ? {
                position: 'fixed',
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                borderRadius: 10,
                boxShadow: '0 0 0 9999px rgba(18,52,74,0.55)',
                pointerEvents: 'none',
              }
            : { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(18,52,74,0.55)' }
        }
      />

      {/* Explanation panel */}
      <div
        style={panelStyle}
        className="w-[360px] max-w-[92vw] rounded-lg border border-[#D3DEE4] bg-white p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="mono text-[10px] font-semibold uppercase tracking-wider text-[#8497A3]">
            How It Works — Step {stepIndex + 1} / {STEPS.length}
          </span>
          <button onClick={onClose} className="text-[#8497A3] hover:text-[#172A35]" aria-label="Close tour">✕</button>
        </div>

        <h3 className="text-sm font-bold text-[#12344A]">{String(step.section).padStart(2, '0')} · {step.title}</h3>

        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">The Question</p>
            <p className="text-[12px] leading-relaxed text-[#172A35]">{step.question}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">What The System Does</p>
            <p className="text-[12px] leading-relaxed text-[#172A35]">{step.whatItDoes}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8497A3]">What The Result Means</p>
            <p className="text-[12px] leading-relaxed text-[#172A35]">{step.whatItMeans}</p>
          </div>
        </div>

        {!targetRect && (
          <p className="mt-2 text-[10px] italic text-[#8497A3]">
            Trigger an incident to see this stage highlighted live.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-[#EDF3F6] pt-3">
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s.section}
                className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? 'bg-[#167EAD]' : 'bg-[#D3DEE4]'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => i - 1)}
                className="rounded-lg border border-[#D3DEE4] px-3 py-1.5 text-xs font-semibold text-[#607580] hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
              className="rounded-lg bg-[#167EAD] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#125E80]"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
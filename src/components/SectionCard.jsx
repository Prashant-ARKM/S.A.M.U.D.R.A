import StatusBadge from './StatusBadge';

export default function SectionCard({ number, title, status, children }) {
  return (
    <section
      className={`rounded-xl border p-5 transition-all duration-700 ${
        status === 'Complete'
          ? 'border-[#D1FAE5] bg-white'
          : status === 'Processing'
            ? 'border-[#A5F3FC] bg-white animate-pulse'
            : 'border-[#E2E5EA] bg-white opacity-50'
      }`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-sm font-bold text-[#0EA5B7] mono">
            {number}
          </span>
          <h2 className="text-lg font-semibold text-[#1A1D23]">{title}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className={`transition-opacity duration-500 ${status === 'Pending' ? 'pointer-events-none' : ''}`}>
        {children}
      </div>
    </section>
  );
}

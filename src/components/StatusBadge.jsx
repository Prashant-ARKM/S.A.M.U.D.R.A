const STYLES = {
  Pending: 'bg-gray-100 text-gray-500 border-gray-300',
  Processing: 'bg-[#FEF3C7] text-[#B77B18] border-[#FDE68A]',
  Complete: 'bg-[#E7F3ED] text-[#287A5D] border-[#BEDDCB]',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`mono inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-500 ${STYLES[status] || STYLES.Pending}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'Processing'
            ? 'bg-[#B77B18] animate-pulse'
            : status === 'Complete'
              ? 'bg-[#287A5D]'
              : 'bg-gray-400'
        }`}
      />
      {status}
    </span>
  );
}

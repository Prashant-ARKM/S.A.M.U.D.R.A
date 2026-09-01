const STYLES = {
  Pending: 'bg-gray-100 text-gray-500 border-gray-300',
  Processing: 'bg-[#FEF3C7] text-[#D97706] border-[#FCD34D]',
  Complete: 'bg-[#ECFDF5] text-[#059669] border-[#6EE7B7]',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider mono transition-all duration-500 ${STYLES[status] || STYLES.Pending}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === 'Processing'
            ? 'bg-[#D97706] animate-pulse'
            : status === 'Complete'
              ? 'bg-[#059669]'
              : 'bg-gray-400'
        }`}
      />
      {status}
    </span>
  );
}

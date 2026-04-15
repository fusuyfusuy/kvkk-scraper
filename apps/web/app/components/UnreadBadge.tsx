export function UnreadBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-full">
      {displayCount}
    </span>
  );
}

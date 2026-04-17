import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  value: ReactNode;
  subLabel?: ReactNode;
  valueClassName?: string;
}

export function Card({ title, value, subLabel, valueClassName = '' }: CardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className={`mt-2 text-3xl font-bold text-gray-900 ${valueClassName}`}>{value}</p>
      {subLabel && <div className="mt-1 text-sm text-gray-500">{subLabel}</div>}
    </div>
  );
}

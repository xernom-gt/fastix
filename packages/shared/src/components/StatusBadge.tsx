import React from 'react';
import { STATUS_STYLE_MAP, type StatusModule } from '../constants/status';

export interface StatusBadgeProps {
  module: StatusModule;
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  module,
  status,
  size = 'md',
  className = '',
}) => {
  const key = `${module}:${status}`;
  const config = STATUS_STYLE_MAP[key] ?? {
    bg: '#E5E7EB',
    text: '#1F2937',
    border: '#D1D5DB',
    dot: '#6B7280',
    label: status,
  };

  return (
    <span
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <span
        style={{ backgroundColor: config.dot }}
        className="w-1.5 h-1.5 rounded-full shrink-0"
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  );
};

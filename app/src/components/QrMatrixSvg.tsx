import React from 'react';

interface QrMatrixSvgProps {
  value: string;
  size?: number;
}

/**
 * Menghasilkan representasi visual matriks QR deterministik dari string payload.
 */
export const QrMatrixSvg: React.FC<QrMatrixSvgProps> = ({ value, size = 148 }) => {
  const grid = 21;
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (isFinder(r, c)) continue;
      const bit = ((seed >>> ((r * grid + c) % 24)) ^ (r * 7 + c * 13 + value.length)) & 1;
      if (bit === 1) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111827" />);
      }
    }
  }

  const renderFinder = (x: number, y: number) => (
    <g>
      <rect x={x} y={y} width={7} height={7} fill="#111827" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#FFFFFF" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#111827" />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      role="img"
      aria-label={`Kode QR untuk ${value}`}
      className="block"
    >
      <rect width={grid} height={grid} fill="#FFFFFF" />
      {renderFinder(0, 0)}
      {renderFinder(grid - 7, 0)}
      {renderFinder(0, grid - 7)}
      {cells}
    </svg>
  );
};

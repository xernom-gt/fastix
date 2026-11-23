import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface QrMatrixSvgProps {
  value: string;
  size?: number;
}

/**
 * Menghasilkan representasi visual matriks QR berstandar ISO/IEC 18004
 * agar dapat dipindai secara optik oleh kamera loket gate (jsQR) dan aplikasi e-wallet.
 */
export const QrMatrixSvg: React.FC<QrMatrixSvgProps> = ({ value, size = 148 }) => {
  const { grid, pathData } = useMemo(() => {
    const payload = value.trim() || 'FASTIX';
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const quietZone = 2;
    const totalGrid = moduleCount + quietZone * 2;

    const segments: string[] = [];
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          segments.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
        }
      }
    }

    return {
      grid: totalGrid,
      pathData: segments.join(''),
    };
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Kode QR untuk ${value}`}
      className="block"
    >
      <rect width={grid} height={grid} fill="#FFFFFF" />
      <path d={pathData} fill="#111827" />
    </svg>
  );
};

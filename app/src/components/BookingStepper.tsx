import React from 'react';

interface BookingStepperProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { step: 1, label: 'Pilih Jadwal' },
  { step: 2, label: 'Bayar QRIS' },
  { step: 3, label: 'E-Ticket QR' },
] as const;

export const BookingStepper: React.FC<BookingStepperProps> = ({ currentStep }) => {
  return (
    <nav aria-label="Tahap pemesanan tiket" className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
      <ol className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2 text-xs sm:text-sm">
        {STEPS.map((item, idx) => {
          const isDone = item.step < currentStep;
          const isActive = item.step === currentStep;
          return (
            <li key={item.step} className="flex items-center gap-2 shrink-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                  isActive || isDone
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {isDone ? '✓' : item.step}
              </span>
              <span
                className={`font-bold whitespace-nowrap ${
                  isActive ? 'text-gray-900' : isDone ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
              {idx < STEPS.length - 1 && (
                <span className="hidden md:block w-6 h-px bg-gray-200 ml-1" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

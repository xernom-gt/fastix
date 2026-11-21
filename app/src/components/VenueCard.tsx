import { Link } from 'react-router-dom';
import {
  formatJarak,
  formatRupiah,
  formatTanggalID,
  type Destinasi,
} from '@pariwisloka/shared';

export interface VenueEntry {
  venue: Destinasi;
  distanceMeters: number | null;
  remainingQuota: number;
}

export function VenueCard({
  entry,
  tanggal,
  eager = false,
}: {
  entry: VenueEntry;
  tanggal: string;
  eager?: boolean;
}) {
  const { venue, distanceMeters, remainingQuota } = entry;
  const initials = venue.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <Link
      to={`/destinasi/${venue.id}?tanggal=${encodeURIComponent(tanggal)}`}
      className="group bg-white border border-gray-200 rounded-2xl p-3 shadow-[0_2px_10px_rgba(17,24,39,0.04)] hover:shadow-[0_8px_24px_rgba(17,24,39,0.08)] hover:border-gray-300 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 ease-out flex flex-col"
    >
      <div className="relative aspect-[16/9] rounded-xl bg-gray-100 overflow-hidden">
        <img
          src={venue.gambarUrl}
          alt={venue.gambarAlt}
          width={640}
          height={360}
          loading={eager ? 'eager' : 'lazy'}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
        />
        {distanceMeters !== null && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/95 text-[#111827] text-[10px] font-bold shadow-sm">
            {formatJarak(distanceMeters)}
          </span>
        )}
      </div>

      <div className="pt-3 flex-1 flex flex-col justify-between gap-2.5 min-w-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3 className="text-sm font-bold text-[#111827] truncate group-hover:text-black transition-colors">
              {venue.nama}
            </h3>
            <span
              className="material-symbols-outlined text-[18px] text-[#111827] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0"
              aria-hidden="true"
            >
              arrow_forward
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="material-symbols-outlined text-[14px] text-[#111827] shrink-0" aria-hidden="true">
              calendar_month
            </span>
            <span className="truncate">
              {formatTanggalID(tanggal)} • {remainingQuota > 0 ? `Sisa ${remainingQuota}` : 'Habis'}
            </span>
          </div>
          <p className="text-sm font-extrabold text-[#111827] pt-0.5">
            {formatRupiah(venue.hargaMulai)}
          </p>
        </div>

        <div className="pt-2.5 border-t border-gray-100 flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-[#111827] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {initials}
          </span>
          <span className="text-xs text-gray-600 truncate font-medium">
            {venue.lokasi}
          </span>
        </div>
      </div>
    </Link>
  );
}

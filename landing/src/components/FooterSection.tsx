interface FooterSectionProps {
  appUrl: string;
  adminUrl: string;
}

export function FooterSection({ appUrl, adminUrl }: FooterSectionProps) {
  return (
    <footer className="border-t border-gray-200 bg-white py-10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-gray-600">
        <div className="space-y-1">
          <span className="block font-bold text-sm text-gray-900">Fastix</span>
          <span>E-Ticketing Wisata &amp; Acara Lokal</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium">
          <a href={`${appUrl}/explore`} className="hover:text-gray-900 py-1">
            Aplikasi Utama
          </a>
          <a href={`${appUrl}/tiket`} className="hover:text-gray-900 py-1">
            Cek Tiket
          </a>
          <a href="#harga-b2b" className="hover:text-gray-900 py-1">
            Biaya
          </a>
          <a href={adminUrl} className="hover:text-gray-900 py-1">
            Admin HQ
          </a>
        </div>
      </div>
    </footer>
  );
}

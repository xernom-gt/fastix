import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  formatJarak,
  formatRupiah,
  hitungJarakHaversine,
  WILAYAH_INDONESIA,
  type Destinasi,
} from '@pariwisloka/shared';
import { useBookings } from '../store/bookingStore';

interface Coordinates {
  lat: number;
  lng: number;
  label: string;
}

interface RouteSummary {
  distanceMeters: number;
  durationMinutes: number;
  isRoadRoute: boolean;
}

const DEFAULT_ORIGIN: Coordinates = {
  lat: -7.7956,
  lng: 110.3695,
  label: 'Pusat Yogyakarta',
};

function createPinIcon(active: boolean, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:9999px;background:${
      active ? '#111827' : '#ffffff'
    };color:${active ? '#ffffff' : '#111827'};border:1.5px solid #111827;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);transform:translate(-50%,-50%);">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createOriginIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 0 3px rgba(37,99,235,0.28);transform:translate(-50%,-50%);"></div>',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function MapPage() {
  const { venues } = useBookings();
  const publishedVenues = useMemo(() => venues.filter((v) => v.isPublished), [venues]);

  const [selectedId, setSelectedId] = useState<string>(publishedVenues[0]?.id ?? '');
  const [origin, setOrigin] = useState<Coordinates>(DEFAULT_ORIGIN);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const selectedVenue: Destinasi | undefined = useMemo(
    () => publishedVenues.find((v) => v.id === selectedId) ?? publishedVenues[0],
    [publishedVenues, selectedId],
  );

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Lokasi Saya',
        });
        setGeoStatus('ok');
      },
      () => {
        setGeoStatus('error');
      },
      { timeout: 8000 },
    );
  };

  // Initialize Leaflet map instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Render destination & origin markers
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    L.marker([origin.lat, origin.lng], { icon: createOriginIcon() })
      .bindTooltip(origin.label, { direction: 'top' })
      .addTo(layer);

    for (const venue of publishedVenues) {
      const isSelected = venue.id === selectedVenue?.id;
      const marker = L.marker([venue.koordinat.lat, venue.koordinat.lng], {
        icon: createPinIcon(isSelected, venue.nama),
      });
      marker.on('click', () => setSelectedId(venue.id));
      marker.addTo(layer);
    }
  }, [publishedVenues, selectedVenue?.id, origin]);

  // Fetch OSRM driving route with coordinate polyline fallback
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer || !selectedVenue) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    setRouteLoading(true);

    const drawFallbackRoute = () => {
      routeLayer.clearLayers();
      const straightMeters = hitungJarakHaversine(
        origin.lat,
        origin.lng,
        selectedVenue.koordinat.lat,
        selectedVenue.koordinat.lng,
      );
      const line = L.polyline(
        [
          [origin.lat, origin.lng],
          [selectedVenue.koordinat.lat, selectedVenue.koordinat.lng],
        ],
        { color: '#111827', weight: 3, dashArray: '6 6' },
      ).addTo(routeLayer);
      map.fitBounds(line.getBounds().pad(0.25));
      setRouteSummary({
        distanceMeters: straightMeters,
        durationMinutes: Math.max(5, Math.round((straightMeters / 1000 / 45) * 60)),
        isRoadRoute: false,
      });
    };

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${selectedVenue.koordinat.lng},${selectedVenue.koordinat.lat}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('OSRM error'))))
      .then((data: { routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> }) => {
        const route = data.routes?.[0];
        if (!route?.geometry?.coordinates?.length) {
          drawFallbackRoute();
          return;
        }
        routeLayer.clearLayers();
        const latLngs: L.LatLngExpression[] = route.geometry.coordinates.map(([lng, lat]) => [
          lat,
          lng,
        ]);
        const polyline = L.polyline(latLngs, { color: '#111827', weight: 4 }).addTo(routeLayer);
        map.fitBounds(polyline.getBounds().pad(0.2));
        setRouteSummary({
          distanceMeters: route.distance,
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          isRoadRoute: true,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          drawFallbackRoute();
        } else {
          drawFallbackRoute();
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setRouteLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [origin, selectedVenue]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
            Peta Destinasi &amp; Rute
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pilih destinasi wisata pada peta untuk melihat estimasi jarak dan rute perjalanan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih titik berangkat"
            value={origin.label}
            onChange={(e) => {
              const region = WILAYAH_INDONESIA.find((w) => w.nama === e.target.value);
              if (region) {
                setOrigin({ lat: region.pusat.lat, lng: region.pusat.lng, label: region.nama });
              }
            }}
            className="h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-[#111827]"
          >
            <option value="Pusat Yogyakarta">Dari: Yogyakarta</option>
            {WILAYAH_INDONESIA.map((w) => (
              <option key={w.kode} value={w.nama}>
                Dari: {w.nama}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleUseMyLocation}
            className="h-10 px-4 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              my_location
            </span>
            <span>{geoStatus === 'loading' ? 'Mencari Lokasi...' : 'Lokasi Saya'}</span>
          </button>
        </div>
      </div>

      {geoStatus === 'error' && (
        <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-xs text-gray-700">
          Izin lokasi tidak tersedia. Menggunakan titik berangkat pilihan Anda ({origin.label}).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Daftar Destinasi */}
        <div className="lg:col-span-4 space-y-2.5 max-h-[420px] lg:max-h-[540px] overflow-y-auto pr-1">
          {publishedVenues.map((v) => {
            const active = v.id === selectedVenue?.id;
            const straightDist = hitungJarakHaversine(
              origin.lat,
              origin.lng,
              v.koordinat.lat,
              v.koordinat.lng,
            );
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-colors space-y-1.5 ${
                  active
                    ? 'bg-[#111827] text-white border-[#111827]'
                    : 'bg-white text-[#111827] border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-extrabold">{v.nama}</p>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      active ? 'text-gray-200' : 'text-gray-600'
                    }`}
                  >
                    {formatJarak(straightDist)}
                  </span>
                </div>
                <p className={`text-xs ${active ? 'text-gray-300' : 'text-gray-500'}`}>
                  {v.lokasi} · Mulai {formatRupiah(v.hargaMulai)}
                </p>
              </button>
            );
          })}
        </div>

        {/* Peta OpenStreetMap & Ringkasan Rute */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative rounded-2xl border border-gray-200 overflow-hidden bg-gray-100 h-[360px] sm:h-[440px] z-0">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>

          {selectedVenue && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-[#111827]">{selectedVenue.nama}</h2>
                <p className="text-xs text-gray-600">{selectedVenue.alamat}</p>
                <p className="text-xs font-semibold text-[#111827]">
                  {routeLoading
                    ? 'Menghitung rute perjalanan...'
                    : routeSummary
                      ? `Rute dari ${origin.label}: ${formatJarak(routeSummary.distanceMeters)} · Estimasi ${routeSummary.durationMinutes} menit berkendara${
                          routeSummary.isRoadRoute ? '' : ' (garis koordinat)'
                        }`
                      : `Jarak dari ${origin.label}`}
                </p>
              </div>

              <Link
                to={`/destinasi/${selectedVenue.id}`}
                className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold text-center whitespace-nowrap transition-colors"
              >
                Lihat Detail &amp; Tiket
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    className: '!bg-transparent !border-0 !w-auto !h-auto',
    html: `<div class="w-max whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md border text-[11px] font-bold select-none cursor-pointer transition-transform ${
      active
        ? 'bg-[#111827] text-white border-[#111827]'
        : 'bg-white text-[#111827] border-gray-300 hover:border-gray-900'
    }" style="transform:translate(-50%,-50%);">
      <span style="width:6px;height:6px;border-radius:9999px;background:${active ? '#34d399' : '#9ca3af'};flex-shrink:0;"></span>
      <span>${label}</span>
    </div>`,
    iconSize: undefined,
    iconAnchor: undefined,
  });
}

function createOriginIcon(): L.DivIcon {
  return L.divIcon({
    className: '!bg-transparent !border-0 !w-auto !h-auto',
    html: '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 0 3px rgba(37,99,235,0.28);transform:translate(-50%,-50%);"></div>',
    iconSize: undefined,
    iconAnchor: undefined,
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
  const lastBoundsRef = useRef<L.LatLngBounds | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedVenue: Destinasi | undefined = useMemo(
    () => publishedVenues.find((v) => v.id === selectedId) ?? publishedVenues[0],
    [publishedVenues, selectedId],
  );

  useEffect(() => {
    if (!selectedVenue) return;
    const cardEl = cardRefs.current[selectedVenue.id];
    if (cardEl && window.innerWidth < 768) {
      cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedVenue?.id]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextOrigin = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Lokasi Saya',
        };
        setOrigin(nextOrigin);
        setGeoStatus('ok');
        mapRef.current?.setView([nextOrigin.lat, nextOrigin.lng], 11, { animate: true });
      },
      () => {
        setGeoStatus('error');
      },
      { timeout: 8000 },
    );
  };

  const handleFocusRoute = (venueId: string) => {
    setSelectedId(venueId);
    const map = mapRef.current;
    if (map && lastBoundsRef.current && venueId === selectedVenue?.id) {
      map.fitBounds(lastBoundsRef.current.pad(0.22), { animate: true });
    }
  };

  // Initialize Leaflet map instance once and keep size synced on layout/viewport changes
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const isDesktop = window.innerWidth >= 768;
    const map = L.map(container, {
      center: [DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng],
      zoom: 6,
      zoomControl: isDesktop,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const invalidateTimer = window.setTimeout(() => {
      if (mapRef.current === map) {
        map.invalidateSize({ animate: false });
      }
    }, 100);

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current === map) {
        map.invalidateSize({ animate: false });
      }
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (mapRef.current === map) {
        map.invalidateSize({ animate: false });
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.clearTimeout(invalidateTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      mapRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
      map.remove();
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

    const applyBounds = (bounds: L.LatLngBounds) => {
      if (controller.signal.aborted || mapRef.current !== map) return;
      lastBoundsRef.current = bounds;
      map.invalidateSize({ animate: false });
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        map.fitBounds(bounds, {
          paddingTopLeft: [24, 96],
          paddingBottomRight: [24, 176],
          animate: false,
        });
      } else {
        map.fitBounds(bounds.pad(0.2), { animate: false });
      }
    };

    const drawFallbackRoute = () => {
      if (controller.signal.aborted || mapRef.current !== map) return;
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
      applyBounds(line.getBounds());
      setRouteSummary({
        distanceMeters: straightMeters,
        durationMinutes: Math.max(5, Math.round((straightMeters / 1000 / 45) * 60)),
        isRoadRoute: false,
      });
    };

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${selectedVenue.koordinat.lng},${selectedVenue.koordinat.lat}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('OSRM error'))))
      .then(
        (data: {
          routes?: Array<{
            distance: number;
            duration: number;
            geometry: { coordinates: Array<[number, number]> };
          }>;
        }) => {
          if (controller.signal.aborted || mapRef.current !== map) return;
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
          applyBounds(polyline.getBounds());
          setRouteSummary({
            distanceMeters: route.distance,
            durationMinutes: Math.max(1, Math.round(route.duration / 60)),
            isRoadRoute: true,
          });
        },
      )
      .catch(() => {
        if (!controller.signal.aborted && mapRef.current === map) {
          drawFallbackRoute();
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [origin, selectedVenue]);

  return (
    <div className="md:max-w-7xl md:mx-auto md:px-6 md:pt-6 md:pb-10 md:space-y-5">
      {/* Desktop Header */}
      <div className="hidden md:flex items-end justify-between gap-4">
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
        <div className="hidden md:block rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-xs text-gray-700">
          Izin lokasi tidak tersedia. Menggunakan titik berangkat pilihan Anda ({origin.label}).
        </div>
      )}

      <div className="md:grid md:grid-cols-12 md:gap-5 md:items-start">
        {/* Desktop Daftar Destinasi */}
        <div className="hidden md:block md:col-span-4 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
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

        {/* Peta OpenStreetMap (Fullscreen di Mobile < md, Card di Desktop >= md) */}
        <div className="md:col-span-8 md:space-y-4">
          <div className="fixed inset-x-0 top-16 bottom-16 z-20 md:static md:inset-auto md:z-0 md:rounded-2xl md:border md:border-gray-200 overflow-hidden bg-gray-100 md:h-[460px]">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Mobile Floating Top Bar: Origin Chip + Route Info & Recenter Button */}
            <div className="md:hidden absolute top-3 inset-x-3 z-[1000] flex items-start justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md rounded-2xl px-3 py-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full bg-blue-600 shrink-0"
                    aria-hidden="true"
                  />
                  <select
                    aria-label="Pilih titik berangkat"
                    value={origin.label}
                    onChange={(e) => {
                      const region = WILAYAH_INDONESIA.find((w) => w.nama === e.target.value);
                      if (region) {
                        setOrigin({
                          lat: region.pusat.lat,
                          lng: region.pusat.lng,
                          label: region.nama,
                        });
                      }
                    }}
                    className="w-full bg-transparent text-xs font-extrabold text-[#111827] focus:outline-none truncate"
                  >
                    <option value="Pusat Yogyakarta">Dari: Yogyakarta</option>
                    {WILAYAH_INDONESIA.map((w) => (
                      <option key={w.kode} value={w.nama}>
                        Dari: {w.nama}
                      </option>
                    ))}
                    {origin.label === 'Lokasi Saya' && (
                      <option value="Lokasi Saya">Dari: Lokasi Saya</option>
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-gray-600 truncate mt-0.5 pl-3.5">
                  {routeLoading
                    ? 'Menghitung rute...'
                    : routeSummary && selectedVenue
                      ? `${selectedVenue.nama} · ${formatJarak(routeSummary.distanceMeters)} (${routeSummary.durationMinutes} mnt)`
                      : 'Pilih destinasi pada peta'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleUseMyLocation}
                aria-label="Lokasi Saya"
                className="pointer-events-auto w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md flex items-center justify-center text-[#111827] active:scale-95 shrink-0"
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    geoStatus === 'loading' ? 'animate-pulse text-blue-600' : ''
                  }`}
                  aria-hidden="true"
                >
                  my_location
                </span>
              </button>
            </div>

            {geoStatus === 'error' && (
              <div className="md:hidden absolute top-[72px] inset-x-3 z-[1000] rounded-xl border border-gray-300 bg-white/95 backdrop-blur-sm px-3 py-2 text-[11px] font-medium text-gray-700 shadow-sm">
                Izin lokasi tidak tersedia. Memakai titik berangkat {origin.label}.
              </div>
            )}

            {/* Mobile Floating Bottom Swipeable Destination Strip */}
            <div className="md:hidden absolute bottom-3 inset-x-0 z-[1000] px-3">
              <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-0.5">
                {publishedVenues.map((v) => {
                  const active = v.id === selectedVenue?.id;
                  const straightDist = hitungJarakHaversine(
                    origin.lat,
                    origin.lng,
                    v.koordinat.lat,
                    v.koordinat.lng,
                  );
                  const displayDist =
                    active && routeSummary ? routeSummary.distanceMeters : straightDist;
                  const displayDuration =
                    active && routeSummary
                      ? routeSummary.durationMinutes
                      : Math.max(5, Math.round((straightDist / 1000 / 45) * 60));

                  return (
                    <div
                      key={v.id}
                      ref={(el) => {
                        cardRefs.current[v.id] = el;
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(v.id);
                        }
                      }}
                      className={`snap-center shrink-0 w-[82vw] max-w-[310px] rounded-2xl border p-3.5 shadow-lg backdrop-blur-sm transition-colors space-y-2.5 cursor-pointer ${
                        active
                          ? 'bg-white border-[#111827] ring-1 ring-[#111827]'
                          : 'bg-white/95 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#111827] truncate">
                            {v.nama}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {v.lokasi} · {formatRupiah(v.hargaMulai)}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[#111827] text-[10px] font-bold shrink-0">
                          {formatJarak(displayDist)} · {displayDuration} mnt
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFocusRoute(v.id);
                          }}
                          className="flex-1 h-9 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[#111827] text-xs font-bold inline-flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                            directions
                          </span>
                          <span>Rute</span>
                        </button>
                        <Link
                          to={`/destinasi/${v.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 h-9 px-3 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                        >
                          <span>Pesan Tiket</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop Route Summary Card */}
          {selectedVenue && (
            <div className="hidden md:flex rounded-2xl border border-gray-200 bg-white p-5 items-center justify-between gap-4">
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

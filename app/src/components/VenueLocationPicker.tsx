import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface VenueLocationPickerProps {
  lat: number;
  lng: number;
  label?: string;
  onChange: (coords: { lat: number; lng: number }) => void;
}

const FALLBACK_COORDS = { lat: -7.7956, lng: 110.3695 };

function roundCoord(value: number): number {
  return Number(value.toFixed(6));
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function createMonochromePinIcon(): L.DivIcon {
  return L.divIcon({
    className: '!bg-transparent !border-0 !w-auto !h-auto',
    html: '<div style="width:20px;height:20px;border-radius:9999px;background:#111827;border:3px solid #ffffff;box-shadow:0 0 0 4px rgba(17,24,39,0.22),0 2px 6px rgba(0,0,0,0.3);transform:translate(-50%,-50%);cursor:grab;"></div>',
    iconSize: undefined,
    iconAnchor: undefined,
  });
}

export default function VenueLocationPicker({
  lat,
  lng,
  label,
  onChange,
}: VenueLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const initialLat = isValidCoord(lat, lng) ? lat : FALLBACK_COORDS.lat;
    const initialLng = isValidCoord(lat, lng) ? lng : FALLBACK_COORDS.lng;

    const map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      icon: createMonochromePinIcon(),
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current({
        lat: roundCoord(pos.lat),
        lng: roundCoord(pos.lng),
      });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const nextLat = roundCoord(e.latlng.lat);
      const nextLng = roundCoord(e.latlng.lng);
      marker.setLatLng([nextLat, nextLng]);
      onChangeRef.current({ lat: nextLat, lng: nextLng });
    });

    mapRef.current = map;
    markerRef.current = marker;

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
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !isValidCoord(lat, lng)) return;

    const current = marker.getLatLng();
    const moved =
      Math.abs(current.lat - lat) > 0.000001 || Math.abs(current.lng - lng) > 0.000001;
    if (moved) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true });
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label || 'Peta pemilih titik lokasi destinasi'}
      className="relative isolate z-0 w-full h-[260px] sm:h-[320px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
    />
  );
}

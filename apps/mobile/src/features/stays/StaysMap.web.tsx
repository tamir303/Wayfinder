import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/format';
import type { StaysMapProps } from './StaysMap.types';
import { StaysMapPlaceholder } from './StaysMapPlaceholder';

const pinStyle = (el: HTMLElement, selected: boolean) => {
  Object.assign(el.style, {
    cursor: 'pointer',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'inherit',
    border: `1px solid ${selected ? '#084C91' : '#D8DFE6'}`,
    background: selected ? '#0B6BCB' : '#FFFFFF',
    color: selected ? '#FFFFFF' : '#12202F',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    zIndex: selected ? '2' : '1',
  });
};

// Real map (MapLibre GL, MapTiler tiles). Falls back to the placeholder when there is no style URL or WebGL fails.
export const StaysMap = ({ stays, selectedId, onSelect, styleUrl }: StaysMapProps) => {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>>(new Map());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!styleUrl || !container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: container.current, style: styleUrl, center: [0, 20], zoom: 1, attributionControl: { compact: true } });
    } catch {
      setFailed(true); // e.g. no WebGL
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    const current = markers.current;
    return () => {
      current.forEach(({ marker }) => marker.remove());
      current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // Keep the markers in step with the stays and the selection, and frame them all.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = new Set(stays.map((s) => s.id));
    markers.current.forEach(({ marker }, id) => {
      if (!ids.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });
    for (const s of stays) {
      const label = t('stays.pin', { name: s.name, price: formatPrice(s.pricePerNight, s.currency) });
      let entry = markers.current.get(s.id);
      if (!entry) {
        const el = document.createElement('button');
        el.type = 'button';
        entry = { el, marker: new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map) };
        markers.current.set(s.id, entry);
      }
      entry.el.onclick = () => onSelect(s);
      entry.el.setAttribute('aria-label', label);
      entry.el.textContent = formatPrice(s.pricePerNight, s.currency);
      pinStyle(entry.el, s.id === selectedId);
    }
    if (stays.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      stays.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
  }, [stays, selectedId, onSelect, t, styleUrl]);

  if (!styleUrl || failed) return <StaysMapPlaceholder stays={stays} selectedId={selectedId} onSelect={onSelect} />;
  return <div ref={container} aria-label={t('stays.map')} style={{ height: 224, width: '100%', borderRadius: 12, overflow: 'hidden' }} />;
};

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Search, Loader } from 'lucide-react';

export default function MapGeoref({ value, onChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  
  const [addressInput, setAddressInput] = useState(value?.direccion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lat = value?.lat || -34.6037; // Default to Buenos Aires center
  const lng = value?.lng || -58.3816;

  useEffect(() => {
    // Initialize map
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([lat, lng], 13);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(mapInstanceRef.current);

      // Custom Circular Marker matching the user screenshot style
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: #0b3c5d;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 6px;
            height: 6px;
            background-color: #ffffff;
            border-radius: 50%;
          "></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(mapInstanceRef.current);

      // Handle drag end
      markerRef.current.on('dragend', () => {
        const position = markerRef.current.getLatLng();
        reverseGeocode(position.lat, position.lng);
      });
    }

    return () => {
      // Clean up map on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view when value changes externally
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && value) {
      const currentPos = markerRef.current.getLatLng();
      if (currentPos.lat !== value.lat || currentPos.lng !== value.lng) {
        markerRef.current.setLatLng([value.lat, value.lng]);
        mapInstanceRef.current.setView([value.lat, value.lng], 15);
      }
      if (addressInput !== value.direccion) {
        setAddressInput(value.direccion || '');
      }
    }
  }, [value]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!addressInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const first = data[0];
        const newLat = parseFloat(first.lat);
        const newLng = parseFloat(first.lon);
        const displayName = first.display_name;

        // Center map and move marker
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
          mapInstanceRef.current.setView([newLat, newLng], 15);
        }

        onChange({
          direccion: displayName,
          lat: newLat,
          lng: newLng
        });
        setAddressInput(displayName);
      } else {
        setError('No se pudo geolocalizar la dirección. Intenta con más detalles (ej. calle, altura, ciudad).');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor de mapas.');
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (lLatitude, lLongitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lLatitude}&lon=${lLongitude}`
      );
      const data = await response.json();
      if (data) {
        const address = data.display_name;
        setAddressInput(address);
        onChange({
          direccion: address,
          lat: lLatitude,
          lng: lLongitude
        });
      }
    } catch (err) {
      console.error('Error in reverse geocoding:', err);
      // Fallback update without address
      onChange({
        direccion: addressInput || `Coordenadas: ${lLatitude.toFixed(4)}, ${lLongitude.toFixed(4)}`,
        lat: lLatitude,
        lng: lLongitude
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full bg-white/70 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 Poppins"
            placeholder="Escribe la dirección de montaje (ej: Dean Funes 794, CABA)..."
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
          />
          <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all-300 flex items-center gap-2 shadow-md disabled:opacity-50"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Geolocalizar</span>
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs font-semibold px-1">{error}</p>
      )}

      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Latitud</label>
          <input
            type="text"
            readOnly
            className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-600 focus:outline-none"
            value={lat.toFixed(6)}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Longitud</label>
          <input
            type="text"
            readOnly
            className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-600 focus:outline-none"
            value={lng.toFixed(6)}
          />
        </div>
      </div>
    </div>
  );
}

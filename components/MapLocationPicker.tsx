import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  location: Location | null;
  onChange: (location: Location) => void;
  className?: string;
  defaultToCurrentLocation?: boolean;
}

const IRAQ_CENTER: Location = { lat: 33.3152, lng: 44.3661 }; // Baghdad

function LocationMarker({ position, onChange }: { position: Location | null, onChange: (location: Location) => void }) {
  const [pos, setPos] = useState<Location | null>(position);

  useEffect(() => {
    setPos(position);
  }, [position]);

  useMapEvents({
    click(e) {
      const newLoc = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPos(newLoc);
      onChange(newLoc);
    },
  });

  return pos === null ? null : (
    <Marker position={[pos.lat, pos.lng]} />
  );
}

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({ 
  location, 
  onChange, 
  className = "",
  defaultToCurrentLocation = false
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [initialCenter, setInitialCenter] = useState<Location>(location || IRAQ_CENTER);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (defaultToCurrentLocation && !location && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setInitialCenter(newLoc);
          onChange(newLoc);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        }
      );
    }
  }, [defaultToCurrentLocation, location, onChange]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("متصفحك لا يدعم تحديد الموقع");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        onChange(newLoc);
        setIsLocating(false);
        if (mapRef.current) {
          mapRef.current.flyTo([newLoc.lat, newLoc.lng], 15);
        }
      },
      (err) => {
        setIsLocating(false);
        alert("تعذر الحصول على موقعك. يرجى التأكد من تفعيل خدمة تحديد الموقع (GPS).");
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">تحديد الموقع على الخريطة (اختياري)</label>
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span>موقعي الحالي</span>
        </button>
      </div>
      
      <div className="h-[250px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner relative z-0">
        <MapContainer 
          center={[initialCenter.lat, initialCenter.lng]} 
          zoom={location ? 15 : 6} 
          scrollWheelZoom={true} 
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={location} onChange={onChange} />
        </MapContainer>
        
        {/* Helper overlay for instruction */}
        {!location && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/5">
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm text-sm text-gray-600 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>اضغط على الخريطة لتحديد موقعك بدقة</span>
            </div>
          </div>
        )}
      </div>
      {location && (
        <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
          <MapPin className="w-3 h-3" /> تم تحديد الموقع بنجاح.
        </span>
      )}
    </div>
  );
};

export default MapLocationPicker;

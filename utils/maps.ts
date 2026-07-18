export const getMapsUrl = (address?: string, mapsLink?: string, lat?: number, lng?: number) => {
  if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (mapsLink) return mapsLink;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return '#';
};

export const parseCoordsFromUrl = (urlStr: string): { lat: number, lng: number } | null => {
  try {
    const url = new URL(urlStr);
    const path = url.pathname + url.search + url.hash;
    
    // 1. Check for @lat,lng
    let match = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    // 2. Check for q=lat,lng or query=lat,lng
    match = path.match(/[?&](?:q|query|ll)=?(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    // 3. Check for dir/lat,lng
    match = path.match(/\/dir\/(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    // 4. Fallback: search for any "number.number,number.number" pattern
    const genericMatch = path.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (genericMatch) {
      const lat = parseFloat(genericMatch[1]);
      const lng = parseFloat(genericMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    // 5. Last resort: split by slashes and commas
    const parts = path.split(/[\/\?&]/);
    for (const part of parts) {
      const subParts = part.split(',');
      if (subParts.length >= 2) {
        const lat = parseFloat(subParts[0]);
        const lng = parseFloat(subParts[1]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          return { lat, lng };
        }
      }
    }
  } catch (e) {}
  return null;
};

export const resolveAndParseMapsLink = async (linkSource: string): Promise<{ lat: number, lng: number } | null> => {
    if (!linkSource) return null;
    
    const link = linkSource.trim();
    
    // Check if it's a raw coordinate string like "44.287945, 23.860107"
    const rawCoordsMatch = link.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (rawCoordsMatch) {
      const lat = parseFloat(rawCoordsMatch[1]);
      const lng = parseFloat(rawCoordsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }

    if (link.includes('maps.app.goo.gl') || link.includes('goo.gl/maps')) {
        try {
            const res = await fetch(`/api/resolve-maps-link?url=${encodeURIComponent(link)}`);
            const data = await res.json();
            if (data.resolvedUrl) {
                return parseCoordsFromUrl(data.resolvedUrl);
            }
        } catch (err) {
            console.error("Error resolving link:", err);
        }
    } else if (link.startsWith('http')) {
        return parseCoordsFromUrl(link);
    }
    
    return null;
};

/**
 * Extracts coordinates for a Visit, falling back to Property or Client coordinates,
 * or attempting to parse them from mapsLink.
 */
export const extractVisitCoordinates = (
  visit: any, 
  property?: any, 
  client?: any, 
  resolvedCoords: Record<string, any> = {}
): { lat: number, lng: number } | null => {
  // 0. Direct coordinates on visit
  if (visit?.latitude && visit?.longitude) {
    return { lat: visit.latitude, lng: visit.longitude };
  }

  // 1. Resolved short link coordinates
  if (visit?.id && resolvedCoords[visit.id]) {
    const rc = resolvedCoords[visit.id];
    // Accommodate Leaflet LatLng objects or plain objects
    if (typeof rc.lat === 'function') {
        return { lat: rc.lat(), lng: rc.lng() };
    }
    return { lat: rc.lat, lng: rc.lng };
  }

  // 2. Property coordinates
  if (property?.latitude && property?.longitude) {
    return { lat: property.latitude, lng: property.longitude };
  }

  // 3. Client coordinates
  if (client?.latitude && client?.longitude) {
    return { lat: client.latitude, lng: client.longitude };
  }

  // 4. Try to parse from mapsLink string without async resolution
  const leadMapsLink = visit?.leadData?.mapsLink || visit?.mapsLink;
  const linkSource = property?.mapsLink || visit?.propertyMapsLink || leadMapsLink;
  
  if (linkSource) {
    const link = linkSource.trim();
    const rawCoordsMatch = link.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (rawCoordsMatch) {
      return { lat: parseFloat(rawCoordsMatch[1]), lng: parseFloat(rawCoordsMatch[2]) };
    }
    if (link.startsWith('http')) {
      const parsed = parseCoordsFromUrl(link);
      if (parsed) return parsed;
    }
  }

  return null;
};

/**
 * Returns a valid string to be used as a destination in a Google Maps /dir/ URL.
 * It strictly avoids returning raw URLs which break the routing.
 */
export const getGoogleMapsDirDestination = (
  visit: any, 
  property?: any, 
  client?: any, 
  resolvedCoords: Record<string, any> = {}
): string | null => {
  // Try to get exact coordinates first
  const coords = extractVisitCoordinates(visit, property, client, resolvedCoords);
  if (coords) {
    return `${coords.lat},${coords.lng}`;
  }

  // If no coordinates, try physical address text
  const leadAddress = visit?.leadData?.adresa || visit?.adresa;
  const address = property?.address || visit?.propertyAddress || leadAddress || client?.adresa;
  
  if (address) {
    const textAddress = address.trim();
    // Do not use HTTP links as address for routing
    if (!textAddress.startsWith('http')) {
      return encodeURIComponent(textAddress);
    }
  }

  // No valid routing destination found
  return null;
};

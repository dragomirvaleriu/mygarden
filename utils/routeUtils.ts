export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

export const optimizeRouteNearestNeighbor = (
  startCoords: { lat: number; lng: number },
  points: { id: string; lat: number; lng: number }[],
  endCoords?: { lat: number; lng: number } | null
) => {
  if (points.length === 0) return [];

  // Exact TSP solver using backtracking for N <= 8 to find the global optimum
  if (points.length <= 8) {
    let bestOrder: string[] = [];
    let minTotalDist = Infinity;

    const used = new Array(points.length).fill(false);
    const path: string[] = [];

    const permute = (
      currentPos: { lat: number; lng: number },
      currentDist: number
    ) => {
      // Prune if current distance is already worse than the best found
      if (currentDist >= minTotalDist) return;

      if (path.length === points.length) {
        const finalDist = endCoords
          ? currentDist + calculateDistance(currentPos.lat, currentPos.lng, endCoords.lat, endCoords.lng)
          : currentDist;
        if (finalDist < minTotalDist) {
          minTotalDist = finalDist;
          bestOrder = [...path];
        }
        return;
      }

      for (let i = 0; i < points.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const pt = points[i];
        const d = calculateDistance(currentPos.lat, currentPos.lng, pt.lat, pt.lng);
        path.push(pt.id);
        permute({ lat: pt.lat, lng: pt.lng }, currentDist + d);
        path.pop();
        used[i] = false;
      }
    };

    permute(startCoords, 0);

    const route = [];
    let currentPos = startCoords;
    for (const id of bestOrder) {
      const pt = points.find(p => p.id === id)!;
      const d = calculateDistance(currentPos.lat, currentPos.lng, pt.lat, pt.lng);
      route.push({ id, distance: d });
      currentPos = { lat: pt.lat, lng: pt.lng };
    }
    return route;
  }

  // Fallback to nearest neighbor for N > 8
  const unvisited = [...points];
  const route = [];
  let currentPos = startCoords;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const point = unvisited[i];
      const dist = calculateDistance(currentPos.lat, currentPos.lng, point.lat, point.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextPoint = unvisited[nearestIdx];
    route.push({ id: nextPoint.id, distance: minDistance });
    currentPos = { lat: nextPoint.lat, lng: nextPoint.lng };
    unvisited.splice(nearestIdx, 1);
  }

  return route;
};


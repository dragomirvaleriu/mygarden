import { useState, useCallback } from 'react';
import { Visit, Property } from '../src/types';
import { resolveAndParseMapsLink } from '../utils/maps';
import { optimizeRouteNearestNeighbor } from '../utils/routeUtils';

interface StoredRoute {
  order: string[];         // optimized pending visit IDs at time of optimization
  snapshot: string[];      // same — used for invalidation (did non-first get skipped?)
  savedAt: number;         // ms timestamp
}

const LS_PREFIX = 'routeOpt_';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function lsKey(orgId: string, dateStr: string) {
  return `${LS_PREFIX}${orgId}_${dateStr}`;
}

function readLS(orgId: string, dateStr: string): StoredRoute | null {
  try {
    const raw = localStorage.getItem(lsKey(orgId, dateStr));
    if (!raw) return null;
    const data: StoredRoute = JSON.parse(raw);
    if (Date.now() - data.savedAt > TTL_MS) {
      localStorage.removeItem(lsKey(orgId, dateStr));
      return null;
    }
    return data;
  } catch { return null; }
}

function writeLS(orgId: string, dateStr: string, data: StoredRoute) {
  try { localStorage.setItem(lsKey(orgId, dateStr), JSON.stringify(data)); } catch {}
}

function clearLS(orgId: string, dateStr: string) {
  try { localStorage.removeItem(lsKey(orgId, dateStr)); } catch {}
}

/**
 * Given the saved route and the current pending visits,
 * determine if the order is still valid.
 *
 * Valid: only visits at the FRONT of the saved order have been completed.
 * Invalid: a visit that was NOT first in the remaining saved order was completed out of sequence.
 */
function validateSavedOrder(
  saved: StoredRoute,
  currentPendingIds: Set<string>
): { valid: boolean; orderedIds: string[] } {
  // Saved order filtered to only those still pending
  const stillPending = saved.order.filter(id => currentPendingIds.has(id));

  // Find which saved visits are now gone (completed/cancelled)
  const removed = saved.order.filter(id => !currentPendingIds.has(id));

  // For each removed visit: was it the "first" in the saved order at that point?
  // Valid removal: a visit was removed only if every visit before it in saved.order is also removed.
  // i.e., removals must be a prefix of saved.order.
  for (const removedId of removed) {
    const removedIdx = saved.order.indexOf(removedId);
    // Check that all visits before this one in the saved order are also removed
    for (let i = 0; i < removedIdx; i++) {
      if (currentPendingIds.has(saved.order[i])) {
        // A visit before this one is still pending — out-of-order completion
        return { valid: false, orderedIds: [] };
      }
    }
  }

  return { valid: true, orderedIds: stillPending };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface UseRouteOptimizerResult {
  getOrderedVisits: (dateStr: string, dayVisits: Visit[]) => Visit[];
  isOptimized: (dateStr: string) => boolean;
  isOptimizing: (dateStr: string) => boolean;
  handleOptimize: (
    dateStr: string,
    dayVisits: Visit[],
    properties: Property[],
    organization?: any
  ) => Promise<void>;
}

export function useRouteOptimizer(organizationId: string): UseRouteOptimizerResult {
  // In-memory cache: dateStr → ordered pending visit IDs
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [seenDates, setSeenDates] = useState<Set<string>>(new Set());
  const [optimizingSet, setOptimizingSet] = useState<Set<string>>(new Set());

  // Load from LS on first access for a given date, validate, and update state
  const hydrate = useCallback((dateStr: string, pendingIds: Set<string>) => {
    if (!organizationId || seenDates.has(dateStr)) return;

    setSeenDates(prev => new Set([...prev, dateStr]));

    const saved = readLS(organizationId, dateStr);
    if (!saved) return;

    const { valid, orderedIds } = validateSavedOrder(saved, pendingIds);
    if (!valid) {
      clearLS(organizationId, dateStr);
      return;
    }
    if (orderedIds.length > 0) {
      setOrders(prev => ({ ...prev, [dateStr]: orderedIds }));
    }
  }, [organizationId, seenDates]);

  // Re-validate on every render (visits might have changed status)
  const revalidate = useCallback((dateStr: string, pendingIds: Set<string>) => {
    if (!organizationId) return;
    const inMem = orders[dateStr];
    if (!inMem) return; // nothing to validate

    // Also cross-check against LS
    const saved = readLS(organizationId, dateStr);
    if (!saved) {
      setOrders(prev => { const n = { ...prev }; delete n[dateStr]; return n; });
      return;
    }

    const { valid, orderedIds } = validateSavedOrder(saved, pendingIds);
    if (!valid) {
      clearLS(organizationId, dateStr);
      setOrders(prev => { const n = { ...prev }; delete n[dateStr]; return n; });
      return;
    }
    // Update in-memory to reflect latest pending set (e.g. first visit finished)
    if (JSON.stringify(orderedIds) !== JSON.stringify(inMem)) {
      setOrders(prev => ({ ...prev, [dateStr]: orderedIds }));
    }
  }, [organizationId, orders]);

  const getOrderedVisits = useCallback((dateStr: string, dayVisits: Visit[]): Visit[] => {
    const pending = dayVisits.filter(v => v.status !== 'Finalizat' && v.status !== 'Anulat');
    const finished = dayVisits.filter(v => v.status === 'Finalizat' || v.status === 'Anulat');
    const pendingIds = new Set(pending.map(v => v.id));

    hydrate(dateStr, pendingIds);
    revalidate(dateStr, pendingIds);

    const savedOrder = orders[dateStr];
    if (!savedOrder) return dayVisits;

    const orderedPending = [...pending].sort((a, b) => {
      const ai = savedOrder.indexOf(a.id);
      const bi = savedOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return [...orderedPending, ...finished];
  }, [orders, hydrate, revalidate]);

  const isOptimized = useCallback((dateStr: string): boolean => {
    return !!orders[dateStr];
  }, [orders]);

  const isOptimizing = useCallback((dateStr: string): boolean => {
    return optimizingSet.has(dateStr);
  }, [optimizingSet]);

  const handleOptimize = useCallback(async (
    dateStr: string,
    dayVisits: Visit[],
    properties: Property[],
    organization?: any
  ) => {
    if (!organizationId) return;
    setOptimizingSet(prev => new Set([...prev, dateStr]));

    try {
      const pending = dayVisits.filter(v => v.status !== 'Finalizat' && v.status !== 'Anulat');
      if (pending.length < 2) return;

      const points: { id: string; lat: number; lng: number }[] = [];
      for (const v of pending) {
        const prop = properties.find(p => p.id === v.propertyId);
        const leadMapsLink = (v as any).leadData?.mapsLink || (v as any).mapsLink;
        const linkSource =
          prop?.mapsLink ||
          v.propertyMapsLink ||
          leadMapsLink ||
          prop?.address ||
          v.propertyAddress ||
          v.clientAddress;

        if (linkSource) {
          const coords = await resolveAndParseMapsLink(linkSource);
          if (coords) points.push({ id: v.id, lat: coords.lat, lng: coords.lng });
        }
      }

      let startCoords: { lat: number; lng: number } | null =
        points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : null;

      if (navigator.geolocation) {
        try {
          const pos: GeolocationPosition = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
          );
          startCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch { /* fallback to first point */ }
      }

      let hqCoords: { lat: number; lng: number } | null = null;
      if (organization) {
        const hqSource = organization.mapsLink || organization.address;
        if (hqSource) {
          try { hqCoords = await resolveAndParseMapsLink(hqSource); } catch {}
        }
      }

      if (startCoords && points.length > 1) {
        const route = optimizeRouteNearestNeighbor(startCoords, points, hqCoords);
        const ordered = route.map(r => r.id);
        const unmapped = pending.filter(v => !ordered.includes(v.id)).map(v => v.id);
        const fullOrder = [...ordered, ...unmapped];

        const stored: StoredRoute = {
          order: fullOrder,
          snapshot: fullOrder,
          savedAt: Date.now(),
        };

        writeLS(organizationId, dateStr, stored);
        setOrders(prev => ({ ...prev, [dateStr]: fullOrder }));
        setSeenDates(prev => new Set([...prev, dateStr]));
      }
    } catch (e) {
      console.error('Route optimization failed', e);
    } finally {
      setOptimizingSet(prev => { const n = new Set(prev); n.delete(dateStr); return n; });
    }
  }, [organizationId]);

  return { getOrderedVisits, isOptimized, isOptimizing, handleOptimize };
}

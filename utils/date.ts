import { parse, isValid, format } from 'date-fns';
import { ro } from 'date-fns/locale';

/**
 * Robustly parses a date string in various formats to a Date object.
 * Preferred format is ISO (yyyy-MM-dd).
 * Also handles d.m.yyyy, d/m/yyyy, and even d.m (defaults to current year).
 */
export const parseSafeDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr || dateStr === 'Fără dată') return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. Try yyyy-MM-dd (ISO)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch.map(Number);
    const date = new Date(y, m - 1, d);
    if (isValid(date)) return date;
  }

  // 2. Try dd.MM.yyyy or dd/MM/yyyy
  const fullMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (fullMatch) {
    const [_, d, m, y] = fullMatch.map(Number);
    const date = new Date(y, m - 1, d);
    if (isValid(date)) return date;
  }

  // 3. Try dd.MM or dd/MM (Assume current year)
  const shortMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (shortMatch) {
    const [_, d, m] = shortMatch.map(Number);
    const date = new Date(currentYear, m - 1, d);
    if (isValid(date)) return date;
  }

  // 4. Try yyyy-MM-dd HH:mm (from Firebase sometimes)
  const dateTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/);
  if (dateTimeMatch) {
      const [_, y, m, d] = dateTimeMatch.map(Number);
      const date = new Date(y, m - 1, d);
      if (isValid(date)) return date;
  }

  // Fallback to standard JS parse
  const parsed = new Date(dateStr);
  if (isValid(parsed)) return parsed;

  return null;
};

export const formatLongDate = (date: Date | null | undefined): string => {
  if (!date || !isValid(date)) return '-';
  try {
    const weekday = format(date, 'EEEEEE', { locale: ro });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${format(date, 'd MMMM yyyy', { locale: ro })}`;
  } catch (e) {
    return '-';
  }
};

export const formatShortDate = (date: Date | null | undefined): string => {
  if (!date || !isValid(date)) return '-';
  try {
    const weekday = format(date, 'EEEEEE', { locale: ro });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${format(date, 'd MMM', { locale: ro })}`;
  } catch (e) {
    return '-';
  }
};

/**
 * Calculează numărul de zile de la ultima vizită finalizată a clientului până în prezent (sau o dată de referință).
 * Dacă nu există nicio vizită finalizată, returnează null.
 */
export const calculateDaysSinceLastVisit = (
  visits: any[],
  clientId: string,
  propertyId?: string,
  excludeVisitId?: string,
  beforeDate?: Date,
  relativeToDate?: Date
): number | null => {
  if (!clientId) return null;

  // Filtrează vizitele finalizate ale clientului
  const completedVisits = visits.filter(v => {
    if (v.clientId !== clientId) return false;
    if (v.status !== 'Finalizat') return false;
    if (excludeVisitId && v.id === excludeVisitId) return false;
    // Acceptă vizitele care au aceeași proprietate sau nu au proprietate definită (legacy)
    if (propertyId && v.propertyId && v.propertyId !== propertyId) return false;
    return true;
  });

  if (completedVisits.length === 0) return null;

  // Sortare după data (string format YYYY-MM-DD)
  const sorted = completedVisits.sort((a, b) => {
    const aDateStr = (a.completedAt?.toDate ? a.completedAt.toDate().toISOString().split('T')[0] : a.data) || '1970-01-01';
    const bDateStr = (b.completedAt?.toDate ? b.completedAt.toDate().toISOString().split('T')[0] : b.data) || '1970-01-01';
    
    const aDate = parseSafeDate(aDateStr);
    const bDate = parseSafeDate(bDateStr);
    
    const aVal = aDate ? aDate.getTime() : 0;
    const bVal = bDate ? bDate.getTime() : 0;
    
    return bVal - aVal;
  });

  let lastVisit = sorted[0];

  // Permite limitarea căutării la vizite anterioare unei anumite date (folositor în Kanban/Agenda)
  if (beforeDate) {
    const filtered = sorted.filter(v => {
      const vDateStr = (v.completedAt?.toDate ? v.completedAt.toDate().toISOString().split('T')[0] : v.data) || null;
      const vDate = parseSafeDate(vDateStr);
      return vDate && vDate.getTime() <= beforeDate.getTime();
    });
    if (filtered.length > 0) {
      lastVisit = filtered[0];
    } else {
      return null;
    }
  }

  if (!lastVisit) return null;

  // Calculăm diferența în zile de la acea vizită până la data de referință (implicit azi, la miezul nopții)
  const targetDate = relativeToDate || new Date();
  const targetDateAtMidnight = new Date(targetDate);
  targetDateAtMidnight.setHours(0, 0, 0, 0);

  const lastDateStr = (lastVisit.completedAt?.toDate ? lastVisit.completedAt.toDate().toISOString().split('T')[0] : lastVisit.data) || null;
  const lastDate = parseSafeDate(lastDateStr);
  if (!lastDate) return null;

  const lastDateAtMidnight = new Date(lastDate);
  lastDateAtMidnight.setHours(0, 0, 0, 0);

  const diffTime = targetDateAtMidnight.getTime() - lastDateAtMidnight.getTime();
  let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) diffDays = 0;

  return diffDays;
};

/**
 * Calculează numărul de zile de la finalizarea unei vizite specifice până în prezent.
 */
export const calculateDaysSinceVisitCompleted = (v: any): number | null => {
  if (!v) return null;
  const dateStr = v.data || (v.completedAt?.toDate ? v.completedAt.toDate().toISOString().split('T')[0] : null);
  const date = parseSafeDate(dateStr);
  if (!date) return null;
  
  const todayAtMidnight = new Date();
  todayAtMidnight.setHours(0, 0, 0, 0);
  
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);
  
  const diffTime = todayAtMidnight.getTime() - dateAtMidnight.getTime();
  let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) diffDays = 0;
  return diffDays;
};



export const formatVisitDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (!dateStr.includes('-')) {
      const d = parseSafeDate(dateStr);
      if (d && !isNaN(d.getTime())) {
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      return dateStr;
  }
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

import { Property } from '../src/types';

export const isIrrigatingToday = (p: Property, date: Date = new Date()) => {
  if (!p.irrigation) return false;
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  const dayOfWeek = checkDate.getDay(); // 0-6 (Sun-Sat)
  
  if (p.irrigation.type === 'days') {
    return p.irrigation.days?.includes(dayOfWeek);
  }
  
  if (p.irrigation.type === 'even_odd') {
    const dayOfMonth = checkDate.getDate();
    const isEven = dayOfMonth % 2 === 0;
    return p.irrigation.evenOdd === 'even' ? isEven : !isEven;
  }
  
  if (p.irrigation.type === 'interval' && p.irrigation.interval && p.irrigation.startDate) {
    const start = new Date(p.irrigation.startDate);
    start.setHours(0, 0, 0, 0);
    const diffTime = checkDate.getTime() - start.getTime();
    if (diffTime < 0) return false; // Start date is in the future
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % p.irrigation.interval === 0;
  }
  
  return false;
};

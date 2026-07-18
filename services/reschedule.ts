import { db, collection, query, where, getDocs, writeBatch, doc, getDoc } from './firebase';
import { formatInTimeZone } from 'date-fns-tz';

const getNextWorkingDay = (date: Date, workDays: string): Date => {
  let target = new Date(date);
  // Ensure we check starting from the given date.
  // If the given date itself is a working day, we return it.
  while (true) {
    const dayOfWeek = target.getDay();
    let isWorkingDay = true;
    if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkingDay = false;
    if (workDays === 'L-S' && dayOfWeek === 0) isWorkingDay = false;

    if (isWorkingDay) return target;
    target.setDate(target.getDate() + 1);
  }
};

export const rescheduleOverdueVisits = async (organizationId: string) => {
  if (!organizationId) return;
  
  try {
    // Fetch organization settings to get workDays
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
    const workDays = orgDoc.data()?.workDays || 'L-S';

    const today = new Date();
    const todayStr = formatInTimeZone(today, 'Europe/Bucharest', 'yyyy-MM-dd');
    
    const targetDate = getNextWorkingDay(today, workDays);
    const targetDateStr = formatInTimeZone(targetDate, 'Europe/Bucharest', 'yyyy-MM-dd');
    
    // 1. Reschedule Visits
    const visitsRef = collection(db, 'visits');
    const qVisits = query(
      visitsRef, 
      where('organizationId', '==', organizationId),
      where('status', 'in', ['Programat', 'Activ'])
    );
    
    const visitsSnap = await getDocs(qVisits);
    
    const batch = writeBatch(db);
    let rescheduledCount = 0;

    visitsSnap.forEach((visitDoc) => {
      const visit = visitDoc.data();
      const visitDate = (visit.data || '').split('T')[0];
      
      if (visitDate && visitDate < todayStr) {
        // Reschedule to the next working day instead of 'todayStr'
        const updatePayload: any = {
          data: targetDateStr,
          originalData: visit.originalData || visitDate // keep track of the first time it was scheduled
        };
        batch.update(visitDoc.ref, updatePayload);
        rescheduledCount++;
      }
    });

    // 2. Reschedule Leads (only if status is 'vizualizat' - "De văzut")
    const leadsRef = collection(db, 'leads');
    const qLeads = query(
      leadsRef,
      where('organizationId', '==', organizationId),
      where('status', '==', 'vizualizat')
    );

    const leadsSnap = await getDocs(qLeads);
    leadsSnap.forEach((leadDoc) => {
      const lead = leadDoc.data();
      const leadDate = (lead.nextActionDate || lead.data || '').split('T')[0];

      if (leadDate && leadDate < todayStr) {
        batch.update(leadDoc.ref, {
          nextActionDate: targetDateStr,
          data: targetDateStr
        });
        rescheduledCount++;
      }
    });

    if (rescheduledCount > 0) {
      await batch.commit();
      console.log(`[RESCHEDULE] Successfully rescheduled ${rescheduledCount} items to ${targetDateStr} for org ${organizationId}.`);
    }
  } catch (err) {
    console.error("[VISITS] Error during client-side visit rescheduling:", err);
  }
};

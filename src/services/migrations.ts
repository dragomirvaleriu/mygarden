import { collection, getDocs, updateDoc, doc, query, where, Firestore } from 'firebase/firestore';

export const runFertilizerMigration = async (organizationId: string, db: Firestore) => {
  try {
    // Scope the query to this organization: reading the whole `visits` collection
    // is rejected by Firestore rules for non-superadmin accounts (each doc read is
    // checked against isMemberOf(resource.data.organizationId)). The JS filter below
    // already keeps only this org's visits, so this is functionally identical.
    const visitsSnap = await getDocs(query(collection(db, 'visits'), where('organizationId', '==', organizationId)));
    const visits = visitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const latestFertilizer: Record<string, { date: string, propertyId?: string, clientId?: string }> = {};

    visits.forEach((v: any) => {
      if (v.organizationId !== organizationId || v.status !== 'Finalizat') return;
      const services = v.servicii_efectuate || [];
      const isFert = services.some((s: any) => {
        const name = (s.name || '').toLowerCase();
        return name.includes('îngrășământ') || name.includes('ingrasamant') || name.includes('fertiliz');
      });

      if (isFert && v.data) {
        const key = v.propertyId ? `prop_${v.propertyId}` : `client_${v.clientId}`;
        if (!latestFertilizer[key] || new Date(v.data).getTime() > new Date(latestFertilizer[key].date).getTime()) {
          latestFertilizer[key] = {
            date: v.data,
            propertyId: v.propertyId,
            clientId: v.clientId
          };
        }
      }
    });

    let count = 0;
    for (const key of Object.keys(latestFertilizer)) {
      const { date, propertyId, clientId } = latestFertilizer[key];
      try {
        if (propertyId) {
          await updateDoc(doc(db, 'properties', propertyId), { lastSolidFertilizerDate: date });
          count++;
        } else if (clientId) {
          await updateDoc(doc(db, 'clients', clientId), { lastSolidFertilizerDate: date });
          count++;
        }
      } catch (e) {
        console.error('Error updating fertilizer date:', e);
      }
    }
    console.log('Fertilizer migration complete, updated:', count);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

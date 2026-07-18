import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const checkFutureVisitExists = async (clientId: string, propertyId: string | null): Promise<boolean> => {
    try {
        const q = query(
            collection(db, 'visits'),
            where('clientId', '==', clientId),
            where('status', 'in', ['Programat', 'Activ'])
        );
        const snap = await getDocs(q);
        
        const exists = snap.docs.some(doc => {
            const data = doc.data();
            const docPropertyId = data.propertyId || null;
            return docPropertyId === propertyId;
        });
        
        return exists;
    } catch (err) {
        console.error("Error checking future visit:", err);
        return false;
    }
};

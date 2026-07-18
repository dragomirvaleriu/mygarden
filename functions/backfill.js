const admin = require('firebase-admin');

// Initialize Firebase Admin (uses application default credentials if available)
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'landscapeos-c3701'
});

const db = admin.firestore();

async function backfillClientFinancials() {
    try {
        const clientsSnap = await db.collection('clients').get();
        const batch = db.batch();
        let updatedCount = 0;

        for (const clientDoc of clientsSnap.docs) {
            const clientId = clientDoc.id;
            const propertiesSnap = await db.collection('properties').where('clientId', '==', clientId).get();
            
            let totalSold = 0;
            let totalTarif = 0;
            let totalSuprafata = 0;
            let ziScadenta = null;
            let dataScadenta = null;
            let contractType = null;
            let maintenanceFrequency = null;

            const clientProps = propertiesSnap.docs.map(doc => doc.data());
            
            const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
            if (hasMaintenance) {
                contractType = 'maintenance';
            } else if (clientProps.length > 0 && clientProps[0].contractType) {
                contractType = clientProps[0].contractType;
            }

            const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
            if (maintProp) {
                maintenanceFrequency = maintProp.maintenanceFrequency;
            } else if (clientProps.length > 0 && clientProps[0].maintenanceFrequency) {
                maintenanceFrequency = clientProps[0].maintenanceFrequency;
            }

            clientProps.forEach(p => {
                totalSold += (p.sold || 0);
                totalTarif += (p.tarifLunar || 0);
                totalSuprafata += (p.surfaceArea || p.suprafataMp || 0);
                
                if ((p.sold || 0) > 0 && p.ziScadenta) {
                    if (!ziScadenta || p.ziScadenta < ziScadenta) {
                        ziScadenta = p.ziScadenta;
                    }
                }

                if (p.dataScadenta) {
                    dataScadenta = p.dataScadenta;
                }
            });

            const updatePayload = {
                sold: totalSold,
                tarifLunar: totalTarif,
                suprafataMp: totalSuprafata,
                propertyCount: clientProps.length,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (contractType) updatePayload.contractType = contractType;
            if (maintenanceFrequency) updatePayload.maintenanceFrequency = maintenanceFrequency;
            if (ziScadenta) updatePayload.ziScadenta = ziScadenta;
            if (dataScadenta) updatePayload.dataScadenta = dataScadenta;

            batch.update(clientDoc.ref, updatePayload);
            updatedCount++;

            if (updatedCount % 450 === 0) {
                await batch.commit();
                console.log(`Committed ${updatedCount} clients`);
            }
        }

        if (updatedCount % 450 !== 0) {
            await batch.commit();
            console.log(`Committed ${updatedCount} clients (final batch)`);
        }

        console.log(`Backfill completed. Processed: ${updatedCount}`);
    } catch (error) {
        console.error('Error during backfill:', error);
    }
}

backfillClientFinancials();

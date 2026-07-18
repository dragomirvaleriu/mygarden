import React, { useState, useEffect } from 'react';
import { logger, LogEntry } from '../services/logger';
import { db, collection, getDocs, limit, query, where } from '../services/firebase';

interface Props {
  organizationId: string;
}

const Logs: React.FC<Props> = ({ organizationId }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testing, setTesting] = useState(false);
  const currentProjectId = "landscapeos-c3701";

  const hasPermissionError = logs.some(l => l.level === 'error' && (l.message.includes('permission-denied') || (l.metadata && l.metadata.code === 'permission-denied')));

  useEffect(() => {
    setLogs(logger.getLogs());
    const unsubscribe = logger.subscribe((newLogs) => setLogs([...newLogs]));
    return unsubscribe;
  }, []);

  const runConnectionTest = async () => {
    setTesting(true);
    logger.log(`Test conexiune către: ${currentProjectId}`, "info");
    try {
      const q = query(collection(db, 'clients'), where('organizationId', '==', organizationId), limit(1));
      const snap = await getDocs(q);
      logger.log(`SUCCES: Am găsit ${snap.docs.length} documente.`, "success");
      alert("Conexiunea funcționează perfect!");
    } catch (err: any) {
      logger.log("Eroare Test", "error", err);
      alert(`Eșec: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-main tracking-tight">System Logs</h2>
          <p className="text-text-secondary text-xs font-bold mt-1">ID Proiect Activat: <span className="text-accent-color">{currentProjectId}</span></p>
        </div>
        <div className="flex gap-4">
          <button onClick={runConnectionTest} className="stihl-button px-4 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">Test Live</button>
          <button onClick={() => logger.clear()} className="bg-bg-main border border-border-color px-4 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:bg-black/5 dark:hover:bg-white/5">Clear</button>
        </div>
      </header>

      {hasPermissionError && (
        <div className="stihl-card border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg p-6">
          <h3 className="text-xl font-black text-red-500 mb-4 uppercase tracking-tight">⚠️ ALERTA DE CONFIGURARE</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 text-sm text-text-secondary">
              <p>Dacă regulile sunt corecte dar eroarea persistă, verifică ID-ul proiectului în URL-ul browserului tău Firebase Console:</p>
              <div className="bg-bg-main p-3 rounded-md border border-border-color font-mono text-accent-color text-xs">
                console.firebase.google.com/project/<span className="bg-accent-color text-white px-1 font-bold rounded-sm">landscapeos-c3701</span>/...
              </div>
              <p className="text-red-500 font-bold">Dacă ID-ul din browser este DIFERIT de cel verde, înseamnă că modifici regulile în PROIECTUL GREȘIT!</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
              <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Reguli de Publicat (Apasa Publish!)</p>
              <pre className="text-[11px] text-green-400 font-mono">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function getOrgId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId;
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && resource.data.organizationId == getOrgId();
    }

    match /organizations/{orgId} {
      allow read: if request.auth != null && getOrgId() == orgId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && getOrgId() == orgId;
    }

    match /{collection}/{docId} {
      allow read, update, delete: if request.auth != null && resource.data.organizationId == getOrgId();
      allow create: if request.auth != null && request.resource.data.organizationId == getOrgId();
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="stihl-card rounded-lg p-4 font-mono text-[11px] h-[50vh] overflow-y-auto bg-gray-900 text-gray-300 border-gray-700 shadow-inner">
        {logs.map((log, i) => (
          <div key={i} className="mb-2 border-b border-gray-800 pb-2 last:border-0">
            <span className="text-gray-500 opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className={`ml-4 font-bold uppercase ${log.level === 'error' ? 'text-red-400' : 'text-green-400'}`}>{log.level}</span>
            <span className="ml-4 text-gray-300">{log.message}</span>
            {log.metadata && <div className="ml-24 text-[11px] text-gray-500 opacity-60">{JSON.stringify(log.metadata)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Logs;
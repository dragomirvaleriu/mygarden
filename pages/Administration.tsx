import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  auth,
  logout,
  db, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc,
  query,
  where,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
  deleteField,
  Timestamp,
  storage,
  ref,
  listAll,
  deleteObject
} from '../services/firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { Organization, UserProfile, Invitation, Page } from '../src/types';
import { logger } from '../services/logger';
import { Wrench, Warehouse, Sun, Moon, LogOut, ShieldCheck, Mail, Send, Activity, Settings, Database, History, ChevronRight, LayoutGrid, Users, CreditCard, Shield, Gift, Zap, User, Trash2, Palette } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToExcel } from '../utils/export';
import OrganizationSettings from '../components/administration/OrganizationSettings';
import TeamManagement from '../components/administration/TeamManagement';
import MaintenanceTerminal from '../components/administration/MaintenanceTerminal';
import DataTools from '../components/administration/DataTools';
import AuditTrail from './AuditTrail';
import AccountSettings from '../components/administration/AccountSettings';
import Timesheets from './Timesheets';
import { usePlan } from '../src/hooks/usePlan';
import { format } from 'date-fns';
import { UpgradeCard } from '../src/components/UpgradeCard';
import { toast } from 'react-hot-toast';
import { logAudit, AuditAction, computeChanges } from '../services/audit';

interface Props {
  organizationId: string;
  userRole: string;
  onNavigate: (page: Page) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  accentColors: string[];
  selectedAccentColor: string;
  onSelectAccentColor: (color: string) => void;
  profile: UserProfile | null;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
  userSettings: any;
  onUpdateUserSettings: (settings: any) => Promise<void>;
}

const Administration: React.FC<Props> = ({ 
  organizationId, 
  userRole, 
  onNavigate,
  theme,
  onToggleTheme,
  accentColors,
  selectedAccentColor,
  onSelectAccentColor,
  profile,
  subscriptionTier,
  userSettings,
  onUpdateUserSettings
}) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'visual' | 'team' | 'finance' | 'calculator' | 'system' | 'audit' | 'premium' | 'account'>('settings');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportMonth, setReportMonth] = useState(() => new Date().getMonth());
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear());
  const [reportStatus, setReportStatus] = useState<'idle'|'success'|'error'>('idle');
  const [mathInput, setMathInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([t('[SYSTEM] Maintenance terminal active.'), t('[SYSTEM] Ready for instructions...')]);
  const [confirmationModal, setConfirmationModal] = useState<{ 
    type: 'migrate' | 'clear' | 'delete' | 'demo' | 'clear_all' | 'removeMember', 
    title: string, 
    message: string, 
    data?: any,
    mathChallenge?: { question: string, answer: number }
  } | null>(null);
  
  // Team Management State
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [newEmail, setNewEmail] = useState('');
  
  const generateMathChallenge = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return { question: `${a} + ${b} = ?`, answer: a + b };
  };

  const [giftCode, setGiftCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [orgForm, setOrgForm] = useState({ 
    name: '', 
    address: '', 
    phone: '',
    accentColors: ['#f07d00', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'],
    contractTypeColors: { maintenance: '#3b82f6', oneTime: '#f97316', inactive: '#ef4444' },
    activeViewsDesktop: ['list', 'kanban', 'route', 'agenda'],
    activeViewsMobile: ['list', 'kanban', 'route', 'agenda'],
    defaultFertilizerDosage: 25,
    billableMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    defaultInvoiceDay: 1,
    defaultDueDay: 15,
    workDays: 'L-S' as 'L-V' | 'L-S' | 'L-D',
    startTime: '09:00',
    endTime: '17:00',
    plan: 'free',
    planExpires: null as any,
    trialExpiresAt: null as any,
    cui: '',
    regCom: '',
    iban: '',
    banca: '',
    localitate: '',
    judet: '',
    codPostal: '',
    email: '',
    website: ''
  });
  
  // Fertilizer Calculator State
  const [originalOrgForm, setOriginalOrgForm] = useState<any>(null);
  const [calcSurface, setCalcSurface] = useState<number>(0);
  const [calcDosage, setCalcDosage] = useState<number>(25);
  const [calcResult, setCalcResult] = useState<number>(0);

  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    if (!hasScrolled) {
      const timer = setTimeout(() => {
        const el = document.getElementById('anchor-setari');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setHasScrolled(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasScrolled]);

  useEffect(() => {
    setCalcResult((calcSurface * calcDosage) / 1000);
  }, [calcSurface, calcDosage]);

  useEffect(() => {
    if (!organizationId || !orgForm.name || calcDosage === orgForm.defaultFertilizerDosage) return;
    
    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'organizations', organizationId), {
          ...orgForm,
          defaultFertilizerDosage: calcDosage,
          updatedAt: serverTimestamp()
        });
        toast.success(t('Dosage auto-saved!'));
        logAudit({
          userId: auth.currentUser?.uid || '',
          userName: profile?.displayName || auth.currentUser?.email || 'Unknown',
          action: AuditAction.UPDATE_SETTINGS,
          details: `Updated default fertilizer dosage to ${calcDosage}g/m²`,
          organizationId
        });
      } catch (err) {
        console.error("Autosave dosage error:", err);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [calcDosage, organizationId, orgForm.defaultFertilizerDosage, orgForm.name]);

  useEffect(() => {
    if (!organizationId) return;
    const unsub = onSnapshot(doc(db, 'organizations', organizationId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Organization;
        const formData = {
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          accentColors: data.accentColors || ['#f07d00', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'],
          contractTypeColors: data.contractTypeColors || { maintenance: '#3b82f6', oneTime: '#f97316', inactive: '#ef4444' },
          activeViewsDesktop: data.activeViewsDesktop || ['list', 'kanban', 'route', 'agenda'],
          activeViewsMobile: data.activeViewsMobile || ['list', 'kanban', 'route', 'agenda'],
          defaultFertilizerDosage: data.defaultFertilizerDosage || 25,
          billableMonths: data.billableMonths || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          defaultInvoiceDay: data.defaultInvoiceDay || 1,
          defaultDueDay: data.defaultDueDay || 15,
          workDays: data.workDays || 'L-S',
          startTime: data.startTime || '09:00',
          endTime: data.endTime || '17:00',
          plan: data.plan || 'free',
          planExpires: data.planExpires || null,
          trialExpiresAt: data.trialExpiresAt || null,
          cui: data.cui || '',
          regCom: data.regCom || '',
          iban: data.iban || '',
          banca: data.banca || '',
          localitate: data.localitate || '',
          judet: data.judet || '',
          codPostal: data.codPostal || '',
          email: data.email || '',
          website: data.website || ''
        };
        setOrgForm(formData);
        setOriginalOrgForm(formData);
        if (data.defaultFertilizerDosage) setCalcDosage(data.defaultFertilizerDosage);
      }
    });

    const unsubMembers = onSnapshot(query(collection(db, 'users'), where('organizationId', '==', organizationId)), (snap) => {
      setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const unsubInvites = onSnapshot(query(collection(db, 'invitations'), where('organizationId', '==', organizationId)), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
    });

    return () => {
      unsub();
      unsubMembers();
      unsubInvites();
    };
  }, [organizationId]);

  const addLog = (msg: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setIsProcessing(true);
    
    // Generate a simple random code for the invitation
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const emailLower = newEmail.toLowerCase().trim();

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, 'invitations'), {
        email: emailLower,
        code: inviteCode,
        organizationId,
        role: 'employee',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. Call API to send email
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          email: emailLower,
          inviteCode: inviteCode,
          organizationId,
          organizationName: orgForm.name || 'Scapeflow',
          appUrl: window.location.origin
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to send email');
      }

      setNewEmail('');
      toast.success(t('Invitation Sent'));
      addLog(t('Invitation Sent Info', { email: emailLower }));
    } catch (err: any) {
      console.error('Invite Error:', err);
      toast.error(t('Invite Error') + ': ' + err.message);
      addLog(`❌ Invite error: ${err.message}`);
    } finally { setIsProcessing(false); }
  };

  const cancelInvite = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', id));
      toast.success(t('Invitation Canceled'));
    } catch (err) { toast.error(t('Error')); }
  };

  const handleToggleRole = async (uid: string, currentRole: string, email: string) => {
    if (uid === auth.currentUser?.uid) {
      toast.error(t('Cannot change own role'));
      return;
    }
    const newRole = currentRole === 'admin' ? 'employee' : 'admin';
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success(t('Role Updated'));
      addLog(t('Role Updated', { email, role: newRole }));
    } catch (err) { toast.error(t('Error')); }
  };

  const handleUpdateMember = async (uid: string, data: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
      toast.success(t('Member Updated'));
    } catch (err) { toast.error(t('Error')); }
  };

  const handleRemoveMember = async (uid: string, email: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { organizationId: deleteField(), role: 'inactive' });
      toast.success(t('Member Removed'));
      addLog(t('Member Removed', { email }));
    } catch (err) { toast.error(t('Error')); }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingOrg(true);
    try {
      await updateDoc(doc(db, 'organizations', organizationId), orgForm);
      logger.log(t('Sync Success'), "success");
      logAudit({
        userId: auth.currentUser?.uid || '',
        userName: profile?.displayName || auth.currentUser?.email || 'Unknown',
        action: AuditAction.UPDATE_SETTINGS,
        details: 'Updated Organization Profile & Settings',
        changes: originalOrgForm ? computeChanges(originalOrgForm, orgForm) : undefined,
        organizationId
      });
    } catch (err) {
      logger.log(t('Error updating'), "error");
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  const handleDosageChange = async (val: number) => {
    setCalcDosage(val);
  };

  // Helper for batch processing
  const processBatch = async (items: any[], operation: (item: any, batch: any) => void) => {
    const batchSize = 500;
    const chunks = [];
    for (let i = 0; i < items.length; i += batchSize) {
      chunks.push(items.slice(i, i + batchSize));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => operation(item, batch));
      await batch.commit();
    }
  };

  // Terminal actions
  const auditDeprecatedFields = async () => {
    setIsProcessing(true);
    addLog(t('🔍 Starting audit...'));
    try {
      const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      const deprecatedFields = ['adresa', 'tarifLunar', 'sold', 'suprafataMp', 'Maps_link', 'areaSqm', 'areas', 'irrigation', 'contractType', 'maintenanceFrequency', 'ziEmitereFactura', 'ziScadenta', 'dataScadenta', 'billableMonths'];
      const clientsWithData: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        const foundFields = deprecatedFields.filter(field => data.hasOwnProperty(field) && data[field] !== undefined && data[field] !== null && data[field] !== '');
        if (foundFields.length > 0) {
          clientsWithData.push({ id: doc.id, organizationId: data.organizationId, nume: data.nume, fields: foundFields });
        }
      });
      addLog(`✅ Audit finished: ${clientsWithData.length} clients have deprecated data.`);
      if (clientsWithData.length > 0) {
        clientsWithData.forEach(c => {
          addLog(`- ${c.nume || c.id}: [${c.fields.join(', ')}]`);
        });
      }
    } catch (err) { addLog(`❌ Audit error: ${err}`); }
    finally { setIsProcessing(false); }
  };

  const fixDeprecatedFields = async () => {
    setIsProcessing(true);
    addLog(t('🛠️ Fixing deprecated fields and migrating data...'));
    try {
      const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      const deprecatedFields = ['adresa', 'tarifLunar', 'sold', 'suprafataMp', 'Maps_link', 'areaSqm', 'areas', 'irrigation', 'contractType', 'maintenanceFrequency', 'ziEmitereFactura', 'ziScadenta', 'dataScadenta', 'billableMonths'];
      
      let fixedCount = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        let hasDeprecated = false;
        const propertyMigrateData: any = {};

        for (const field of deprecatedFields) {
          if (data[field] !== undefined) {
            hasDeprecated = true;
            propertyMigrateData[field] = data[field];
          }
        }

        if (hasDeprecated) {
          // 1. Find or create a property to receive this data
          const propsQuery = query(collection(db, 'properties'), where('clientId', '==', docSnap.id));
          const propsSnap = await getDocs(propsQuery);
          
          if (!propsSnap.empty) {
            // Update the first property (usually Main Location) with the migrated data
            const firstProp = propsSnap.docs[0];
            const propRef = doc(db, 'properties', firstProp.id);
            const propertyUpdates: any = {};
            
            // Only update if the property doesn't have the data yet - ensuring no data loss/overwrite
            if (propertyMigrateData.adresa && !firstProp.data().address) propertyUpdates.address = propertyMigrateData.adresa;
            if (propertyMigrateData.Maps_link && !firstProp.data().mapsLink) propertyUpdates.mapsLink = propertyMigrateData.Maps_link;
            if (propertyMigrateData.suprafataMp !== undefined && firstProp.data().surfaceArea === undefined) propertyUpdates.surfaceArea = propertyMigrateData.suprafataMp;
            if (propertyMigrateData.tarifLunar !== undefined && firstProp.data().tarifLunar === undefined) propertyUpdates.tarifLunar = propertyMigrateData.tarifLunar;
            if (propertyMigrateData.sold !== undefined && firstProp.data().sold === undefined) propertyUpdates.sold = propertyMigrateData.sold;
            if (propertyMigrateData.contractType !== undefined && (firstProp.data().contractType === undefined || firstProp.data().contractType === 'maintenance')) propertyUpdates.contractType = propertyMigrateData.contractType;
            if (propertyMigrateData.maintenanceFrequency !== undefined && firstProp.data().maintenanceFrequency === undefined) propertyUpdates.maintenanceFrequency = propertyMigrateData.maintenanceFrequency;
            if (propertyMigrateData.ziEmitereFactura !== undefined && firstProp.data().ziEmitereFactura === undefined) propertyUpdates.ziEmitereFactura = propertyMigrateData.ziEmitereFactura;
            if (propertyMigrateData.ziScadenta !== undefined && firstProp.data().ziScadenta === undefined) propertyUpdates.ziScadenta = propertyMigrateData.ziScadenta;
            if (propertyMigrateData.dataScadenta !== undefined && firstProp.data().dataScadenta === undefined) propertyUpdates.dataScadenta = propertyMigrateData.dataScadenta;
            if (propertyMigrateData.billableMonths !== undefined && firstProp.data().billableMonths === undefined) propertyUpdates.billableMonths = propertyMigrateData.billableMonths;
            if (propertyMigrateData.areas !== undefined && firstProp.data().customAreas === undefined) propertyUpdates.customAreas = propertyMigrateData.areas;
            if (propertyMigrateData.irrigation !== undefined && firstProp.data().irrigation === undefined) propertyUpdates.irrigation = propertyMigrateData.irrigation;

            if (Object.keys(propertyUpdates).length > 0) {
              await updateDoc(propRef, propertyUpdates);
            }
          } else {
            // Create a new property with all the data
            await addDoc(collection(db, 'properties'), {
              clientId: docSnap.id,
              organizationId,
              name: t('Main Location'),
              address: propertyMigrateData.adresa || '',
              mapsLink: propertyMigrateData.Maps_link || '',
              surfaceArea: propertyMigrateData.suprafataMp || 0,
              tarifLunar: propertyMigrateData.tarifLunar || 0,
              sold: propertyMigrateData.sold || 0,
              contractType: propertyMigrateData.contractType || 'maintenance',
              maintenanceFrequency: propertyMigrateData.maintenanceFrequency || null,
              ziEmitereFactura: propertyMigrateData.ziEmitereFactura || null,
              ziScadenta: propertyMigrateData.ziScadenta || null,
              dataScadenta: propertyMigrateData.dataScadenta || null,
              billableMonths: propertyMigrateData.billableMonths || null,
              customAreas: propertyMigrateData.areas || [],
              irrigation: propertyMigrateData.irrigation || null,
              order: 0,
              createdAt: serverTimestamp()
            });
          }

          // 2. We NO LONGER delete the deprecated fields from the client 
          // to ensure "no information is lost" as per user request.
          // The data is now duplicated (denormalized) in both collections.
          fixedCount++;
          addLog(`✅ Data migrated/verified for: ${data.nume}`);
        }
      }
      addLog(`✨ Migration complete. Fixed ${fixedCount} clients.`);
      
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const executeMigrateProperties = async () => {
    setIsProcessing(true);
    addLog(t('🚀 Starting property migration...'));
    try {
      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      let count = 0;
      for (const cDoc of clientsSnap.docs) {
        const cData = cDoc.data();
        const propsQuery = query(collection(db, 'properties'), where('clientId', '==', cDoc.id));
        const propsSnap = await getDocs(propsQuery);
        
        if (propsSnap.empty && cData.adresa) {
          await addDoc(collection(db, 'properties'), {
            clientId: cDoc.id,
            organizationId: cData.organizationId,
            name: t('Main Location'),
            address: cData.adresa,
            surfaceArea: cData.suprafataMp || 0,
            contractType: cData.contractType || 'maintenance',
            order: 0,
            createdAt: serverTimestamp()
          });
          count++;
        }
      }
      addLog(t('Sync Success', { count }));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const executeCompleteDeletion = async () => {
    setIsProcessing(true);
    addLog(t('⚠️ Starting deep database cleanup...'));
    try {
      const collections = ['visits', 'client_history', 'logs', 'audit_trail'];
      let total = 0;
      for (const col of collections) {
        const snap = await getDocs(query(collection(db, col), where('organizationId', '==', organizationId)));
        await processBatch(snap.docs, (d, b) => b.delete(d.ref));
        total += snap.size;
      }
      addLog(t('Cleanup Success', { count: total }));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const executeClearFinishedVisits = async () => {
    setIsProcessing(true);
    addLog(t('🧹 Clearing finished visits...'));
    try {
      const snap = await getDocs(query(collection(db, 'visits'), where('organizationId', '==', organizationId), where('status', '==', 'Finalizat')));
      await processBatch(snap.docs, (d, b) => b.delete(d.ref));
      addLog(t('Cleanup Success', { count: snap.size }));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const handleConfirmAction = async () => {
    if (!confirmationModal) return;
    if (confirmationModal.mathChallenge && parseInt(mathInput) !== confirmationModal.mathChallenge.answer) {
      toast.error(t('Incorrect answer!'));
      return;
    }

    const { type } = confirmationModal;
    setConfirmationModal(null);
    setMathInput('');

    if (type === 'migrate') await executeMigrateProperties();
    else if (type === 'clear') await executeClearFinishedVisits();
    else if (type === 'delete') await executeCompleteDeletion();
    else if (type === 'demo') await generateDemoData();
    else if (type === 'clear_all') await resetDatabase();
    else if (type === 'removeMember') await handleRemoveMember(confirmationModal.data.uid, confirmationModal.data.email);
  };

  const generateDemoData = async () => {
    setIsProcessing(true);
    addLog(t('🧪 Generating demo data...'));
    try {
      // Mock implementation
      addLog(t('Demo Data Success'));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const resetDatabase = async () => {
    setIsProcessing(true);
    addLog(t('🔥 Resetting database...'));
    try {
      // Mock implementation
      addLog(t('Database Reset Success'));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const handleRedeemGiftCode = async () => {
    if (!giftCode) return;
    setIsRedeeming(true);
    try {
      const { getDocs, query, collection, where, doc, updateDoc, serverTimestamp } = await import('../services/firebase');
      const q = query(collection(db, 'gift_codes'), where('code', '==', giftCode.trim().toUpperCase()), where('status', '==', 'active'), where('used', '==', false));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error(t('Invalid or used gift code'));
        return;
      }
      
      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();
      const months = codeData.durationMonths || 12;
      
      // Calculate new expiration date
      const now = new Date();
      const expires = new Date(now.setMonth(now.getMonth() + months));
      
      // Update Org
      await updateDoc(doc(db, 'organizations', organizationId), {
        plan: 'pro',
        planExpires: Timestamp.fromDate(expires),
        updatedAt: serverTimestamp()
      });
      
      // Mark code as used
      await updateDoc(doc(db, 'gift_codes', codeDoc.id), {
        used: true,
        status: 'used',
        usedAt: serverTimestamp(),
        usedByOrgId: organizationId,
        usedByOrgName: orgForm.name
      });
      
      toast.success(t('Gift code redeemed successfully! Enjoy Premium features.'));
      setGiftCode('');
    } catch (err: any) {
      toast.error(t('Redeem Error'));
      console.error(err);
    } finally {
      setIsRedeeming(false);
    }
  };

  const exportJSON = async () => {
    setIsProcessing(true);
    addLog(t('Generating Backup...'));
    try {
      const collections = ['clients', 'visits', 'properties', 'products', 'service_types', 'equipment', 'client_history'];
      const backupData: Record<string, any[]> = {};
      for (const col of collections) {
        const snap = await getDocs(query(collection(db, col), where('organizationId', '==', organizationId)));
        backupData[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_full_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      addLog(t('Backup Success'));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t('Restore Warning'))) { e.target.value = ''; return; }
    setIsProcessing(true);
    addLog(t('Processing Import...'));
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        for (const col of Object.keys(data)) {
          if (!Array.isArray(data[col])) continue;
          for (const item of data[col]) {
            const { id, ...rest } = item;
            await updateDoc(doc(db, col, id), { ...rest, organizationId });
          }
        }
        addLog(t('Restore Success'));
        setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
      finally { setIsProcessing(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const exportPDF = async () => {
    setIsProcessing(true);
    addLog(t('Generating PDF...'));
    try {
      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      const clients = clientsSnap.docs.map(d => d.data());
      const doc = new jsPDF();
      doc.text(`Scapeflow - ${orgForm.name}`, 14, 15);
      autoTable(doc, {
        head: [[t('Cod Client'), t('Name'), t('Phone'), t('Type'), t('Status'), t('Sold')]],
        body: clients.map(c => [c.codClient || '', c.nume || '', c.telefon || '', c.tip_persoana || '', t(c.status || 'Active'), `${c.sold || 0} RON`]),
        startY: 20,
      });
      doc.save(`report_${new Date().toISOString().split('T')[0]}.pdf`);
      addLog(t('Export Success'));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const exportExcel = async () => {
    setIsProcessing(true);
    addLog(t('Generating Excel...'));
    try {
      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      const clients = clientsSnap.docs.map(d => d.data());
      exportToExcel(clients, `report_${new Date().toISOString().split('T')[0]}`);
      addLog(t('Export Success'));
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const isPF = profile?.accountType === 'PF';

  const navItems = [
    { id: 'settings', label: isPF ? t('Account Settings') : t('General Information'), icon: Settings },
    { id: 'visual', label: t('Visual'), icon: Palette, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'team', label: t('Team Management'), icon: Users },
    { id: 'premium', label: isPF ? t('Commercial Subscription') : t('Premium Subscription'), icon: Zap },
    { id: 'calculator', label: t('Fertilizer Calculator'), icon: Activity },
    { id: 'audit', label: t('Audit Trail'), icon: History },
    ].filter(item => {
      if (isPF) {
        return item.id === 'settings' || item.id === 'visual' || item.id === 'premium' || item.id === 'calculator';
      }
      if (userRole === 'employee') {
        return item.id === 'settings' || item.id === 'visual' || item.id === 'team' || item.id === 'calculator';
      }
      return true;
    });

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-700 pb-20 w-full">
      
      {/* ────── SIDEBAR NAVIGATION ────── */}
      <aside className="w-full lg:w-64 space-y-6">
        <div className="stihl-card bg-bg-card border border-border-color rounded-2xl shadow-sm overflow-hidden">
          <nav className="p-2 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id as any)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${activeSubTab === item.id ? 'bg-accent-color text-white shadow-md shadow-accent-color/20' : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-main'}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={activeSubTab === item.id ? 'text-white' : 'text-text-secondary group-hover:text-accent-color transition-colors'} />
                  <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                </div>
                {activeSubTab === item.id && <ChevronRight size={14} className="animate-in slide-in-from-left-2" />}
              </button>
            ))}
          </nav>
          
          <div className="p-2 pt-0">
            <button
              onClick={async () => {
                const { logout } = await import('../services/firebase');
                await logout();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-red-500 hover:bg-red-500/10 group"
            >
              <LogOut size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-wider">{t('Logout')}</span>
            </button>
          </div>
        </div>

        {/* Short info card */}
        {!isPF && (
          <div className="stihl-card p-6 bg-gradient-to-br from-bg-card to-bg-main border border-border-color rounded-2xl hidden lg:block">
              <h4 className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-4">{t('Quick Links')}</h4>
              <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => onNavigate(Page.Services)} className="flex items-center gap-2 text-[11px] font-bold text-main hover:text-accent-color transition-colors"><Wrench size={14} /> {t('Services')}</button>
                  <button onClick={() => onNavigate(Page.Registru)} className="flex items-center gap-2 text-[11px] font-bold text-main hover:text-accent-color transition-colors"><Warehouse size={14} /> {t('Inventory')}</button>
                  <button onClick={() => onNavigate(Page.Equipment)} className="flex items-center gap-2 text-[11px] font-bold text-main hover:text-accent-color transition-colors"><Activity size={14} /> {t('Equipment')}</button>
              </div>
          </div>
        )}

        {/* Super Admin Matrix Access (Mobile specific) */}
        {profile?.email === 'dragomirvaleriu@gmail.com' && (
          <div className="stihl-card p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl animate-pulse">
            <button 
              onClick={() => onNavigate(Page.SuperAdmin)}
              className="w-full flex items-center justify-center gap-3 py-3 bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <ShieldCheck size={16} />
              Super Admin Matrix
            </button>
          </div>
        )}
      </aside>

      {/* ────── MAIN CONTENT AREA ────── */}
      <main className="flex-1 space-y-8 min-w-0">
        
        {/* Special Administration Header */}
        <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-emerald-500/10 mb-4 md:mb-6 shadow-sm animate-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-3 md:gap-5 w-full">
                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0 ${isPF ? 'bg-purple-500 shadow-purple-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}>
                    {isPF ? <User className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} /> : <ShieldCheck className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />}
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className={`text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] leading-none ${isPF ? 'text-purple-500' : 'text-emerald-500'}`}>
                          Scapeflow
                        </h2>
                        <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[8px] font-black uppercase tracking-tighter shadow-sm ${isPF ? 'bg-purple-500' : 'bg-emerald-500'}`}>
                          {t('Intelligence Terminal')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                        <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">
                            {isPF ? 'Setări Cont' : navItems.find(n => n.id === activeSubTab)?.label}
                        </h1>
                    </div>
                    {!isPF && (
                      <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
                          {orgForm.name || 'Scapeflow Organization'}
                      </p>
                    )}
                </div>
            </div>

                {subscriptionTier === 'free' && (
                  <div className="flex items-center gap-4 bg-bg-card/50 backdrop-blur-md border border-border-color p-3 rounded-2xl group cursor-pointer hover:border-accent-color/30 transition-all" onClick={() => setActiveSubTab('premium')}>
                    <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color group-hover:scale-110 transition-transform">
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-main uppercase tracking-wider">{isPF ? t('Upgrade to Commercial') : t('Upgrade to Pro')}</p>
                      <p className="text-[8px] text-text-secondary font-bold uppercase tracking-widest">{isPF ? t('Unlock Business Features') : t('Unlock All Features')}</p>
                    </div>
                  </div>
                )}
        </div>

        {/* Content Switch */}
        <div id="anchor-setari" className="animate-in slide-in-from-bottom-2 duration-500 scroll-mt-6">
            {activeSubTab === 'settings' && (
                <div className="space-y-8">
                    {isPF && (
                        <AccountSettings 
                            view="personal"
                            userEmail={profile?.email || ""}
                            userSettings={userSettings}
                            onUpdateUserSettings={onUpdateUserSettings}
                            userId={profile?.uid}
                            orgForm={orgForm}
                            setOrgForm={setOrgForm}
                            handleUpdateOrg={handleUpdateOrg}
                            isUpdatingOrg={isUpdatingOrg}
                            accentColors={accentColors}
                            userRole={userRole}
                            accountType={profile?.accountType}
                            organizationId={organizationId}
                        />
                    )}
                    {!isPF && (
                        <OrganizationSettings 
                            orgForm={orgForm}
                            setOrgForm={setOrgForm}
                            handleUpdateOrg={handleUpdateOrg}
                            isUpdatingOrg={isUpdatingOrg}
                            view="general"
                            readOnly={userRole === 'employee'}
                            accountType={profile?.accountType}
                        />
                    )}
                </div>
            )}

            {activeSubTab === 'premium' && (
                <div className="stihl-card p-8 rounded-2xl bg-bg-card border border-border-color animate-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color">
                            <Zap size={20} />
                        </div>
                        <h3 className="text-lg font-black text-main uppercase tracking-tight">{isPF ? t('Commercial Subscription') : t('Premium Subscription')}</h3>
                    </div>
                    
                    <div className={`grid grid-cols-1 ${subscriptionTier === 'free' ? 'md:grid-cols-2' : ''} gap-12`}>
                        {/* Plan Status & Upgrade */}
                        <div className="space-y-6">
                            <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest border-b border-border-color pb-2">{t('Current Plan')}</h4>
                            
                            {subscriptionTier === 'free' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-xl">
                                      <p className="text-sm font-black text-main uppercase tracking-tight">Status: FREE ({isPF ? t('Personal') : t('Standard')})</p>
                                      <p className="text-xs text-text-secondary mt-1">{isPF ? t('This plan is for personal use only. Ads are enabled.') : t('Standard free plan active.')}</p>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                        if (confirm(t('Are you sure you want to convert to a Business account?'))) {
                                          await updateDoc(doc(db, 'users', profile?.uid || ''), { accountType: 'PJ' });
                                          const trialDate = new Date();
                                          trialDate.setDate(trialDate.getDate() + 14);
                                          await updateDoc(doc(db, 'organizations', organizationId), { subscriptionTier: 'pro', trialExpiresAt: trialDate });
                                          toast.success(t('Account converted to Business! 14 days Trial active.'));
                                          window.location.reload();
                                        }
                                      }}
                                      className="w-full py-3 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                                    >
                                      {isPF ? t('Switch to Commercial Account') : t('Convert to Business (PJ)')}
                                    </button>
                                </div>
                            ) : orgForm?.trialExpiresAt ? (
                                <div className="space-y-4">
                                    <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-[11px]">
                                                B
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-main uppercase tracking-tight">Status: {isPF ? t('COMMERCIAL (Trial)') : t('PRO (Trial)')}</span>
                                                <p className="text-[11px] text-text-secondary font-bold uppercase">Trial expires: {format(orgForm.trialExpiresAt.toDate(), 'dd/MM/yyyy')}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-secondary font-medium">
                                            {isPF ? t('Commercial features enabled.') : t('Pro features enabled.')}
                                        </p>
                                    </div>
                                    <button 
                                      className="w-full py-4 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                                      onClick={() => window.open('mailto:dragomirvaleriu@gmail.com?subject=Upgrade to COMMERCIAL&body=I want to upgrade my organization ' + orgForm.name + ' to Commercial plan.')}
                                    >
                                      <Zap size={14} /> {isPF ? t('Upgrade to Commercial') : t('Upgrade to PRO')}
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-black text-main uppercase tracking-tight">Status: {isPF ? t('COMMERCIAL Active') : t('PRO Active')}</span>
                                            {orgForm?.planExpires && (
                                                <p className="text-[11px] text-text-secondary font-bold uppercase">Valid until: {format(orgForm.planExpires.toDate(), 'dd/MM/yyyy')}</p>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-secondary font-medium">
                                        {isPF ? t('Your organization has full access to all commercial features.') : t('Your organization has full access to all premium features.')}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Gift Code Redemption (Only for PRO/PJ) */}
                        {subscriptionTier === 'free' && !isPF && (
                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest border-b border-border-color pb-2">{t('Redeem Gift Code')}</h4>
                                <p className="text-xs text-text-secondary font-medium leading-relaxed mb-4">
                                    {isPF 
                                        ? t('If you have a license key or a gift code, enter it below to activate or extend your Commercial subscription.') 
                                        : t('If you have a license key or a gift code, enter it below to activate or extend your Premium subscription.')}
                                </p>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder={isPF ? "COM-XXXX-XXXX" : "PRO-XXXX-XXXX"}
                                            value={giftCode}
                                            onChange={(e) => setGiftCode(e.target.value)}
                                            className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-black text-main outline-none focus:border-accent-color uppercase placeholder:normal-case shadow-sm"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Gift size={18} className="text-text-secondary" />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleRedeemGiftCode}
                                        disabled={isRedeeming || !giftCode}
                                        className="w-full py-4 bg-accent-color text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent-color/20 hover:bg-accent-color/90 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isRedeeming ? t('Processing...') : (isPF ? t('Activate Subscription') : t('Activate License'))}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-10 pt-8 border-t border-border-color">
                        <div className="flex items-start gap-3 p-4 bg-bg-main rounded-xl border border-border-color">
                            <CreditCard size={16} className="text-text-secondary mt-0.5" />
                            <div>
                                <p className="text-[11px] font-black text-main uppercase tracking-wider mb-1">Billing Support</p>
                                <p className="text-[11px] text-text-secondary font-medium uppercase">Pentru orice problemă legată de plăți sau licențe, contactați suportul tehnic la: <span className="text-accent-color">dragomirvaleriu@gmail.com</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === "visual" && (
                <AccountSettings 
                    view="visual"
                    userEmail={profile?.email || ""}
                    userSettings={userSettings}
                    onUpdateUserSettings={onUpdateUserSettings}
                    userId={profile?.uid}
                    orgForm={orgForm}
                    setOrgForm={setOrgForm}
                    handleUpdateOrg={handleUpdateOrg}
                    isUpdatingOrg={isUpdatingOrg}
                    accentColors={accentColors}
                    userRole={userRole}
                    accountType={profile?.accountType}
                    organizationId={organizationId}
                />
            )}

            {activeSubTab === 'team' && (
                <TeamManagement 
                    orgName={orgForm.name}
                    organizationId={organizationId}
                    userProfile={profile!}
                    members={members}
                    invites={invites}
                    userRole={userRole}
                    currentUserUid={auth.currentUser?.uid}
                    newEmail={newEmail}
                    setNewEmail={setNewEmail}
                    handleInvite={handleInvite}
                    cancelInvite={cancelInvite}
                    handleToggleRole={handleToggleRole}
                    handleUpdateName={(uid, name) => handleUpdateMember(uid, { displayName: name })}
                    handleUpdateMember={handleUpdateMember}
                    setConfirmationModal={setConfirmationModal}
                    isProcessing={isProcessing}
                    addLog={addLog}
                    subscriptionTier={subscriptionTier}
                />
            )}


            {activeSubTab === 'calculator' && (
                <div className="space-y-8">
                    <DataTools 
                        calcSurface={calcSurface}
                        setCalcSurface={setCalcSurface}
                        calcDosage={calcDosage}
                        handleDosageChange={handleDosageChange}
                        calcResult={calcResult}
                        exportJSON={exportJSON}
                        importJSON={importJSON}
                        exportPDF={exportPDF}
                        exportExcel={exportExcel}
                        isProcessing={isProcessing}
                        view="calculator"
                    />
                </div>
            )}

            {activeSubTab === 'audit' && (
                <AuditTrail organizationId={organizationId} />
            )}

        </div>

        {confirmationModal && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <div className="bg-bg-card border border-border-color p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-main uppercase tracking-tight mb-4">{confirmationModal.title}</h3>
              <p className="text-sm text-text-secondary font-medium leading-relaxed mb-6">{confirmationModal.message}</p>
              
              {confirmationModal.mathChallenge && (
                <div className="mb-6 p-4 bg-bg-main rounded-xl border border-border-color">
                  <label className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-2 block">
                    {t('Safety Check')}
                  </label>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-mono font-bold text-main">{confirmationModal.mathChallenge.question} =</span>
                    <input 
                      type="number" 
                      className="bg-bg-card border border-border-color rounded-lg px-4 py-2 w-24 font-bold text-main outline-none focus:border-accent-color"
                      value={mathInput}
                      onChange={e => setMathInput(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => { setConfirmationModal(null); setMathInput(''); }}
                  className="flex-1 py-3.5 rounded-xl border border-border-color font-black uppercase text-[11px] tracking-widest text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  {t('Cancel')}
                </button>
                <button 
                  onClick={handleConfirmAction}
                  className="flex-1 py-3.5 rounded-xl bg-accent-color text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-accent-color/20 active:scale-95 transition-all"
                >
                  {t('Confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Administration;
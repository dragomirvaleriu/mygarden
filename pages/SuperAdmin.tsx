import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { db, collection, onSnapshot, query, where, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc, handleFirestoreError, OperationType } from '../services/firebase';
import { Organization, UserProfile } from '../src/types';
import { Users, Building2, ShieldCheck, Activity, Search, ExternalLink, ShieldAlert, Zap, Globe, Package, CreditCard, Copy, Check, Loader2, Star, Shield, Database, ChevronLeft, ChevronRight, Columns, Settings2, Filter, MoreVertical, Calendar, X, ArrowUp, ArrowDown, ArrowUpDown, Trash2, AlertTriangle, Plus, Mail, Send } from 'lucide-react';
import MaintenanceTerminal from '../components/administration/MaintenanceTerminal';
import { format, addDays } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { Timestamp } from '../services/firebase';
import { monthlyGuide } from '../src/data/monthlyGuide';

interface Props {
  profile?: UserProfile;
}

const SuperAdminPage: React.FC<Props> = ({ profile }) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'ro' ? ro : enUS;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Gift Code State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [codeDuration, setCodeDuration] = useState<3 | 6 | 12>(12);
  const [codeQuantity, setCodeQuantity] = useState<number>(1);
  const [recentCodes, setRecentCodes] = useState<any[]>([]);
  
  // System Config State
  const [config, setConfig] = useState<any>({ maintenanceMode: false, announcement: '', adsConfig: { sidebar: true, main: true }, gardenGuide: null });
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [tempAnnouncement, setTempAnnouncement] = useState('');

  // Email Campaign State
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignTarget, setCampaignTarget] = useState('all');
  const [campaignTestEmail, setCampaignTestEmail] = useState('');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignProgress, setCampaignProgress] = useState<{sent: number, total: number, status: string} | null>(null);

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  
  // Garden Guide Editor State
  const [showGuideEditor, setShowGuideEditor] = useState(false);
  const [editingGuide, setEditingGuide] = useState<any[]>([]);
  const [selectedGuideMonth, setSelectedGuideMonth] = useState<number>(0);
  
  // Ads Editor State
  const [showAdsEditor, setShowAdsEditor] = useState(false);
  const [editingAds, setEditingAds] = useState<any[]>([]);
  
  // Technical Tools State
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([t('[SYSTEM] Maintenance terminal active.'), t('[SYSTEM] Ready for instructions...')]);

  // Table Enhancements State
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('sa_current_page');
    return saved ? Number(saved) : 1;
  });
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('sa_items_per_page');
    return saved ? Number(saved) : 10;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['organization', 'admin', 'stats', 'plan', 'createdAt', 'expiration', 'actions']);
  const [accessModal, setAccessModal] = useState<{ isOpen: boolean, orgId: string, orgName: string, selectedPlan?: string }>({ isOpen: false, orgId: '', orgName: '' });
  const [expiryDate, setExpiryDate] = useState<string>(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, orgId: string, orgName: string }>({ isOpen: false, orgId: '', orgName: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>(() => {
    const savedProfile = (profile as any)?.saSortConfig;
    if (savedProfile) return savedProfile;
    const savedLocal = localStorage.getItem('sa_sort_config');
    return savedLocal ? JSON.parse(savedLocal) : { key: 'createdAt', direction: 'desc' };
  });

  useEffect(() => {
    localStorage.setItem('sa_current_page', currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('sa_items_per_page', itemsPerPage.toString());
  }, [itemsPerPage]);

  const COLUMNS = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'admin', label: 'Administrator', icon: Users },
    { id: 'stats', label: 'Stats (U/C/P)', icon: Activity },
    { id: 'plan', label: 'Plan Status', icon: Zap },
    { id: 'expiration', label: 'Expiration', icon: Calendar },
    { id: 'createdAt', label: 'Data Creării', icon: Calendar },
    { id: 'actions', label: 'Actions', icon: Settings2 },
  ];

  useEffect(() => {
    const qOrg = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'));
    const unsubOrg = onSnapshot(qOrg, (snap) => {
      setOrganizations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    });

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setAllClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubProperties = onSnapshot(collection(db, 'properties'), (snap) => {
      setAllProperties(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const today = new Date().toISOString().split('T')[0];
    const qVisitsToday = query(collection(db, 'visits'), where('data', '==', today));
    const unsubVisits = onSnapshot(qVisitsToday, (snap) => {
      setAllVisits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qCodes = query(collection(db, 'gift_codes'), orderBy('createdAt', 'desc'), limit(20));
    const unsubCodes = onSnapshot(qCodes, (snap) => {
      setRecentCodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching gift codes:", error);
      toast.error("You don't have permission to read gift codes. Update Firestore Rules.");
    });

    const unsubConfig = onSnapshot(doc(db, 'system_config', 'global'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data());
      }
    });

    return () => {
      unsubOrg();
      unsubUsers();
      unsubCodes();
      unsubConfig();
      unsubClients();
      unsubProperties();
      unsubVisits();
    };
  }, []);

  useEffect(() => {
    if (!activeCampaignId) return;
    const unsub = onSnapshot(doc(db, 'campaigns', activeCampaignId), (snap) => {
      if (snap.exists()) {
         const data = snap.data();
         setCampaignProgress({
            sent: data.sentCount || 0,
            total: data.totalCount || 0,
            status: data.status || 'starting'
         });
         if (data.status === 'completed' || data.status === 'failed') {
            setIsSendingCampaign(false);
            if (data.status === 'completed') toast.success(t('Campaign completed successfully'));
            else toast.error(t('Campaign failed'));
         }
      }
    });
    return () => unsub();
  }, [activeCampaignId, t]);

  useEffect(() => {
    if ((profile as any)?.saSortConfig) {
      setSortConfig((profile as any).saSortConfig);
    }
  }, [profile]);

  const handleSendCampaign = async () => {
    if (!campaignSubject || !campaignMessage) {
       toast.error(t('Subject and Message are required'));
       return;
    }
    const confirmMsg = t('Are you sure you want to send this mass email?');
    if (!window.confirm(confirmMsg)) return;

    setIsSendingCampaign(true);
    setCampaignProgress(null);
    try {
       const token = await (profile as any)?.auth?.currentUser?.getIdToken(); 
       const { auth } = await import('../services/firebase');
       const idToken = await auth.currentUser?.getIdToken();
       
       const response = await fetch('/api/campaigns/send', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${idToken}`
         },
         body: JSON.stringify({
           subject: campaignSubject,
           message: campaignMessage,
           target: campaignTarget,
           testEmailOnly: campaignTestEmail || null
         })
       });

       const data = await response.json();
       if (!response.ok) throw new Error(data.error || 'Failed to send campaign');
       
       setActiveCampaignId(data.campaignId);
       toast.success(t('Campaign started successfully'));
       
       if (!campaignTestEmail) {
          setCampaignSubject('');
          setCampaignMessage('');
       }
    } catch (err: any) {
       console.error(err);
       toast.error(err.message || t('Error starting campaign'));
       setIsSendingCampaign(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setGeneratedCodes([]);
    try {
      const newCodes: string[] = [];
      for (let i = 0; i < codeQuantity; i++) {
        const code = `PRO-${codeDuration}M-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await addDoc(collection(db, 'gift_codes'), {
          code,
          durationMonths: codeDuration,
          status: 'active',
          createdAt: serverTimestamp(),
          type: 'PRO_LICENSE',
          used: false
        });
        newCodes.push(code);
      }
      setGeneratedCodes(newCodes);
      toast.success(`Successfully generated ${codeQuantity} codes!`);
    } catch (error: any) {
      console.error("Error generating codes:", error);
      toast.error(`Failed to generate codes: ${error.message}`);
      handleFirestoreError(error, OperationType.WRITE, 'gift_codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLifetime = async (orgId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        isLifetime: !currentStatus,
        plan: !currentStatus ? 'pro' : 'free'
      });
    } catch (error) {
      console.error("Error toggling lifetime:", error);
    }
  };

  const toggleMaintenance = async () => {
    if (config.maintenanceMode) {
      // Turn off directly
      try {
        await updateDoc(doc(db, 'system_config', 'global'), {
          maintenanceMode: false,
          maintenanceUntil: null
        });
      } catch (error) {
        console.error("Error disabling maintenance:", error);
      }
    } else {
      // Show modal to pick duration
      setShowMaintenanceModal(true);
    }
  };

  const activateMaintenance = async (hours: number | null) => {
    try {
      const { Timestamp } = await import('../services/firebase');
      let maintenanceUntil = null;
      if (hours !== null) {
        const date = new Date();
        date.setHours(date.getHours() + hours);
        maintenanceUntil = Timestamp.fromDate(date);
      }

      await updateDoc(doc(db, 'system_config', 'global'), {
        maintenanceMode: true,
        maintenanceUntil
      });
      setShowMaintenanceModal(false);
      toast.success(hours ? `Maintenance active for ${hours} hours` : "Maintenance active indefinitely");
    } catch (error) {
      const { setDoc } = await import('../services/firebase');
      await setDoc(doc(db, 'system_config', 'global'), {
        maintenanceMode: true,
        maintenanceUntil: null,
        announcement: ''
      });
      setShowMaintenanceModal(false);
    }
  };

  const saveAnnouncement = async (messageOverride?: string) => {
    try {
      const message = typeof messageOverride === 'string' ? messageOverride : tempAnnouncement;
      await updateDoc(doc(db, 'system_config', 'global'), {
        announcement: message
      });
      setShowAnnouncementModal(false);
      toast.success(message ? "Announcement published" : "Announcement removed");
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast.error("Failed to save announcement");
    }
  };

  const toggleAd = async (type: 'sidebar' | 'main') => {
    try {
      const currentAdsConfig = config.adsConfig || { sidebar: true, main: true };
      await updateDoc(doc(db, 'system_config', 'global'), {
        [`adsConfig.${type}`]: !currentAdsConfig[type]
      });
      toast.success(`${type} ads ${!currentAdsConfig[type] ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Error toggling ads:", error);
      toast.error("Failed to toggle ads");
    }
  };

  const handleOpenGuideEditor = () => {
    setEditingGuide(config.gardenGuide || monthlyGuide);
    setSelectedGuideMonth(new Date().getMonth());
    setShowGuideEditor(true);
  };

  const handleSaveGuide = async () => {
    try {
      await updateDoc(doc(db, 'system_config', 'global'), {
        gardenGuide: editingGuide
      });
      toast.success("Garden Guide updated globally");
      setShowGuideEditor(false);
    } catch (error) {
      console.error("Error saving guide:", error);
      toast.error("Failed to save Garden Guide");
    }
  };

  const handleOpenAdsEditor = () => {
    setEditingAds(config.adsConfig?.ads || [
      {
        id: Date.now().toString(),
        title: 'Boost Your Garden with Premium Seeds!',
        description: 'Get 20% off on your first order at pentrugazon.ro with code LANDSCAPE20',
        shortDescription: '20% OFF @ pentrugazon.ro',
        buttonText: 'Shop Now',
        url: 'https://pentrugazon.ro',
      }
    ]);
    setShowAdsEditor(true);
  };

  const handleSaveAds = async () => {
    try {
      await updateDoc(doc(db, 'system_config', 'global'), {
        'adsConfig.ads': editingAds
      });
      toast.success("Ads updated globally");
      setShowAdsEditor(false);
    } catch (error) {
      console.error("Error saving ads:", error);
      toast.error("Failed to save Ads");
    }
  };

  const addAd = () => {
    setEditingAds([...editingAds, { 
      id: Date.now().toString(), 
      title: 'New Ad Title', 
      description: 'Ad Description', 
      shortDescription: 'Short sidebar desc', 
      buttonText: 'Click Here', 
      url: 'https://example.com'
    }]);
  };

  const updateGuideTask = (monthIndex: number, taskIndex: number, newValue: string) => {
    const newGuide = [...editingGuide];
    if (typeof newGuide[monthIndex].tasks[taskIndex] === 'string') {
        newGuide[monthIndex].tasks[taskIndex] = { id: Date.now().toString() + taskIndex, title: newValue, category: 'other', important: false };
    } else {
        newGuide[monthIndex].tasks[taskIndex] = { ...newGuide[monthIndex].tasks[taskIndex], title: newValue };
    }
    setEditingGuide(newGuide);
  };

  const addGuideTask = (monthIndex: number) => {
    const newGuide = [...editingGuide];
    newGuide[monthIndex].tasks.push({ id: Date.now().toString(), title: '', category: 'other', important: false });
    setEditingGuide(newGuide);
  };

  const removeGuideTask = (monthIndex: number, taskIndex: number) => {
    const newGuide = [...editingGuide];
    newGuide[monthIndex].tasks.splice(taskIndex, 1);
    setEditingGuide(newGuide);
  };

  const filteredOrgs = useMemo(() => {
    if (!organizations) return [];
    if (!searchTerm.trim()) return organizations;
    
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
    
    return organizations.filter(org => {
      const admin = (users || []).find(u => u.uid === org.adminUid);
      const searchableText = [
        org.name,
        org.id,
        admin?.displayName || '',
        admin?.email || '',
        admin?.phoneNumber || '',
        org.plan || 'free'
      ].join(' ').toLowerCase();

      // Intelligent search: all words in the search term must be present in any field
      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [organizations, searchTerm, users]);

  const handleGrantPro = async () => {
    if (!accessModal.orgId) return;
    setIsUpdatingAccess(true);
    try {
      const expirationDate = new Date(expiryDate);
      expirationDate.setHours(23, 59, 59, 999);
      
      const selectedPlan = (accessModal as any).selectedPlan || 'pro';
      
      await updateDoc(doc(db, 'organizations', accessModal.orgId), {
        plan: selectedPlan,
        planExpires: Timestamp.fromDate(expirationDate),
        isLifetime: false
      });
      
      toast.success(`${selectedPlan.toUpperCase()} access granted to ${accessModal.orgName} until ${format(expirationDate, 'dd MMM yyyy')}`);
      setAccessModal({ isOpen: false, orgId: '', orgName: '' });
    } catch (error) {
      console.error("Error granting access:", error);
      toast.error("Failed to grant access");
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!deleteModal.orgId) return;
    setIsDeleting(true);
    try {
      const { deleteDoc, doc, collection, query, where, getDocs, writeBatch } = await import('../services/firebase');
      
      // 1. Find all users belonging to this organization
      const usersQuery = query(collection(db, 'users'), where('organizationId', '==', deleteModal.orgId));
      const usersSnap = await getDocs(usersQuery);
      
      // 2. Delete users using a batch for efficiency
      const batch = writeBatch(db);
      usersSnap.docs.forEach(uDoc => {
        batch.delete(uDoc.ref);
      });
      
      // 3. Delete the organization document
      batch.delete(doc(db, 'organizations', deleteModal.orgId));
      
      await batch.commit();
      
      toast.success(`Organization and ${usersSnap.size} users deleted successfully`);
      setDeleteModal({ isOpen: false, orgId: '', orgName: '' });
    } catch (error: any) {
      console.error("Error deleting organization:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = async (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newConfig = { key, direction };
    setSortConfig(newConfig);
    localStorage.setItem('sa_sort_config', JSON.stringify(newConfig));
    
    if (profile?.uid) {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          saSortConfig: newConfig
        });
      } catch (err) {
        console.error("Error saving sort config:", err);
      }
    }
  };

  const sortedOrgs = useMemo(() => {
    return [...filteredOrgs].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      
      switch (sortConfig.key) {
        case 'organization':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'admin':
          const adminA = (users || []).find(u => u.uid === a.adminUid);
          const adminB = (users || []).find(u => u.uid === b.adminUid);
          aVal = adminA?.displayName?.toLowerCase() || adminA?.email?.toLowerCase() || '';
          bVal = adminB?.displayName?.toLowerCase() || adminB?.email?.toLowerCase() || '';
          break;
        case 'plan':
          aVal = a.plan || 'free';
          bVal = b.plan || 'free';
          break;
        case 'expiration':
          aVal = a.planExpires?.toMillis?.() || a.planExpires?.seconds || 0;
          bVal = b.planExpires?.toMillis?.() || b.planExpires?.seconds || 0;
          break;
        case 'createdAt':
          aVal = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
          bVal = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
          break;
        default:
          // Fallback
          aVal = (a as any).createdAt?.toMillis?.() || 0;
          bVal = (b as any).createdAt?.toMillis?.() || 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrgs, sortConfig, users]);

  // Pagination Logic
  const totalPages = useMemo(() => Math.ceil(sortedOrgs.length / itemsPerPage), [sortedOrgs, itemsPerPage]);
  const paginatedOrgs = useMemo(() => sortedOrgs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [sortedOrgs, currentPage, itemsPerPage]);

  const toggleColumn = (columnId: string) => {
    if (columnId === 'organization' || columnId === 'actions') return; // Always visible
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };
  
  const addLog = (msg: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  };

  const auditDeprecatedFields = async () => {
    if (!selectedOrgId) { toast.error("Select an organization first"); return; }
    setIsProcessing(true);
    addLog(`🔍 Starting audit for ${selectedOrgId}...`);
    try {
      const { getDocs, query, collection, where } = await import('../services/firebase');
      const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', selectedOrgId)));
      const deprecatedFields = ['adresa', 'tarifLunar', 'sold', 'suprafataMp', 'Maps_link', 'areaSqm', 'areas', 'irrigation', 'contractType', 'maintenanceFrequency', 'ziEmitereFactura', 'ziScadenta', 'dataScadenta', 'billableMonths'];
      const clientsWithData: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        const foundFields = deprecatedFields.filter(field => data.hasOwnProperty(field) && data[field] !== undefined && data[field] !== null && data[field] !== '');
        if (foundFields.length > 0) {
          clientsWithData.push({ id: doc.id, nume: data.nume, fields: foundFields });
        }
      });
      addLog(`✅ Audit finished: ${clientsWithData.length} clients have deprecated data.`);
      if (clientsWithData.length > 0) {
        clientsWithData.forEach(c => addLog(`- ${c.nume || c.id}: [${c.fields.join(', ')}]`));
      }
    } catch (err: any) { addLog(`❌ Audit error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const fixDeprecatedFields = async () => {
    if (!selectedOrgId) { toast.error("Select an organization first"); return; }
    setIsProcessing(true);
    addLog(`🛠️ Fixing deprecated fields for ${selectedOrgId}...`);
    try {
      const { getDocs, query, collection, where, doc, updateDoc, addDoc, serverTimestamp } = await import('../services/firebase');
      const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', selectedOrgId)));
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
          const propsSnap = await getDocs(query(collection(db, 'properties'), where('clientId', '==', docSnap.id)));
          if (!propsSnap.empty) {
            const firstProp = propsSnap.docs[0];
            const propertyUpdates: any = {};
            if (propertyMigrateData.adresa && !firstProp.data().address) propertyUpdates.address = propertyMigrateData.adresa;
            if (propertyMigrateData.Maps_link && !firstProp.data().mapsLink) propertyUpdates.mapsLink = propertyMigrateData.Maps_link;
            if (propertyMigrateData.suprafataMp !== undefined && firstProp.data().surfaceArea === undefined) propertyUpdates.surfaceArea = propertyMigrateData.suprafataMp;
            if (Object.keys(propertyUpdates).length > 0) {
              await updateDoc(doc(db, 'properties', firstProp.id), propertyUpdates);
            }
          } else {
            await addDoc(collection(db, 'properties'), {
              clientId: docSnap.id,
              organizationId: selectedOrgId,
              name: 'Main Location',
              address: propertyMigrateData.adresa || '',
              surfaceArea: propertyMigrateData.suprafataMp || 0,
              createdAt: serverTimestamp()
            });
          }
          fixedCount++;
          addLog(`✅ Data migrated for: ${data.nume}`);
        }
      }
      addLog(`✨ Migration complete. Fixed ${fixedCount} clients.`);
    } catch (err: any) { addLog(`❌ Error: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeOrgIds = new Set((allVisits || []).filter(v => v.data === todayStr).map(v => v.organizationId));
    const proSubscribers = (organizations || []).filter(o => o.isLifetime || o.plan === 'pro').length;

    return [
      { label: 'Total Organizations', value: (organizations || []).length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { label: 'Total Users', value: (users || []).length, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { label: 'Active Today', value: activeOrgIds.size, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
      { label: 'Pro Subscriptions', value: proSubscribers, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];
  }, [organizations, users, allVisits]);

  return (
    <div className="sa-theme-wrapper space-y-10 animate-in fade-in duration-700 pb-20">
      <style>{`
        .sa-theme-wrapper {
          --accent-color: #6366f1; /* Indigo */
          --sa-gold: #fbbf24;
          --bg-sa-card: rgba(99, 102, 241, 0.03);
        }
        .sa-card-gold {
          border: 1px solid rgba(251, 191, 36, 0.2);
          background: linear-gradient(135deg, var(--bg-card), rgba(251, 191, 36, 0.05));
        }
        .sa-text-gold {
          color: var(--sa-gold);
        }
        .sa-badge-pro {
          background: linear-gradient(to right, #6366f1, #8b5cf6);
          color: white;
        }
      `}</style>

      {/* Header section with distinct Super Admin branding */}
      <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-indigo-500/10 mb-4 md:mb-6 shadow-sm animate-in slide-in-from-top-4 duration-700">
        
        <div className="flex items-center gap-3 md:gap-5 w-full">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
            <ShieldCheck className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">
                  Super Admin <span className="text-indigo-500">{t('Terminal')}</span>
                </h1>
            </div>
            <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
              {t('Global Infrastructure & Organization Governance')}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 bg-bg-card/50 backdrop-blur-md border border-border-color px-4 py-2 rounded-2xl shadow-sm shrink-0">
            <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Platform Status')}</span>
                <span className="text-sm font-mono font-black text-emerald-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  {t('OPERATIONAL')}
                </span>
            </div>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="stihl-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t(stat.label)}</p>
                <p className="text-2xl font-black text-main">{stat.value}</p>
              </div>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-5 text-main group-hover:scale-110 transition-transform">
                <stat.icon size={80} />
            </div>
          </div>
        ))}
      </div>

      {/* Organizations Table */}
      <div className="stihl-card rounded-2xl overflow-hidden border border-border-color">
        <div className="p-6 border-b border-border-color bg-bg-card/50 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
              <h2 className="text-sm font-black text-main uppercase tracking-widest whitespace-nowrap">{t('Master Organization Registry')}</h2>
              
              <div className="flex items-center gap-4">
                {/* Premium Search Integration */}
                <div className="relative flex items-center group w-full max-w-[480px] flex-shrink-0">
                  <div className="absolute left-4 flex items-center pointer-events-none z-10">
                    <Search size={18} className="text-text-secondary group-focus-within:text-accent-color transition-all duration-300" />
                  </div>
                  <input 
                    type="text" 
                    placeholder={t('Search organization, admin...')} 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-bg-main/50 border border-border-color/10 rounded-2xl pr-12 py-3 text-sm font-bold text-main outline-none focus:bg-bg-main/80 focus:border-accent-color/30 focus:ring-8 focus:ring-accent-color/5 transition-all placeholder:text-text-secondary/40 placeholder:font-medium tracking-tight shadow-sm"
                    style={{ paddingLeft: '3.5rem' }}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-3.5 p-2 rounded-xl text-text-secondary hover:text-red-500 hover:bg-red-500/5 transition-all animate-in fade-in zoom-in duration-200"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  )}
                </div>
 
                {/* Column Selection Toolbar */}
                <div className="relative">
                  <button 
                    onClick={() => setShowColumnPicker(!showColumnPicker)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${showColumnPicker ? 'bg-accent-color text-white border-accent-color shadow-lg shadow-accent-color/20' : 'text-text-secondary hover:text-main bg-bg-main/50 border-border-color/10 hover:border-border-color/30'}`}
                  >
                    <Columns size={14} />
                    {t('Coloane')}
                  </button>
                  
                  {showColumnPicker && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowColumnPicker(false)}></div>
                      <div className="absolute left-0 mt-2 w-52 bg-bg-card border border-border-color rounded-xl shadow-2xl z-20 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        <div className="p-3 border-b border-border-color bg-bg-main/50">
                          <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Toggle Columns')}</p>
                        </div>
                        <div className="p-1.5">
                          {COLUMNS.map(col => (
                            <button
                              key={col.id}
                              disabled={col.id === 'organization' || col.id === 'actions'}
                              onClick={() => toggleColumn(col.id)}
                              className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left ${visibleColumns.includes(col.id) ? 'bg-accent-color/5 text-accent-color' : 'text-text-secondary hover:bg-bg-main'}`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${visibleColumns.includes(col.id) ? 'bg-accent-color border-accent-color text-white' : 'border-border-color'}`}>
                                {visibleColumns.includes(col.id) && <Check size={8} strokeWidth={4} />}
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-tight">{t(col.label)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-bold text-text-secondary bg-bg-main px-3 py-1.5 rounded-full border border-border-color/50">{filteredOrgs.length} {t('Entries Found')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg-main border-b border-border-color">
                {visibleColumns.includes('organization') && (
                  <th 
                    onClick={() => handleSort('organization')}
                    className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {t('Organization')}
                      {sortConfig.key === 'organization' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-accent-color" /> : <ArrowDown size={10} className="text-accent-color" />
                      ) : <ArrowUpDown size={10} className="opacity-20" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('admin') && (
                  <th 
                    onClick={() => handleSort('admin')}
                    className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {t('Administrator & Contact')}
                      {sortConfig.key === 'admin' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-accent-color" /> : <ArrowDown size={10} className="text-accent-color" />
                      ) : <ArrowUpDown size={10} className="opacity-20" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('stats') && <th className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Stats (U / C / P)')}</th>}
                {visibleColumns.includes('plan') && (
                  <th 
                    onClick={() => handleSort('plan')}
                    className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {t('Plan Status')}
                      {sortConfig.key === 'plan' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-accent-color" /> : <ArrowDown size={10} className="text-accent-color" />
                      ) : <ArrowUpDown size={10} className="opacity-20" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('expiration') && (
                  <th 
                    onClick={() => handleSort('expiration')}
                    className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {t('Expiration')}
                      {sortConfig.key === 'expiration' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-accent-color" /> : <ArrowDown size={10} className="text-accent-color" />
                      ) : <ArrowUpDown size={10} className="opacity-20" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('createdAt') && (
                  <th 
                    onClick={() => handleSort('createdAt')}
                    className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {t('CreatedAt')}
                      {sortConfig.key === 'createdAt' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-accent-color" /> : <ArrowDown size={10} className="text-accent-color" />
                      ) : <ArrowUpDown size={10} className="opacity-20" />}
                    </div>
                  </th>
                )}
                {visibleColumns.includes('actions') && <th className="px-6 py-4 text-[11px] font-black text-text-secondary uppercase tracking-widest text-right">{t('Actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {paginatedOrgs.length > 0 ? paginatedOrgs.map(org => {
                const orgUsers = (users || []).filter(u => u.organizationId === org.id);
                const admin = (users || []).find(u => u.uid === org.adminUid);
                const orgClients = (allClients || []).filter(c => c.organizationId === org.id);
                const orgProps = (allProperties || []).filter(p => p.organizationId === org.id);
                
                return (
                  <tr key={org.id} className="hover:bg-bg-main/50 transition-colors group">
                    {visibleColumns.includes('organization') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-main">{org.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-secondary font-mono bg-bg-main px-1 rounded">{org.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('admin') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-main">{admin?.displayName || t('Unknown')}</span>
                          <a href={`mailto:${admin?.email}`} className="text-[11px] text-accent-color hover:underline">{admin?.email}</a>
                          {admin?.phoneNumber && (
                            <a href={`tel:${admin.phoneNumber}`} className="text-[11px] text-green-500 font-bold mt-0.5">{admin.phoneNumber}</a>
                          )}
                          {(() => {
                            let lastLoginDate: Date | null = null;
                            orgUsers.forEach(u => {
                              if (u.lastLoginAt) {
                                const d = u.lastLoginAt?.toDate ? u.lastLoginAt.toDate() : new Date(u.lastLoginAt);
                                if (!lastLoginDate || d.getTime() > lastLoginDate.getTime()) {
                                  lastLoginDate = d;
                                }
                              }
                            });
                            if (!lastLoginDate) return null;
                            const isOnline = (new Date().getTime() - lastLoginDate.getTime()) < 1000 * 60 * 15; // 15 mins
                            return (
                              <div className="flex items-center gap-1.5 mt-1.5 opacity-80">
                                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-text-secondary'}`}></div>
                                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                                  {isOnline ? t('Online Acum') : `${t('Ultima logare')}: ${format(lastLoginDate, 'dd MMM, HH:mm', { locale: currentLocale })}`}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('stats') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-main">{orgUsers.length}</span>
                            <span className="text-[8px] font-bold text-text-secondary uppercase">{t('Users')}</span>
                          </div>
                          <div className="w-[1px] h-4 bg-border-color"></div>
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-black ${orgClients.length >= 5 && !org.isLifetime && org.plan !== 'pro' ? 'text-red-500' : 'text-main'}`}>
                              {orgClients.length}
                            </span>
                            <span className="text-[8px] font-bold text-text-secondary uppercase">{t('Clients')}</span>
                          </div>
                          <div className="w-[1px] h-4 bg-border-color"></div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-main">{orgProps.length}</span>
                            <span className="text-[8px] font-bold text-text-secondary uppercase">{t('Props')}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('plan') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 relative">
                          <label className="text-[9px] font-black text-text-secondary uppercase tracking-widest">{t('PACHET:')}</label>
                          <select
                            value={org.isLifetime ? 'lifetime' : (org.plan === 'pro' ? (org.billingCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly') : 'free')}
                            onChange={async (e) => {
                              const val = e.target.value;
                              let newPlan = 'free';
                              let newLifetime = false;
                              let newBillingCycle = 'monthly';
                              
                              if (val === 'lifetime') {
                                newPlan = 'pro';
                                newLifetime = true;
                              } else if (val === 'pro_yearly') {
                                newPlan = 'pro';
                                newBillingCycle = 'yearly';
                              } else if (val === 'pro_monthly') {
                                newPlan = 'pro';
                                newBillingCycle = 'monthly';
                              }

                              try {
                                const { doc, updateDoc } = await import('../services/firebase');
                                await updateDoc(doc(db, 'organizations', org.id), {
                                  plan: newPlan,
                                  isLifetime: newLifetime,
                                  billingCycle: newBillingCycle
                                });
                                toast.success(t('Pachet actualizat cu succes'));
                              } catch (err) {
                                toast.error(t('Eroare la actualizarea pachetului'));
                              }
                            }}
                            className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs font-black outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer w-40"
                          >
                            <option value="free">🆓 {t('Free')}</option>
                            <option value="pro_monthly">✨ {t('PRO / Lună')}</option>
                            <option value="pro_yearly">⭐ {t('PRO / An')}</option>
                            <option value="lifetime">👑 {t('PRO Lifetime')}</option>
                          </select>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('expiration') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 relative">
                          <label className="text-[9px] font-black text-text-secondary uppercase tracking-widest">{t('STATUS:')}</label>
                          <select
                            value={org.status || 'active'}
                            onChange={async (e) => {
                              try {
                                const { doc, updateDoc } = await import('../services/firebase');
                                await updateDoc(doc(db, 'organizations', org.id), {
                                  status: e.target.value
                                });
                                toast.success(t('Status actualizat'));
                              } catch (err) {
                                toast.error(t('Eroare la actualizarea statusului'));
                              }
                            }}
                            className="bg-bg-main text-main border border-border-color rounded-lg px-3 py-1.5 text-xs font-black outline-none focus:border-accent-color transition-all appearance-none cursor-pointer w-32"
                          >
                            <option value="active">▶ {t('Activ')}</option>
                            <option value="suspended">⏸ {t('Suspendat')}</option>
                          </select>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('createdAt') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-main">
                            {org.createdAt ? format(org.createdAt.toDate(), 'dd MMM yyyy') : 'N/A'}
                          </span>
                          <span className="text-[11px] text-text-secondary font-medium">
                            {org.createdAt ? format(org.createdAt.toDate(), 'HH:mm') : ''}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                              onClick={() => toggleLifetime(org.id, !!org.isLifetime)}
                              className={`p-1.5 rounded-lg transition-all ${org.isLifetime ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'hover:bg-amber-500/10 text-text-secondary hover:text-amber-500'}`} 
                              title={t('Toggle Lifetime Access')}
                          >
                              <Star size={14} fill={org.isLifetime ? "currentColor" : "none"} />
                          </button>
                          <button 
                              onClick={() => {
                                setAccessModal({ isOpen: true, orgId: org.id, orgName: org.name });
                                if (org.planExpires) {
                                  setExpiryDate(format(org.planExpires.toDate(), 'yyyy-MM-dd'));
                                } else {
                                  setExpiryDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
                                }
                              }}
                              className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-text-secondary hover:text-emerald-500 transition-all" 
                              title={t('Grant/Edit PRO Access')}
                          >
                              <Zap size={14} />
                          </button>
                          <button 
                              onClick={() => setDeleteModal({ isOpen: true, orgId: org.id, orgName: org.name })}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-text-secondary hover:text-red-500 transition-all" 
                              title={t('Delete Organization')}
                          >
                              <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-text-secondary/20" />
                      <p className="text-sm font-black text-text-secondary uppercase tracking-widest">{t('No matching organizations found')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-border-color bg-bg-main/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Rows per page:')}</p>
              <select 
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-bg-card border border-border-color rounded-lg px-2 py-1 text-xs font-black text-main outline-none focus:border-accent-color transition-all"
              >
                {[5, 10, 20, 50, 100].map(val => <option key={val} value={val}>{val}</option>)}
              </select>
            </div>
            <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest flex items-center gap-1">
              <span>{t('Showing')}</span>
              <span className="text-main">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredOrgs.length)}</span>
              <span>{t('of')}</span>
              <span className="text-main">{filteredOrgs.length}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-xl border border-border-color bg-bg-card text-text-secondary hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                // Simple logic for windowing if totalPages > 5
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                }
                if (pageNum <= 0) return null;
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${currentPage === pageNum ? 'bg-accent-color text-white shadow-lg shadow-accent-color/20' : 'bg-bg-card border border-border-color text-text-secondary hover:text-main'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-xl border border-border-color bg-bg-card text-text-secondary hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>


      {/* SaaS Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stihl-card p-6 rounded-2xl">
              <h3 className="text-sm font-black text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package size={18} className="text-blue-500" />
                  {t('SaaS Plan Configuration')}
              </h3>
              <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color">
                      <div className="flex-1">
                          <p className="text-xs font-black text-main">{t('Maintenance Mode')}</p>
                          <p className="text-[11px] text-text-secondary">
                            {config.maintenanceMode 
                              ? (config.maintenanceUntil 
                                  ? `${t('Active until:')} ${format(config.maintenanceUntil.toDate(), 'HH:mm dd/MM')}`
                                  : t('Active indefinitely'))
                              : t('Blocks access to all organizations for updates.')}
                          </p>
                      </div>
                      <button 
                        onClick={toggleMaintenance}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${config.maintenanceMode ? 'bg-red-500 shadow-lg shadow-red-500/20' : 'bg-border-color'}`}
                      >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${config.maintenanceMode ? 'right-1' : 'left-1'}`}></div>
                      </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color">
                      <div>
                          <p className="text-xs font-black text-main">{t('Global Announcement')}</p>
                          <p className="text-[11px] text-text-secondary">
                            {config.announcement ? `${t('Active:')} "${config.announcement.substring(0, 20)}..."` : t('No active announcement.')}
                          </p>
                      </div>
                      <button 
                        onClick={() => {
                          setTempAnnouncement(config.announcement || '');
                          setShowAnnouncementModal(true);
                        }}
                        className="px-3 py-1.5 bg-accent-color text-white text-[11px] font-black rounded-lg hover:bg-accent-color/90 transition-all"
                      >
                        {config.announcement ? t('EDIT') : t('ADD')}
                      </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color">
                      <div className="flex-1">
                          <p className="text-xs font-black text-main">{t('PF Ads Configuration')}</p>
                          <p className="text-[11px] text-text-secondary">
                            {t('Toggle advertisements for PF (Homeowner) users across different interface locations.')}
                          </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-text-secondary uppercase">{t('Sidebar')}</span>
                          <button 
                            onClick={() => toggleAd('sidebar')}
                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${(config.adsConfig?.sidebar ?? true) ? 'bg-emerald-500' : 'bg-border-color'}`}
                          >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${(config.adsConfig?.sidebar ?? true) ? 'right-1' : 'left-1'}`}></div>
                          </button>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-text-secondary uppercase">{t('Main')}</span>
                          <button 
                            onClick={() => toggleAd('main')}
                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${(config.adsConfig?.main ?? true) ? 'bg-emerald-500' : 'bg-border-color'}`}
                          >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${(config.adsConfig?.main ?? true) ? 'right-1' : 'left-1'}`}></div>
                          </button>
                        </div>
                      </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color">
                      <div className="flex-1">
                          <p className="text-xs font-black text-main">{t('Ads Content Editor')}</p>
                          <p className="text-[11px] text-text-secondary">
                            {t('Manage the ads displayed to PF users (they rotate randomly).')}
                          </p>
                      </div>
                      <button 
                        onClick={handleOpenAdsEditor}
                        className="px-3 py-1.5 bg-accent-color text-white text-[11px] font-black rounded-lg hover:bg-accent-color/90 transition-all flex items-center gap-2"
                      >
                        {t('EDIT ADS')}
                      </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-main rounded-xl border border-border-color">
                      <div className="flex-1">
                          <p className="text-xs font-black text-main">{t('Garden Guide Editor')}</p>
                          <p className="text-[11px] text-text-secondary">
                            {t('Modify the global monthly care guide for PF users.')}
                          </p>
                      </div>
                      <button 
                        onClick={handleOpenGuideEditor}
                        className="px-3 py-1.5 bg-accent-color text-white text-[11px] font-black rounded-lg hover:bg-accent-color/90 transition-all flex items-center gap-2"
                      >
                        <Calendar size={12} />
                        {t('EDIT GUIDE')}
                      </button>
                  </div>
              </div>
          </div>

          <div className="stihl-card p-6 rounded-2xl">
              <h3 className="text-sm font-black text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-500" />
                  {t('License & Gift Codes')}
              </h3>
              <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                      <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Select Duration')}</p>
                      <div className="flex gap-2">
                          {[3, 6, 12].map(m => (
                              <button 
                                key={m}
                                onClick={() => setCodeDuration(m as any)}
                                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all border ${
                                    codeDuration === m 
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                                    : 'bg-bg-main text-text-secondary border-border-color hover:border-emerald-500/50'
                                }`}
                              >
                                  {m} {t('MONTHS')}
                              </button>
                          ))}
                      </div>
                  </div>

                  {generatedCodes.length > 0 ? (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl animate-in zoom-in duration-300">
                          <p className="text-[11px] font-black text-emerald-600 uppercase mb-1 text-center tracking-widest">{t('Generated {{count}} Codes', { count: generatedCodes.length })}</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                              {generatedCodes.map((code, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-white/50 rounded-lg">
                                    <span className="text-sm font-black text-main font-mono">{code}</span>
                                    <button 
                                      onClick={() => navigator.clipboard.writeText(code)}
                                      className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                                    >
                                        <Copy size={12} />
                                    </button>
                                </div>
                              ))}
                          </div>
                          <button 
                            onClick={() => setGeneratedCodes([])}
                            className="w-full mt-3 py-2 text-[11px] font-black text-emerald-600 uppercase hover:underline"
                          >
                            {t('Done / Clear')}
                          </button>
                      </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Quantity')}</p>
                        <select 
                          value={codeQuantity}
                          onChange={(e) => setCodeQuantity(Number(e.target.value))}
                          className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs font-black outline-none focus:border-emerald-500"
                        >
                          {[1, 2, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n} {t('Codes')}</option>)}
                        </select>
                      </div>
                      <button 
                          onClick={handleGenerateCode}
                          disabled={isGenerating}
                          className="w-full py-4 bg-accent-color text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent-color/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-color/20"
                      >
                          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                          {t('Generate {{quantity}}x {{duration}}M Codes', { quantity: codeQuantity, duration: codeDuration })}
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-border-color">
                      <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-3">{t('Live Status Registry (Last 20)')}</p>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {recentCodes.map(c => (
                              <div key={c.id} className="flex items-center justify-between p-3 bg-bg-main/50 rounded-xl border border-border-color/50 group hover:border-emerald-500/30 transition-all">
                                  <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-main font-mono">{c.code}</span>
                                        {c.used ? (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-black uppercase">{t('USED')}</span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[8px] font-black uppercase">{t('ACTIVE')}</span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-text-secondary font-bold">
                                        {c.durationMonths} {t('Months')} • {t('Created')} {c.createdAt ? format(c.createdAt.toDate(), 'dd MMM HH:mm') : ''}
                                      </span>
                                      {c.usedByOrgName && (
                                        <span className="text-[8px] text-emerald-600 font-black uppercase mt-1">
                                          {t('Used by:')} {c.usedByOrgName}
                                        </span>
                                      )}
                                  </div>
                                  <button 
                                    onClick={() => navigator.clipboard.writeText(c.code)}
                                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-emerald-500"
                                  >
                                    <Copy size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>
      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="stihl-card w-full max-w-md p-6 rounded-2xl bg-bg-card shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-black text-main uppercase tracking-tight mb-4">{t('Global Announcement')}</h3>
            <p className="text-[11px] font-bold text-text-secondary uppercase mb-2 tracking-widest">{t('Message')}</p>
            <textarea 
              value={tempAnnouncement}
              onChange={(e) => setTempAnnouncement(e.target.value)}
              placeholder={t('Enter message for all users...')}
              className="w-full h-32 bg-bg-main border border-border-color rounded-xl p-4 text-sm font-bold text-main outline-none focus:border-accent-color resize-none mb-6"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="flex-1 py-3 bg-bg-main border border-border-color text-text-secondary text-xs font-black uppercase rounded-xl hover:bg-border-color transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={() => saveAnnouncement()}
                className="flex-1 py-3 bg-accent-color text-white text-xs font-black uppercase rounded-xl hover:bg-accent-color/90 shadow-lg shadow-accent-color/20 transition-all"
              >
                {t('Save & Publish')}
              </button>
            </div>
            {config.announcement && (
              <button 
                onClick={() => { setTempAnnouncement(''); saveAnnouncement(''); }}
                className="w-full mt-4 py-2 text-[11px] font-black text-red-500 uppercase hover:underline"
              >
                {t('Delete / Hide Banner')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Garden Guide Editor Modal */}
      {showGuideEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="stihl-card w-full max-w-4xl p-6 rounded-2xl bg-bg-card shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-main uppercase tracking-tight flex items-center gap-2">
                <Calendar className="text-accent-color" />
                {t('Garden Guide Editor')}
              </h3>
              <button onClick={() => setShowGuideEditor(false)} className="text-text-secondary hover:text-main">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 mb-4 custom-scrollbar flex-shrink-0">
              {editingGuide.map((month, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedGuideMonth(index)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all ${
                    selectedGuideMonth === index 
                      ? 'bg-accent-color text-white shadow-lg shadow-accent-color/20' 
                      : 'bg-bg-main text-text-secondary hover:bg-border-color'
                  }`}
                >
                  {month.title.split(':')[0]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {editingGuide[selectedGuideMonth] && (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{t('Lună & Titlu')}</label>
                    <input 
                      type="text" 
                      value={editingGuide[selectedGuideMonth].title}
                      onChange={(e) => {
                        const newGuide = [...editingGuide];
                        newGuide[selectedGuideMonth].title = e.target.value;
                        setEditingGuide(newGuide);
                      }}
                      className="w-full bg-bg-main border border-border-color rounded-xl p-3 text-sm font-bold text-main outline-none focus:border-accent-color"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{t('Sumar (Summary)')}</label>
                    <textarea 
                      value={editingGuide[selectedGuideMonth].summary || ''}
                      onChange={(e) => {
                        const newGuide = [...editingGuide];
                        newGuide[selectedGuideMonth].summary = e.target.value;
                        setEditingGuide(newGuide);
                      }}
                      className="w-full h-24 bg-bg-main border border-border-color rounded-xl p-3 text-sm text-main outline-none focus:border-accent-color resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{t('Sarcini (Tasks)')}</label>
                      <button 
                        onClick={() => addGuideTask(selectedGuideMonth)}
                        className="text-[11px] font-black text-accent-color uppercase hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> {t('Adaugă Sarcina')}
                      </button>
                    </div>
                    {editingGuide[selectedGuideMonth].tasks.map((task: any, taskIndex: number) => (
                      <div key={taskIndex} className="flex gap-2">
                        <input 
                          type="text" 
                          value={typeof task === 'string' ? task : task.title}
                          onChange={(e) => updateGuideTask(selectedGuideMonth, taskIndex, e.target.value)}
                          className="flex-1 bg-bg-main border border-border-color rounded-xl p-3 text-sm text-main outline-none focus:border-accent-color"
                        />
                        <button 
                          onClick={() => removeGuideTask(selectedGuideMonth, taskIndex)}
                          className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-color flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setShowGuideEditor(false)}
                className="px-6 py-3 bg-bg-main border border-border-color text-text-secondary text-xs font-black uppercase rounded-xl hover:bg-border-color transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleSaveGuide}
                className="px-8 py-3 bg-accent-color text-white text-xs font-black uppercase rounded-xl hover:bg-accent-color/90 shadow-lg shadow-accent-color/20 transition-all flex items-center gap-2"
              >
                <Check size={16} />
                {t('Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ads Editor Modal */}
      {showAdsEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="stihl-card w-full max-w-4xl p-6 rounded-2xl bg-bg-card shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-main uppercase tracking-tight flex items-center gap-2">
                <ExternalLink className="text-accent-color" />
                {t('Ads Content Editor')}
              </h3>
              <button onClick={() => setShowAdsEditor(false)} className="text-text-secondary hover:text-main">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex justify-end mb-4">
               <button 
                 onClick={addAd}
                 className="text-[11px] font-black text-accent-color uppercase hover:underline flex items-center gap-1 bg-accent-color/10 px-3 py-2 rounded-lg"
               >
                 <Zap size={12} /> {t('Add New Ad')}
               </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {editingAds.length === 0 ? (
                <div className="text-center py-10 text-text-secondary text-sm">{t('No ads configured. Click "Add New Ad" to create one.')}</div>
              ) : (
                editingAds.map((ad, index) => (
                  <div key={ad.id || index} className="p-4 border border-border-color rounded-xl bg-bg-main relative space-y-4">
                    <button 
                      onClick={() => setEditingAds(editingAds.filter((_, i) => i !== index))}
                      className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all z-10"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mr-10">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Title (Main Ad)')}</label>
                        <input 
                          type="text" 
                          value={ad.title}
                          onChange={(e) => {
                            const newAds = [...editingAds];
                            newAds[index].title = e.target.value;
                            setEditingAds(newAds);
                          }}
                          className="w-full bg-bg-card border border-border-color rounded-lg p-2 text-sm text-main focus:border-accent-color"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-text-secondary uppercase">{t('URL (Destination)')}</label>
                        <input 
                          type="text" 
                          value={ad.url}
                          onChange={(e) => {
                            const newAds = [...editingAds];
                            newAds[index].url = e.target.value;
                            setEditingAds(newAds);
                          }}
                          className="w-full bg-bg-card border border-border-color rounded-lg p-2 text-sm text-main focus:border-accent-color"
                        />
                      </div>
                      
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Main Description')}</label>
                        <textarea 
                          value={ad.description}
                          onChange={(e) => {
                            const newAds = [...editingAds];
                            newAds[index].description = e.target.value;
                            setEditingAds(newAds);
                          }}
                          className="w-full bg-bg-card border border-border-color rounded-lg p-2 text-sm text-main focus:border-accent-color resize-none h-16"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Short Desc (Sidebar Ad)')}</label>
                        <input 
                          type="text" 
                          value={ad.shortDescription || ''}
                          onChange={(e) => {
                            const newAds = [...editingAds];
                            newAds[index].shortDescription = e.target.value;
                            setEditingAds(newAds);
                          }}
                          className="w-full bg-bg-card border border-border-color rounded-lg p-2 text-sm text-main focus:border-accent-color"
                          placeholder={t('Short version for sidebar')}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Button Text')}</label>
                        <input 
                          type="text" 
                          value={ad.buttonText || 'Shop Now'}
                          onChange={(e) => {
                            const newAds = [...editingAds];
                            newAds[index].buttonText = e.target.value;
                            setEditingAds(newAds);
                          }}
                          className="w-full bg-bg-card border border-border-color rounded-lg p-2 text-sm text-main focus:border-accent-color"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-color flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setShowAdsEditor(false)}
                className="px-6 py-3 bg-bg-main border border-border-color text-text-secondary text-xs font-black uppercase rounded-xl hover:bg-border-color transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleSaveAds}
                className="px-8 py-3 bg-accent-color text-white text-xs font-black uppercase rounded-xl hover:bg-accent-color/90 shadow-lg shadow-accent-color/20 transition-all flex items-center gap-2"
              >
                <Check size={16} />
                {t('Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant PRO Access Modal */}
      {accessModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border-color bg-bg-card/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-main">{t('Manage Plan Access')}</h3>
                    <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{accessModal.orgName}</p>
                  </div>
                </div>
                <button onClick={() => setAccessModal({ ...accessModal, isOpen: false })} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all">
                  <X size={20} className="text-text-secondary" />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest ml-1">{t('Select Plan Type')}</label>
                  <select
                    value={(accessModal as any).selectedPlan || 'pro'}
                    onChange={(e) => setAccessModal({ ...accessModal, selectedPlan: e.target.value as any })}
                    className="w-full bg-bg-main border border-border-color/10 rounded-2xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color/30 transition-all appearance-none"
                  >
                    <option value="free">{t('FREE')}</option>
                    <option value="pro">{t('PRO')}</option>
                    <option value="enterprise">{t('ENTERPRISE')}</option>
                    <option value="lifetime">{t('LIFETIME')}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest ml-1">{t('Access Expiration Date')}</label>
                  <div className="relative group">
                    <input 
                      type="date" 
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full bg-bg-main border border-border-color/10 rounded-2xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color/30 focus:ring-8 focus:ring-accent-color/5 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-text-secondary font-medium ml-1">{t('The organization will automatically revert to FREE plan after this date.')}</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setExpiryDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'))}
                    className="flex-1 py-2 rounded-xl bg-bg-main border border-border-color/10 text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-main hover:border-border-color transition-all"
                  >
                    {t('+30 Days')}
                  </button>
                  <button 
                    onClick={() => setExpiryDate(format(addDays(new Date(), 365), 'yyyy-MM-dd'))}
                    className="flex-1 py-2 rounded-xl bg-bg-main border border-border-color/10 text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-main hover:border-border-color transition-all"
                  >
                    {t('+1 Year')}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-bg-card/50 border-t border-border-color flex gap-3">
              <button 
                onClick={() => setAccessModal({ ...accessModal, isOpen: false })}
                className="flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleGrantPro}
                disabled={isUpdatingAccess || !expiryDate}
                className="flex-[2] py-3.5 rounded-2xl bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isUpdatingAccess ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                {t('Confirm Access')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Organization Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="stihl-card w-full max-w-md overflow-hidden rounded-[2rem] bg-bg-card shadow-2xl border border-red-500/20 animate-in zoom-in-95">
            <div className="p-8 bg-red-500/5 border-b border-red-500/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/30">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-main uppercase tracking-tight">{t('Delete Organization')}</h3>
                  <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-1">{t('High-Risk Operation')}</p>
                </div>
              </div>
            </div>
            
            <div className="p-8">
              <p className="text-sm font-bold text-main mb-2">{t('Are you sure you want to delete organization "{{name}}"?', { name: deleteModal.orgName })}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{t('This action will delete the organization document from the database. Associated data (clients, visits) will not be deleted automatically but will no longer be accessible through this company.')}</p>
              
              <div className="mt-6 p-4 bg-bg-main rounded-xl border border-border-color/50">
                <div className="flex items-center gap-3 text-[11px] font-black text-text-secondary uppercase tracking-widest">
                  <Database size={14} className="text-red-500" />
                  {t('Database Reference:')} <span className="text-main">{deleteModal.orgId}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-bg-card/50 border-t border-border-color flex gap-3">
              <button 
                onClick={() => setDeleteModal({ isOpen: false, orgId: '', orgName: '' })}
                disabled={isDeleting}
                className="flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={handleDeleteOrganization}
                disabled={isDeleting}
                className="flex-[2] py-3.5 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t('Confirm Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Duration Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="stihl-card w-full max-w-sm p-6 rounded-2xl bg-bg-card shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-black text-main uppercase tracking-tight mb-2">{t('Activate Maintenance')}</h3>
            <p className="text-xs text-text-secondary mb-6">{t('Select how long the platform will be offline. It will automatically return online after the period expires.')}</p>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[1, 2, 6, 12, 24].map(h => (
                <button
                  key={h}
                  onClick={() => activateMaintenance(h)}
                  className="py-3 bg-bg-main border border-border-color rounded-xl text-xs font-black text-main hover:border-accent-color hover:text-accent-color transition-all"
                >
                  {h} {h === 1 ? t('HOUR') : t('HOURS')}
                </button>
              ))}
              <button
                onClick={() => activateMaintenance(null)}
                className="py-3 bg-bg-main border border-border-color rounded-xl text-xs font-black text-main hover:border-red-500 hover:text-red-500 transition-all col-span-2"
              >
                {t('UNLIMITED (Manual OFF)')}
              </button>
            </div>
            
            <button 
              onClick={() => setShowMaintenanceModal(false)}
              className="w-full py-3 text-[11px] font-black text-text-secondary uppercase hover:underline"
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Mass Email Campaign */}
      <div className="stihl-card p-6 rounded-2xl mt-8 border border-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center gap-2 mb-4">
          <Mail size={18} className="text-blue-500" />
          {t('Mass Email Campaigns')}
        </h3>
        
        <div className="flex flex-col gap-4 max-w-3xl relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">{t('Target Audience')}</label>
              <select 
                value={campaignTarget}
                onChange={(e) => setCampaignTarget(e.target.value)}
                className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-black text-main outline-none focus:border-blue-500"
              >
                <option value="all">{t('All Users (Including Employees)')}</option>
                <option value="admins">{t('Organization Admins Only')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">{t('Test Email (Optional)')}</label>
              <input 
                type="email"
                value={campaignTestEmail}
                onChange={(e) => setCampaignTestEmail(e.target.value)}
                placeholder={t('Enter email to send a test first')}
                className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-black text-main outline-none focus:border-blue-500 placeholder:text-text-secondary/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">{t('Subject')}</label>
            <input 
              type="text"
              value={campaignSubject}
              onChange={(e) => setCampaignSubject(e.target.value)}
              placeholder={t('Email Subject')}
              className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-black text-main outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1 block">{t('Message (HTML)')}</label>
            <textarea 
              value={campaignMessage}
              onChange={(e) => setCampaignMessage(e.target.value)}
              placeholder={t('<h1>Hello!</h1><p>This is a test message.</p>')}
              rows={6}
              className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-xs font-mono text-main outline-none focus:border-blue-500 resize-y"
            ></textarea>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex-1">
              {campaignProgress && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-bg-main rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${campaignProgress.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-500`}
                      style={{ width: `${Math.max(5, (campaignProgress.sent / Math.max(1, campaignProgress.total)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest min-w-[100px]">
                    {campaignProgress.status === 'failed' ? t('Failed') : `${campaignProgress.sent} / ${campaignProgress.total} ${t('Sent')}`}
                  </span>
                </div>
              )}
            </div>
            
            <button
              onClick={handleSendCampaign}
              disabled={isSendingCampaign || !campaignSubject || !campaignMessage}
              className="ml-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              {isSendingCampaign ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {campaignTestEmail ? t('SEND TEST') : t('START CAMPAIGN')}
            </button>
          </div>
        </div>
      </div>

      {/* Technical Tools & Audit */}
      <div className="stihl-card p-6 rounded-2xl mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                  <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert size={18} className="text-red-500" />
                      {t('Technical Tools & Database Audit')}
                  </h3>
                  <p className="text-[11px] text-text-secondary font-bold uppercase tracking-widest mt-1">{t('High-privilege maintenance & repair operations')}</p>
              </div>
              <div className="flex items-center gap-2">
                  <select 
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs font-black text-main outline-none focus:border-accent-color min-w-[200px]"
                  >
                      <option value="">{t('-- SELECT ORGANIZATION --')}</option>
                      {organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name.toUpperCase()}</option>
                      ))}
                  </select>
                  <button 
                    disabled={isProcessing}
                    onClick={async () => {
                        if (!window.confirm(t('DANGER: Are you sure you want to delete orphaned users? This action cannot be undone.'))) return;
                        setIsProcessing(true);
                        addLog(t('[CLEANUP] Starting scan for orphaned users...'));
                        try {
                          const { getDocs, collection, doc, getDoc, writeBatch } = await import('../services/firebase');
                          const allUsersSnap = await getDocs(collection(db, 'users'));
                          const batch = writeBatch(db);
                          let orphanedCount = 0;

                          for (const uDoc of allUsersSnap.docs) {
                            const uData = uDoc.data();
                            if (!uData.organizationId) continue;
                            
                            const orgSnap = await getDoc(doc(db, 'organizations', uData.organizationId));
                            if (!orgSnap.exists()) {
                              batch.delete(uDoc.ref);
                              orphanedCount++;
                              addLog(t('[CLEANUP] Found orphaned user: {{email}}', { email: uData.email }));
                            }
                          }

                          if (orphanedCount > 0) {
                            await batch.commit();
                            addLog(t('[CLEANUP] Successfully deleted {{count}} orphaned users.', { count: orphanedCount }));
                            toast.success(`Deleted ${orphanedCount} orphaned users.`);
                          } else {
                            addLog(t('[CLEANUP] No orphaned users found.'));
                          }
                        } catch (err: any) {
                          addLog(`❌ Cleanup error: ${err.message}`);
                        } finally {
                          setIsProcessing(false);
                        }
                    }}
                    className="px-4 py-2 bg-amber-600 text-white text-[11px] font-black rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20"
                  >
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                      {t('CLEAN ORPHANED USERS')}
                  </button>
                  <button 
                    disabled={!selectedOrgId || isProcessing}
                    onClick={async () => {
                        if (!selectedOrgId) return;
                        if (!window.confirm(t('Are you sure you want to run a full audit for this organization?'))) return;
                        setIsProcessing(true);
                        addLog(t('[AUDIT] Starting scan for {{orgId}}...', { orgId: selectedOrgId }));
                        try {
                          const { getDocs, query, collection, where } = await import('../services/firebase');
                          const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', selectedOrgId)));
                          addLog(t('[AUDIT] Found {{count}} clients. Checking for deprecated data...', { count: snap.size }));
                          // Logic from handleInvite etc could go here if needed
                        } catch (err: any) { addLog(`❌ Audit error: ${err.message}`); }
                        finally {
                          addLog(t('[AUDIT] Scan complete.'));
                          setIsProcessing(false);
                        }
                    }}
                    className="px-4 py-2 bg-red-600 text-white text-[11px] font-black rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-red-600/20"
                  >
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                      {t('RUN FULL AUDIT')}
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
              <MaintenanceTerminal 
                terminalLogs={terminalLogs}
                isProcessing={isProcessing}
                setConfirmationModal={() => {}} 
                orgName={organizations.find(o => o.id === selectedOrgId)?.name || ''}
              />
          </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;


import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  db, 
  doc, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  handleFirestoreError,
  OperationType,
  auth
} from '../services/firebase';
import { logAudit, AuditAction, computeChanges } from '../services/audit';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { logger } from '../services/logger';
import { usePlan } from '../src/hooks/usePlan';
import { Client, Page, Property, ClientDocument, PotentialClient } from '../src/types';
import { MapPin, Droplets, Ruler, Plus, Trash2, Home, Upload, FileText, Image as ImageIcon, File, Map, Navigation, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Tag, Sprout, User } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../utils/image';
import { resolveAndParseMapsLink } from '../utils/maps';
import { PageSkeleton } from '../components/ui/Skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  id: string | null;
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  isEmbedded?: boolean;
  accountType?: 'PF' | 'PJ';
}

const ClientForm: React.FC<Props> = ({ id, onNavigate, organizationId, isEmbedded, accountType: propAccountType }) => {
  const accountType = (propAccountType || 'PJ') as string;
  const { t } = useTranslation();
  const { limits } = usePlan();
  const [loading, setLoading] = useState(!!id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Client Data State
  const initialClientState: Partial<Client> = {
    codClient: '',
    nume: '',
    tip_persoana: 'PF',
    cnp: '',
    numeFirma: '',
    roFirma: '',
    regCom: '',
    banca: '',
    iban: '',
    telefon: '',
    tarifLunar: 0,
    sold: 0,
    ziEmitereFactura: 1,
    ziScadenta: 1,
    status: 'Activ',
    contractType: 'maintenance'
  };
  const [clientData, setClientData] = useState<Partial<Client>>(initialClientState);
  const [originalClientData, setOriginalClientData] = useState<Partial<Client> | null>(null);

  // Properties State
  const [properties, setProperties] = useState<Partial<Property>[]>([]);
  const [deletedPropertyIds, setDeletedPropertyIds] = useState<string[]>([]);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'property' | 'area', index?: number, id?: string, name: string } | null>(null);

  // Invoices State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoiceData, setEditingInvoiceData] = useState<{ amount: number, status: string }>({ amount: 0, status: 'unpaid' });
  const [isDeletingInvoice, setIsDeletingInvoice] = useState<string | null>(null);

  // Accordion State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('clientFormAccordion');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      general: true,
      locations: true,
      documents: false,
      recommendations: false
    };
  });

  useEffect(() => {
    localStorage.setItem('clientFormAccordion', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Organization Settings State
  const [orgSettings, setOrgSettings] = useState<{
    billableMonths: number[];
    defaultInvoiceDay: number;
    defaultDueDay: number;
    name?: string;
  }>({
    billableMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    defaultInvoiceDay: 1,
    defaultDueDay: 15
  });

  useEffect(() => {
    if (!organizationId) return;
    const unsubOrg = onSnapshot(doc(db, 'organizations', organizationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOrgSettings({
          billableMonths: data.billableMonths || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          defaultInvoiceDay: data.defaultInvoiceDay || 1,
          defaultDueDay: data.defaultDueDay || 15,
          name: data.name
        });
        
        // If creating new client, set defaults
        if (!id) {
            setClientData(prev => ({
                ...prev,
                codClient: prev.codClient || `GDX-${Math.floor(Math.random() * 900) + 100}`,
                ziEmitereFactura: data.defaultInvoiceDay || 1,
                ziScadenta: data.defaultDueDay || 15,
                billableMonths: data.billableMonths || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            }));
            
            setProperties(prev => {
                if (prev.length > 0) return prev;
                return [{
                    id: 'temp-' + Date.now(),
                    name: 'Locație Principală',
                    address: '',
                    mapsLink: '',
                    contractType: 'maintenance',
                    surfaceArea: 0,
                    customAreas: [],
                    irrigation: { type: 'days', days: [], startTime: '06:00' },
                    ziEmitereFactura: data.defaultInvoiceDay || 1,
                    ziScadenta: data.defaultDueDay || 15
                }];
            });
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `organizations/${organizationId}`);
    });
    return () => unsubOrg();
  }, [organizationId, id]);

  const propsQuery = useMemo(() => id && organizationId ? query(
    collection(db, 'properties'), 
    where('clientId', '==', id),
    where('organizationId', '==', organizationId)
  ) : null, [id, organizationId]);
  const { data: propertiesData, loading: propsLoading } = useFirestoreQuery<Property>(propsQuery, { pageSize: 0 });

  useEffect(() => {
    if (propertiesData) {
      if (propertiesData.length > 0) {
        const sorted = [...propertiesData].sort((a, b) => (a.order || 0) - (b.order || 0));
        setProperties(sorted);
      } else {
        // Fallback if no properties found (migration not run?)
        // We could show the old data from clientData, but let's assume migration is done or user adds new.
        // For safety, if it's an existing client but no properties, we might want to init with one empty or try to read from clientData.
        // Let's init with one empty to ensure "MINIM 1 property" rule.
        if (!loading) { // Only if we finished initial load
             setProperties([{
                id: 'temp-' + Date.now(),
                name: 'Locație Principală',
                address: '', // Could fallback to clientData.adresa here if we wanted
                contractType: 'maintenance',
                surfaceArea: 0,
                customAreas: [],
                irrigation: { type: 'days', days: [], startTime: '06:00' },
                ziEmitereFactura: orgSettings.defaultInvoiceDay || 1,
                ziScadenta: orgSettings.defaultDueDay || 15
            }]);
        }
      }
      setLoading(false);
    }
  }, [propertiesData, loading]);

  useEffect(() => {
    if (!id) return;

    if (id.startsWith('lead:')) {
        const leadId = id.split(':')[1];
        const unsubLead = onSnapshot(doc(db, 'leads', leadId), (snap) => {
          if (snap.exists()) {
            const lead = snap.data() as PotentialClient;
            setClientData(prev => ({
              ...initialClientState,
              ...prev,
              nume: lead.nume || '',
              telefon: lead.telefon || '',
              contractType: 'maintenance',
              status: 'Activ'
            }));
            setProperties([{
                id: 'temp-' + Date.now(),
                name: 'Locație Principală',
                address: lead.adresa || '',
                contractType: 'maintenance',
                surfaceArea: 0,
                customAreas: [],
                irrigation: { type: 'days', days: [], startTime: '06:00' },
                ziEmitereFactura: orgSettings.defaultInvoiceDay || 1,
                ziScadenta: orgSettings.defaultDueDay || 15
            }]);
            setLoading(false);
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `leads/${leadId}`));
        return () => { unsubLead(); };
    } else {
        // Fetch Client
        const unsubClient = onSnapshot(doc(db, 'clients', id), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const fullData = { ...initialClientState, ...data, id: snap.id };
            setClientData(fullData);
            setOriginalClientData(fullData);
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `clients/${id}`));
        return () => { unsubClient(); };
    }
  }, [id]);

  useEffect(() => {
    if (!id || id.startsWith('lead:')) return;
    setInvoicesLoading(true);
    const q = query(collection(db, 'invoices'), where('clientId', '==', id));
    const unsubInvoices = onSnapshot(q, (snap) => {
      const invs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invs.sort((a: any, b: any) => b.billingMonth.localeCompare(a.billingMonth)));
      setInvoicesLoading(false);
    }, (err) => {
      console.error('Error fetching invoices:', err);
      setInvoicesLoading(false);
    });
    return () => unsubInvoices();
  }, [id]);

  // Property Management
  const addProperty = () => {
    if (properties.length >= limits.maxProperties) {
      logger.log(t('Your current plan only supports one property per client. Upgrade to Pro for multiple locations.'), 'info');
      return;
    }
    setProperties(prev => [...prev, {
      id: 'temp-' + Date.now(),
      name: `Locație Nouă ${prev.length + 1}`,
      address: '',
      contractType: 'maintenance',
      surfaceArea: 0,
      customAreas: [],
      irrigation: { type: 'days', days: [], startTime: '06:00' },
      ziEmitereFactura: orgSettings.defaultInvoiceDay || 1,
      ziScadenta: orgSettings.defaultDueDay || 15
    }]);
    setActivePropertyIndex(properties.length);
  };

  const removeProperty = (index: number) => {
    if (properties.length <= 1) {
      alert("Clientul trebuie să aibă cel puțin o locație.");
      return;
    }
    const prop = properties[index];
    setDeleteConfirm({ type: 'property', index, name: prop.name || `Locație ${index + 1}` });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'property' && deleteConfirm.index !== undefined) {
      const index = deleteConfirm.index;
      const prop = properties[index];
      if (prop.id && !prop.id.startsWith('temp-')) {
        setDeletedPropertyIds(prev => [...prev, prop.id!]);
      }
      const newProps = properties.filter((_, i) => i !== index);
      setProperties(newProps);
      setActivePropertyIndex(Math.max(0, index - 1));
    } else if (deleteConfirm.type === 'area' && deleteConfirm.id) {
      const areaId = deleteConfirm.id;
      const prop = properties[activePropertyIndex];
      const newAreas = (prop.customAreas || []).filter(a => a.id !== areaId);
      const totalSize = newAreas.reduce((sum, a) => sum + Number(a.size || 0), 0);
      
      const newProps = [...properties];
      newProps[activePropertyIndex] = { ...prop, customAreas: newAreas, surfaceArea: totalSize };
      setProperties(newProps);
    }

    setDeleteConfirm(null);
  };

  const moveProperty = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= properties.length) return;

    const newProps = [...properties];
    const temp = newProps[index];
    newProps[index] = newProps[newIndex];
    newProps[newIndex] = temp;
    
    // Update orders
    newProps.forEach((p, i) => {
      p.order = i;
    });

    setProperties(newProps);
    setActivePropertyIndex(newIndex);
  };

  const updateProperty = (index: number, field: keyof Property, value: any) => {
    const newProps = [...properties];
    newProps[index] = { ...newProps[index], [field]: value };
    setProperties(newProps);
  };

  const handleMapsLinkBlur = async (index: number) => {
    const prop = properties[index];
    if (!prop.mapsLink) return;
    
    // If it's already a resolved link with coordinates, no need to re-resolve
    if (prop.latitude && prop.longitude && !prop.mapsLink.includes('goo.gl')) return;

    try {
      const coords = await resolveAndParseMapsLink(prop.mapsLink);
      if (coords) {
        updateProperty(index, 'latitude', coords.lat);
        updateProperty(index, 'longitude', coords.lng);
        logger.log("Coordonate extrase din link!", "success");
      }
    } catch (err) {
      console.error("Error resolving link on blur:", err);
    }
  };

  // Area Management for Active Property
  const handleAddArea = () => {
    const prop = properties[activePropertyIndex];
    const newAreas = [...(prop.customAreas || []), { id: Date.now().toString(), name: '', size: 0 }];
    updateProperty(activePropertyIndex, 'customAreas', newAreas);
  };

  const handleUpdateArea = (areaId: string, field: 'name' | 'size' | 'photoUrl', value: string | number) => {
    const prop = properties[activePropertyIndex];
    const newAreas = (prop.customAreas || []).map(a => a.id === areaId ? { ...a, [field]: value } : a);
    const totalSize = newAreas.reduce((sum, a) => sum + Number(a.size || 0), 0);
    
    const newProps = [...properties];
    newProps[activePropertyIndex] = { ...prop, customAreas: newAreas, surfaceArea: totalSize };
    setProperties(newProps);
  };

  const handleAreaPhotoUpload = async (areaId: string, file: File) => {
    if (!id) {
      alert("Te rugăm să salvezi clientul mai întâi pentru a putea încărca poze.");
      return;
    }
    setIsProcessing(true);
    try {
      const compressedBlob = await compressImage(file);
      const storageRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/clients/${id}/areas/${areaId}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);
      
      // Update local state
      handleUpdateArea(areaId, 'photoUrl', url);

      // Update Firestore immediately if property exists
      const prop = properties[activePropertyIndex];
      if (prop.id && !prop.id.startsWith('temp-')) {
        try {
          const newAreas = (prop.customAreas || []).map(a => a.id === areaId ? { ...a, photoUrl: url } : a);
          await updateDoc(doc(db, 'properties', prop.id), { customAreas: newAreas });
          logger.log(`Poză salvată în baza de date pentru zona ${areaId}`, "success");
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.UPDATE, `properties/${prop.id}`);
          alert("Poza a fost încărcată, dar nu a putut fi salvată în baza de date. Te rugăm să reîncerci.");
        }
      }

      logger.log(`Poză încărcată cu succes`, "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `uploads/${organizationId}/clients/${id}/areas`);
      alert("Eroare la încărcarea pozei: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id) {
      alert("Te rugăm să salvezi clientul mai întâi pentru a putea încărca documente.");
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const newDocs: ClientDocument[] = [...(clientData.documents || [])];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid}/clients/${id}/documents/${Date.now()}_${file.name}`);
        
        try {
          if (file.type.startsWith('image/')) {
            const compressedBlob = await compressImage(file);
            await uploadBytes(storageRef, compressedBlob);
          } else {
            await uploadBytes(storageRef, file);
          }
          
          const url = await getDownloadURL(storageRef);
          
          newDocs.push({
            id: Date.now().toString() + i,
            name: file.name,
            url: url,
            type: file.type.startsWith('image/') ? 'image' : 'pdf',
            size: file.size,
            createdAt: new Date().toISOString()
          });
        } catch (uploadErr) {
          handleFirestoreError(uploadErr, OperationType.WRITE, `uploads/${organizationId}/clients/${id}/documents`);
          alert(`Eroare la încărcarea fișierului ${file.name}.`);
          continue;
        }
      }

      setClientData(prev => ({ ...prev, documents: newDocs }));
      
      // If client already exists, update immediately
      if (id) {
        try {
          await updateDoc(doc(db, 'clients', id), { documents: newDocs });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.UPDATE, `clients/${id}`);
          alert("Documentele au fost încărcate, dar lista nu a putut fi actualizată în baza de date.");
        }
      }
      
      logger.log(`Documente încărcate cu succes`, "success");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `uploads/${organizationId}/clients/${id}/documents`);
      alert("Eroare la încărcarea documentelor: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeDocument = async (docId: string) => {
    const newDocs = (clientData.documents || []).filter(d => d.id !== docId);
    setClientData(prev => ({ ...prev, documents: newDocs }));
    if (id) {
      try {
        await updateDoc(doc(db, 'clients', id), { documents: newDocs });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${id}`);
        alert("Eroare la ștergerea documentului din baza de date.");
      }
    }
  };

  const handleRemoveArea = (areaId: string) => {
    const prop = properties[activePropertyIndex];
    const area = (prop.customAreas || []).find(a => a.id === areaId);
    setDeleteConfirm({ type: 'area', id: areaId, name: area?.name || 'fără nume' });
  };

  // Irrigation Management for Active Property
  const handleIrrigationChange = (field: string, value: any) => {
    const prop = properties[activePropertyIndex];
    const newIrrigation = { ...(prop.irrigation || {}), [field]: value };
    updateProperty(activePropertyIndex, 'irrigation', newIrrigation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return alert("Eroare sesiune: ID Organizație lipsă.");
    
    setIsProcessing(true);
    try {
      // 1. Save Client
      let clientId = id;
      const clientPayload = {
        ...clientData,
        organizationId
      };

      if (clientId) {
        await updateDoc(doc(db, 'clients', clientId), clientPayload);
      } else {
        const clientRef = await addDoc(collection(db, 'clients'), { 
          ...clientPayload, 
          createdAt: serverTimestamp() 
        });
        clientId = clientRef.id;
      }

      // 2. Save Properties
      const batch = writeBatch(db);
      
      // Delete removed properties
      deletedPropertyIds.forEach(delId => {
        batch.delete(doc(db, 'properties', delId));
      });

      let totalSurface = 0;
      let mainAddress = '';
      let mainMapsLink = '';

      // Update/Create properties
      for (let index = 0; index < properties.length; index++) {
        const prop = properties[index];
        const propData: any = {
          ...prop,
          clientId: clientId,
          organizationId: organizationId,
          order: index, // Save order
        };
        delete propData.id; 

        // Synchronize customAreas names to zones string array for backward compatibility
        if (prop.customAreas && prop.customAreas.length > 0) {
          propData.zones = prop.customAreas.map(a => a.name).filter(Boolean);
        }

        // Calculate totals for denormalization
        totalSurface += Number(prop.surfaceArea || 0);
        if (index === 0) {
            mainAddress = prop.address || '';
            mainMapsLink = prop.mapsLink || '';
        }

        // Resolve maps link if present
        if (prop.mapsLink) {
          try {
            const coords = await resolveAndParseMapsLink(prop.mapsLink);
            if (coords) {
              propData.latitude = coords.lat;
              propData.longitude = coords.lng;
            }
          } catch (mapsErr) {
            console.error("Error resolving maps link during submit:", mapsErr);
          }
        }

        if (prop.id && !prop.id.startsWith('temp-')) {
          batch.update(doc(db, 'properties', prop.id), propData);
        } else {
          const newPropRef = doc(collection(db, 'properties'));
          batch.set(newPropRef, { ...propData, createdAt: serverTimestamp() });
        }
      }

      // 3. Update Client with Denormalized Data (for List View performance)
      batch.update(doc(db, 'clients', clientId!), {
          adresa: mainAddress,
          suprafataMp: totalSurface,
          Maps_link: mainMapsLink
      });

      // If marked as inactive, delete future scheduled visits
      if (clientData.status === 'Inactiv' && clientId) {
        try {
          const futureVisitsQuery = query(
            collection(db, 'visits'),
            where('clientId', '==', clientId),
            where('status', 'in', ['Programat', 'Activ'])
          );
          const futureVisitsSnap = await getDocs(futureVisitsQuery);
          futureVisitsSnap.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
        } catch (e) {
          console.error('Error deleting future visits for inactive client:', e);
        }
      }

      await batch.commit();
      logger.log(accountType === 'PF' ? `Grădină salvată: ${clientData.nume}` : `Client salvat: ${clientData.nume}`, "success");
      
      let changes = undefined;
      if (id && originalClientData) {
        changes = computeChanges(originalClientData, clientData, ['updatedAt', 'createdAt', 'id']);
      }

      logAudit({
        userId: auth.currentUser?.uid || '',
        userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Unknown',
        action: id ? AuditAction.UPDATE_CLIENT : AuditAction.CREATE_CLIENT,
        entityType: 'client',
        entityId: clientId,
        details: id ? `Updated client: ${clientData.nume}` : `Created client: ${clientData.nume}`,
        changes,
        organizationId
      });

      if (!isEmbedded) {
        onNavigate(accountType === 'PF' ? Page.ClientPortal : Page.Clients);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, id ? `clients/${id}` : 'clients');
      alert("Eroare la salvare: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeProp = properties[activePropertyIndex] || {};

  const formatBytes = (bytes?: number, decimals = 2) => {
    if (bytes === undefined || !+bytes) return '';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };
  const handleEditInvoiceClick = (inv: any) => {
    setEditingInvoiceId(inv.id);
    setEditingInvoiceData({ amount: inv.amount || 0, status: inv.status || 'unpaid' });
  };

  const handleSaveInvoice = async (invId: string) => {
    try {
      await updateDoc(doc(db, 'invoices', invId), {
        amount: editingInvoiceData.amount,
        status: editingInvoiceData.status,
        updatedAt: serverTimestamp()
      });
      setEditingInvoiceId(null);
      logger.log(t('Invoice updated successfully'), 'success');
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      alert(t('Error updating invoice'));
    }
  };

  const handleDeleteInvoice = async (invId: string) => {
    if (confirm(t('Are you sure you want to delete this invoice?'))) {
      setIsDeletingInvoice(invId);
      try {
        await deleteDoc(doc(db, 'invoices', invId));
        logger.log(t('Invoice deleted successfully'), 'success');
      } catch (err: any) {
        console.error('Error deleting invoice:', err);
        alert(t('Error deleting invoice'));
      } finally {
        setIsDeletingInvoice(null);
      }
    }
  };

  const removeDiacritics = (str: string) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i').replace(/ș/g, 's').replace(/ț/g, 't').replace(/Ă/g, 'A').replace(/Â/g, 'A').replace(/Î/g, 'I').replace(/Ș/g, 'S').replace(/Ț/g, 'T');
  };

  const handleDownloadInvoice = (inv: any) => {
    try {
      const doc = new jsPDF();
      
      const series = inv.invoiceSeries || 'GDX';
      const num = inv.invoiceNumber || String(new Date(inv.createdAt?.toMillis ? inv.createdAt.toMillis() : Date.now()).getTime()).slice(-5);
      const invoiceFullNumber = `${series}-${num.toString().padStart(4, '0')}`;
      
      const issueDate = inv.createdAt?.toMillis ? format(new Date(inv.createdAt.toMillis()), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');
      
      // Antet Factura
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text(`FACTURA`, 14, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Seria si Numarul: `, 14, 35);
      doc.setFont('helvetica', 'bold');
      doc.text(invoiceFullNumber, 45, 35);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Data emiterii: `, 14, 41);
      doc.setFont('helvetica', 'bold');
      doc.text(issueDate, 38, 41);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Perioada facturata: `, 14, 47);
      doc.setFont('helvetica', 'bold');
      doc.text(inv.billingMonth, 45, 47);

      // Linie despartitoare
      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 53, 196, 53);

      // Date Client
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('CUMPARATOR:', 14, 63);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const clientName = removeDiacritics(clientData.nume || clientData.numeFirma || 'Nespecificat');
      doc.text(`Nume: ${clientName}`, 14, 70);
      
      if (clientData.cui || clientData.cnp) {
        doc.text(`CUI/CNP: ${clientData.cui || clientData.cnp}`, 14, 76);
      }
      if (clientData.regCom) {
        doc.text(`Reg. Com: ${clientData.regCom}`, 14, 82);
      }
      if (clientData.adresa) {
        doc.text(`Adresa: ${removeDiacritics(clientData.adresa)}`, 14, clientData.regCom ? 88 : 82);
      }

      // Tabel Servicii
      const startY = clientData.adresa ? (clientData.regCom ? 98 : 92) : 88;
      
      autoTable(doc, {
        startY: startY,
        head: [['Denumire Serviciu', 'U.M.', 'Cantitate', 'Pret Unitar (RON)', 'Valoare (RON)']],
        body: [
          [`Servicii intretinere spatii verzi - ${inv.billingMonth}`, 'luna', '1', inv.amount.toString(), inv.amount.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10 },
      });

      // Total
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL DE PLATA: ${inv.amount} RON`, 120, finalY);
      
      const statusText = inv.status === 'paid' ? 'ACHITAT' : (inv.status === 'overdue' ? 'RESTANT' : 'NEACHITAT');
      doc.setFontSize(11);
      doc.setTextColor(inv.status === 'paid' ? 39 : 200, inv.status === 'paid' ? 174 : 50, inv.status === 'paid' ? 96 : 50);
      doc.text(`STATUS: ${statusText}`, 120, finalY + 8);
      
      doc.save(`Factura_${invoiceFullNumber}_${clientName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('Eroare la generarea PDF-ului.');
    }
  };

  const handleAddInvoice = async () => {
    const defaultAmount = properties.reduce((acc, p) => acc + Number(p.tarifLunar || 0), 0) + Number(clientData.tarifLunar || 0);
    const billingMonth = format(new Date(), 'yyyy_MM');
    const series = orgSettings.name ? orgSettings.name.substring(0, 3).toUpperCase() : 'GDX';
    const invoiceNumber = invoices.length + 1; // Auto-increment pentru clientul acesta
    try {
      await addDoc(collection(db, 'invoices'), {
        organizationId,
        clientId: id,
        clientName: clientData.nume || clientData.numeFirma || 'Nespecificat',
        billingMonth,
        amount: defaultAmount,
        status: 'unpaid',
        invoiceSeries: series,
        invoiceNumber: invoiceNumber,
        createdAt: serverTimestamp(),
      });
      logger.log(t('Invoice generated successfully'), 'success');
    } catch (err) {
      console.error('Error adding invoice:', err);
      alert('Eroare la crearea facturii.');
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {!isEmbedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-blue-500/10 via-transparent to-transparent p-4 md:p-6 md:min-h-[104px] rounded-3xl border border-blue-500/20 mb-6 shadow-sm gap-4">
          <div className="flex items-center gap-4 md:gap-5">
            {accountType !== 'PF' && (
              <button onClick={() => onNavigate(Page.Clients)} className="w-10 h-10 md:w-12 md:h-12 bg-bg-card border border-border-color rounded-2xl flex items-center justify-center text-text-secondary hover:text-blue-500 hover:border-blue-500/30 transition-all shadow-sm shrink-0">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
            
            {accountType === 'PF' && (
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-300 shrink-0">
                <Sprout className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-blue-500 uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-main tracking-tight leading-tight mb-1">
                {accountType === 'PF' ? t('My Garden') : (id ? t('Edit Client Profile') : t('Register Client'))}
              </h1>
              <p className="text-text-secondary text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                {accountType === 'PF' ? t('Garden Configuration') : t('Client Management')}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-6">
        
        {/* --- LEFT COLUMN: CLIENT DATA --- */}
        {accountType !== 'PF' && (
        <div className="flex-[2] min-w-[min(100%,550px)] space-y-6">
          {/* --- SECTION 1: EDIT CLIENT DATA --- */}
          <section className="stihl-card rounded-lg p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('general')}
              className="w-full flex items-center justify-between p-3 md:p-4 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
                <User size={14} />
                {accountType === 'PF' ? t('Garden Details') : t('Edit client data')}
              </h3>
              {expandedSections.general ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
            </button>
            
            {expandedSections.general && (
              <div className="p-3 md:p-4 pt-0 space-y-3 border-t border-border-color">
                {accountType !== 'PF' && (
                  <div className="flex bg-bg-main p-1 rounded-md border border-border-color h-8">
                    <button type="button" onClick={() => setClientData({...clientData, tip_persoana: 'PF'})} className={`flex-1 rounded-sm text-[11px] font-bold uppercase transition-all ${clientData.tip_persoana === 'PF' ? 'bg-accent-color text-white' : 'text-text-secondary'}`}>Persoană Fizică</button>
                    <button type="button" onClick={() => setClientData({...clientData, tip_persoana: 'PJ'})} className={`flex-1 rounded-sm text-[11px] font-bold uppercase transition-all ${clientData.tip_persoana === 'PJ' ? 'bg-accent-color text-white' : 'text-text-secondary'}`}>Persoană Juridică</button>
                  </div>
                )}

                {clientData.tip_persoana === 'PJ' && accountType !== 'PF' ? (
                  <div className="space-y-3 animate-in fade-in">
                    {/* Row 1: Denumire Firmă, Nume Reprezentant */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Denumire Firmă</label>
                        <input type="text" className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs font-bold text-main focus:border-accent-color transition-colors" value={clientData.numeFirma ?? ''} onChange={e => setClientData({...clientData, numeFirma: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Nume Reprezentant</label>
                        <input type="text" required className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs font-bold text-main focus:border-accent-color transition-colors" value={clientData.nume ?? ''} onChange={e => setClientData({...clientData, nume: e.target.value})} />
                      </div>
                    </div>
                    {/* Row 2: CUI / RO, Nr. Reg. Com */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">CUI / RO</label>
                        <input type="text" className={`w-full bg-bg-main border rounded-md px-3 py-1.5 outline-none text-xs text-main focus:border-accent-color transition-colors ${clientData.roFirma && !/^(RO)?\d{2,10}$/i.test(clientData.roFirma) ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-border-color'}`} value={clientData.roFirma ?? ''} onChange={e => setClientData({...clientData, roFirma: e.target.value.toUpperCase()})} placeholder="Ex: RO12345678" />
                        {clientData.roFirma && !/^(RO)?\d{2,10}$/i.test(clientData.roFirma) && <span className="text-[10px] text-red-500 font-bold ml-1">Format CUI invalid</span>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Nr. Reg. Com</label>
                        <input type="text" className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs text-main focus:border-accent-color transition-colors" value={clientData.regCom ?? ''} onChange={e => setClientData({...clientData, regCom: e.target.value.toUpperCase()})} placeholder="Ex: J12/345/2023" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in">
                    {/* Row 1: Nume */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Nume</label>
                      <input type="text" required className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs font-bold text-main focus:border-accent-color transition-colors" value={clientData.nume ?? ''} onChange={e => setClientData({...clientData, nume: e.target.value})} />
                    </div>
                    {/* Row 2: CNP */}
                    {accountType !== 'PF' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">CNP</label>
                        <input type="text" className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs text-main focus:border-accent-color transition-colors" value={clientData.cnp ?? ''} onChange={e => setClientData({...clientData, cnp: e.target.value})} />
                      </div>
                    )}
                  </div>
                )}

                {/* Row 3: Telefon (30%), Adresă Email (30%), Plată (20%), Status (20%) */}
                <div className="grid grid-cols-1 md:grid-cols-10 gap-3">
                   <div className="md:col-span-3 space-y-1">
                     <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Telefon</label>
                    <input type="text" required className={`w-full bg-bg-main border rounded-md px-3 py-1.5 outline-none text-xs text-main focus:border-accent-color transition-colors ${clientData.telefon && !/^(\+40|0)[0-9]{9}$/.test(clientData.telefon.replace(/[^0-9+]/g, '')) ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-border-color'}`} value={clientData.telefon ?? ''} onChange={e => setClientData({...clientData, telefon: e.target.value.replace(/[^0-9+\s-]/g, '')})} placeholder="07XX XXX XXX" />
                    {clientData.telefon && !/^(\+40|0)[0-9]{9}$/.test(clientData.telefon.replace(/[^0-9+]/g, '')) && <span className="text-[10px] text-red-500 font-bold ml-1">Format telefon invalid</span>}
                  </div>
                   <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Adresă Email</label>
                    <input type="email" className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs text-main focus:border-accent-color transition-colors" value={clientData.email ?? ''} onChange={e => setClientData({...clientData, email: e.target.value})} />
                  </div>
                   <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Plată Pref.</label>
                    <select className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs font-bold text-main focus:border-accent-color transition-colors" value={clientData.preferredPayment ?? 'card'} onChange={e => setClientData({...clientData, preferredPayment: e.target.value as any})}>
                      <option value="card">Card/Cont</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                   <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider ml-1">Status</label>
                    <select className="w-full bg-bg-main border border-border-color rounded-md px-3 py-1.5 outline-none text-xs font-bold text-main focus:border-accent-color transition-colors" value={clientData.status ?? 'Activ'} onChange={e => setClientData({...clientData, status: e.target.value as any})}>
                      <option value="Activ">Activ</option>
                      <option value="Inactiv">Inactiv</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        )}

        {/* --- RIGHT COLUMN: DOSAR CLIENT --- */}
        {accountType !== 'PF' && (
        <div className="flex-[1] min-w-[min(100%,200px)] space-y-6">
        {/* --- SECTION 4: DOCUMENTS --- */}
        <section className="stihl-card rounded-lg p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('documents')}
            className="w-full flex items-center justify-between p-4 md:p-6 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
              <FileText size={14} /> Dosar Client (Documente & Poze)
            </h3>
            <div className="flex items-center gap-3">
              <label 
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-accent-color/10 text-accent-color px-3 py-1.5 rounded-sm hover:bg-accent-color/20 transition-colors cursor-pointer"
                onClick={e => e.stopPropagation()}
              >
                <Upload size={12} /> Încarcă Fișier
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,.pdf" 
                  className="hidden" 
                  onChange={handleDocumentUpload}
                  disabled={!id || isProcessing}
                />
              </label>
              {expandedSections.documents ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
            </div>
          </button>
          
          {expandedSections.documents && (
            <div className="p-4 md:p-6 pt-0 space-y-4 border-t border-border-color">

          {!id && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-[11px] text-yellow-600 dark:text-yellow-400 font-bold">⚠️ Salvează clientul mai întâi pentru a putea încărca documente.</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {clientData.documents?.map(doc => (
              <div key={doc.id} className="relative group bg-bg-main border border-border-color rounded-lg overflow-hidden flex flex-col">
                <div className="h-24 bg-bg-card flex items-center justify-center relative">
                  {doc.type === 'image' ? (
                    <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                  ) : (
                    <File size={32} className="text-text-secondary" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </a>
                    <button type="button" onClick={() => removeDocument(doc.id)} className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-main truncate" title={doc.name}>{doc.name}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[9px] text-text-secondary">{doc.createdAt && !isNaN(new Date(doc.createdAt).getTime()) ? format(new Date(doc.createdAt), 'dd/MM/yyyy') : ''}</p>
                    {doc.size && <span className="text-[9px] text-accent-color font-bold bg-accent-color/10 px-1 py-0.5 rounded">{formatBytes(doc.size, 0)}</span>}
                  </div>
                </div>
              </div>
            ))}
            {(!clientData.documents || clientData.documents.length === 0) && id && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-border-color rounded-lg">
                <FileText size={24} className="mx-auto text-text-secondary/50 mb-2" />
                <p className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">Niciun document încărcat</p>
              </div>
            )}
            </div>
            </div>
          )}
        </section>

        {/* --- SECTION 5: VIRTUAL INVOICES --- */}
        <section className="stihl-card rounded-lg p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('invoices')}
            className="w-full flex items-center justify-between p-4 md:p-6 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
              <FileText size={14} /> Facturi
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold bg-accent-color/10 text-accent-color px-2 py-1 rounded-sm">{invoices.length} facturi</span>
              {expandedSections.invoices ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
            </div>
          </button>
          
          {expandedSections.invoices && (
            <div className="p-4 md:p-6 pt-0 space-y-4 border-t border-border-color">
              {!id && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-[11px] text-yellow-600 dark:text-yellow-400 font-bold">⚠️ Salvează clientul mai întâi pentru a putea vedea facturile.</p>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] text-text-secondary font-bold uppercase">Istoric Facturi</p>
                <button
                  type="button"
                  onClick={handleAddInvoice}
                  disabled={!id}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-sm hover:bg-blue-500/20 transition-colors"
                >
                  <Plus size={12} /> ADAUGĂ FACTURĂ
                </button>
              </div>

              {invoicesLoading ? (
                <div className="flex justify-center p-4">
                  <div className="w-5 h-5 border-2 border-accent-color/30 border-t-accent-color rounded-full animate-spin"></div>
                </div>
              ) : invoices.length === 0 && id ? (
                <div className="py-8 text-center border-2 border-dashed border-border-color rounded-lg">
                  <FileText size={24} className="mx-auto text-text-secondary/50 mb-2" />
                  <p className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">Nicio factură emisă</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-bg-main border border-border-color rounded-lg hover:border-accent-color/50 transition-colors gap-3">
                      {editingInvoiceId === inv.id ? (
                        <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div>
                            <p className="text-[11px] font-bold text-main">
                              Factură {inv.invoiceSeries || 'GDX'}-{inv.invoiceNumber ? String(inv.invoiceNumber).padStart(4, '0') : String(new Date(inv.createdAt?.toMillis ? inv.createdAt.toMillis() : Date.now()).getTime()).slice(-5)} 
                              <span className="text-text-secondary font-normal ml-1">({inv.billingMonth})</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-24 bg-bg-card border border-border-color rounded px-2 py-1 outline-none text-xs text-main"
                              value={editingInvoiceData.amount}
                              onChange={e => setEditingInvoiceData({...editingInvoiceData, amount: Number(e.target.value)})}
                            />
                            {/* We removed the status select here so they can only edit the amount */}
                          </div>
                          <div className="flex items-center gap-2 sm:ml-auto">
                            <button type="button" onClick={() => handleSaveInvoice(inv.id)} className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded hover:bg-emerald-500/20">Salvează</button>
                            <button type="button" onClick={() => setEditingInvoiceId(null)} className="text-[10px] font-bold bg-text-secondary/10 text-text-secondary px-2 py-1 rounded hover:bg-text-secondary/20">Anulează</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-[11px] font-bold text-main">
                              Factură {inv.invoiceSeries || 'GDX'}-{inv.invoiceNumber ? String(inv.invoiceNumber).padStart(4, '0') : String(new Date(inv.createdAt?.toMillis ? inv.createdAt.toMillis() : Date.now()).getTime()).slice(-5)} 
                              <span className="text-text-secondary font-normal ml-1">({inv.billingMonth})</span>
                            </p>
                            <p className="text-[10px] text-text-secondary mt-0.5">{inv.amount} RON</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                              inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                              inv.status === 'overdue' ? 'bg-red-500/10 text-red-500' :
                              'bg-amber-500/10 text-amber-500'
                            }`}>
                              {inv.status}
                            </span>
                            
                            {/* Action Buttons */}
                            <button type="button" onClick={() => handleDownloadInvoice(inv)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Descarcă PDF">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            
                            {inv.status !== 'paid' && (
                              <>
                                <button type="button" onClick={() => handleEditInvoiceClick(inv)} className="p-1.5 text-accent-color hover:bg-accent-color/10 rounded transition-colors" title="Editează">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button type="button" onClick={() => handleDeleteInvoice(inv.id)} disabled={isDeletingInvoice === inv.id} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50" title="Șterge">
                                  {isDeletingInvoice === inv.id ? <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div> : <Trash2 size={14} />}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        </div>
        )}

        {/* --- FULL WIDTH: LOCATIONS (MULTI-TAB) --- */}
        <div className="w-full space-y-6">
        <section className="stihl-card rounded-lg p-0 overflow-hidden border border-border-color">
          {accountType !== 'PF' && (
            <button
              type="button"
              onClick={() => toggleSection('locations')}
              className="w-full flex items-center justify-between p-4 bg-transparent border-b border-border-color hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
               <h3 className="text-xs font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
                 <Home size={14} /> {t('Locations')}
               </h3>
               <div className="flex items-center gap-3">
                 <div onClick={(e) => { e.stopPropagation(); addProperty(); }} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-accent-color/10 text-accent-color px-3 py-1.5 rounded-sm hover:bg-accent-color/20 transition-colors cursor-pointer">
                   <Plus size={12} /> {t('Add Property')}
                 </div>
                 {expandedSections.locations ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
               </div>
            </button>
          )}

          {expandedSections.locations && (
            <div>

          {/* MODERN LOCATION TABS */}
          {accountType !== 'PF' && (
          <div className="flex gap-3 p-4 border-b border-border-color bg-bg-main overflow-x-auto custom-scrollbar">
            {properties.map((prop, idx) => (
              <div
                key={prop.id || idx}
                onClick={() => setActivePropertyIndex(idx)}
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  activePropertyIndex === idx 
                    ? 'bg-accent-color text-white border-accent-color shadow-md shadow-accent-color/20' 
                    : 'bg-bg-card text-text-secondary border-border-color hover:border-accent-color/50 hover:text-main'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activePropertyIndex === idx ? 'bg-white/20' : 'bg-bg-main'}`}>
                  <MapPin size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold whitespace-nowrap">{prop.name || `Locație ${idx + 1}`}</span>
                  {activePropertyIndex === idx && <span className="text-[11px] uppercase tracking-wider opacity-80">Locația curentă</span>}
                </div>
                
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/20 dark:border-black/20">
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); moveProperty(idx, 'left'); }}
                    disabled={idx === 0}
                    className={`p-1 rounded transition-colors ${
                      idx === 0 ? 'opacity-30 cursor-not-allowed' : (activePropertyIndex === idx ? 'hover:bg-white/20' : 'hover:bg-black/5 dark:hover:bg-white/5')
                    }`}
                    title="Mută la stânga"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); moveProperty(idx, 'right'); }}
                    disabled={idx === properties.length - 1}
                    className={`p-1 rounded transition-colors ${
                      idx === properties.length - 1 ? 'opacity-30 cursor-not-allowed' : (activePropertyIndex === idx ? 'hover:bg-white/20' : 'hover:bg-black/5 dark:hover:bg-white/5')
                    }`}
                    title="Mută la dreapta"
                  >
                    <ChevronRight size={14} />
                  </button>
                  
                  {properties.length > 1 && (
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); removeProperty(idx); }} 
                      className={`ml-1 p-1 rounded transition-colors ${
                        activePropertyIndex === idx 
                          ? 'hover:bg-red-500/80 text-white' 
                          : 'hover:bg-red-500/10 text-red-500'
                      }`}
                      title="Șterge locația"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="p-6 space-y-8 bg-bg-card">

            
            {false ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* Elegant Unified Header for Garden Name */}
                <div className="bg-gradient-to-br from-accent-color/5 to-transparent p-8 rounded-3xl border border-accent-color/10">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-accent-color rounded-2xl flex items-center justify-center text-white shadow-lg shadow-accent-color/20">
                         <User size={24} />
                      </div>
                      <div>
                         <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent-color mb-1">Numele Grădinii</h4>
                         <input 
                           type="text" 
                           required 
                           placeholder="Ex: Grădina Mea de Vis"
                           className="text-3xl font-black text-main bg-transparent border-none p-0 outline-none placeholder:opacity-20 w-full" 
                           value={clientData.nume ?? ''} 
                           onChange={e => setClientData({...clientData, nume: e.target.value})} 
                         />
                      </div>
                   </div>
                </div>

                {/* Zones Section with refined layout */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
                        <MapPin size={14} className="text-accent-color" />
                        Zonele Grădinii
                      </h4>
                      <span className="text-[11px] font-bold text-text-secondary opacity-40 uppercase tracking-widest">{activeProp.zones?.length || 0} Zone active</span>
                   </div>
                   
                   <div className="bg-bg-main/50 rounded-3xl p-6 border border-border-color">
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Configurare Zone (Separă prin virgulă)</label>
                        <textarea 
                          className="w-full bg-bg-main border border-border-color rounded-2xl px-6 py-4 text-sm font-bold text-main outline-none focus:border-accent-color transition-all min-h-[100px] shadow-inner"
                          placeholder="Ex: Gazon Față, Livadă, Grădină Legume, Piscină"
                          value={activeProp.zones ? activeProp.zones.join(', ') : ''} 
                          onChange={e => updateProperty(activePropertyIndex, 'zones', e.target.value.split(',').map(s => s.trim()))} 
                        />
                        <p className="text-[11px] text-text-secondary italic px-2 opacity-60">Aceste zone vor fi disponibile pentru logarea activităților în Jurnal.</p>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* LEFT COLUMN: Detalii Locație + Zone & Suprafață + Sistem Irigații */}
                  <div className="space-y-6">
                    {/* 1. Detalii Locație */}
                    {accountType !== 'PF' && (
                      <div className="space-y-4 bg-bg-main/30 p-5 rounded-2xl border border-border-color/50">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-accent-color mb-4 flex items-center gap-2">
                           <Map size={12} /> Detalii Locație
                         </h4>
                         <div className="space-y-1">
                           <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1">
                             <Tag size={10} /> Nume Locație
                           </label>
                           <input 
                             type="text" 
                             className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-sm font-bold text-main focus:border-accent-color" 
                             value={activeProp.name ?? ''} 
                             onChange={e => updateProperty(activePropertyIndex, 'name', e.target.value)} 
                             placeholder="Ex: Sediu, Depozit, Casă Vacanță..."
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1">
                             <MapPin size={10} /> Adresă Fizică
                           </label>
                           <input type="text" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-sm font-bold text-main focus:border-accent-color" value={activeProp.address ?? ''} onChange={e => updateProperty(activePropertyIndex, 'address', e.target.value)} />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1">
                             <Navigation size={10} /> Link Google Maps
                           </label>
                           <input 
                             type="text" 
                             className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-xs text-main focus:border-accent-color" 
                             value={activeProp.mapsLink ?? ''} 
                             onChange={e => updateProperty(activePropertyIndex, 'mapsLink', e.target.value)} 
                             onBlur={() => handleMapsLinkBlur(activePropertyIndex)}
                             placeholder="https://maps.google.com/..." 
                           />
                           {(activeProp.latitude || activeProp.longitude) && (
                             <p className="text-[11px] text-text-secondary mt-1">Coordonate: {activeProp.latitude}, {activeProp.longitude}</p>
                           )}
                         </div>
                      </div>
                    )}

                     {/* 2. Zone & Suprafață */}
                     <div className="space-y-4 bg-bg-main/30 p-5 rounded-2xl border border-border-color/50">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[11px] font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
                           <Ruler size={12} /> Zone & Suprafață
                         </h4>
                         <button type="button" onClick={handleAddArea} className="text-[11px] font-bold uppercase tracking-wider bg-accent-color/10 text-accent-color px-2 py-1 rounded-sm hover:bg-accent-color/20">+ Zonă</button>
                       </div>

                       <div className="space-y-2">
                         {activeProp.customAreas?.map((area, idx) => (
                           <div key={area.id} className="flex items-center gap-2 bg-bg-main p-2 rounded-md border border-border-color">
                             <input type="text" className="flex-1 bg-transparent outline-none text-xs font-bold text-main placeholder:text-text-secondary/50" value={area.name ?? ''} onChange={e => handleUpdateArea(area.id, 'name', e.target.value)} placeholder="Nume Zonă" />
                             <div className="flex items-center gap-1 bg-bg-card px-2 py-1 rounded border border-border-color">
                               <input type="number" className="w-12 bg-transparent outline-none text-xs font-bold text-main text-right" value={area.size ?? ''} onChange={e => handleUpdateArea(area.id, 'size', Number(e.target.value))} placeholder="0" />
                               <span className="text-[11px] text-text-secondary font-bold">m²</span>
                             </div>
                             
                             <label className="cursor-pointer text-text-secondary hover:text-accent-color" title={t('Add Photo')}>
                               <ImageIcon size={14} />
                               <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleAreaPhotoUpload(area.id, e.target.files[0])} />
                             </label>
                             {area.photoUrl && (
                               <a href={area.photoUrl} target="_blank" rel="noreferrer" className="text-accent-color hover:text-accent-color/80" title="Vezi poza">
                                 <ImageIcon size={14} />
                               </a>
                             )}

                             <button type="button" onClick={() => handleRemoveArea(area.id)} className="text-text-secondary hover:text-red-500"><Trash2 size={12} /></button>
                           </div>
                         ))}
                       </div>
                       
                       <div className="mt-4 flex items-center justify-between bg-bg-main p-3 rounded-md border border-border-color">
                         <span className="text-xs font-bold text-text-secondary uppercase">Suprafață Totală:</span>
                         <span className="text-sm font-black text-accent-color">{activeProp.surfaceArea || 0} m²</span>
                       </div>
                     </div>

                     {/* 3. Sistem Irigații */}
                     <div className="space-y-4 bg-bg-main/30 p-5 rounded-2xl border border-border-color/50">
                       <h4 className="text-[11px] font-black uppercase tracking-widest text-accent-color flex items-center gap-2 mb-4">
                         <Droplets size={12} /> Sistem Irigații
                       </h4>
                       
                       <div className="space-y-3">
                         <div className="space-y-1">
                           <select 
                             className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1.5 text-xs font-bold"
                             value={activeProp.irrigation?.program ?? ''} 
                             onChange={e => handleIrrigationChange('program', e.target.value)}
                           >
                             <option value="">Nu are sistem automat</option>
                             <option value="specific_days">Zile Specifice</option>
                             <option value="interval">La Interval</option>
                             <option value="even_days">Zile Pare</option>
                             <option value="odd_days">Zile Impare</option>
                           </select>
                         </div>

                         {activeProp.irrigation?.program === 'specific_days' && (
                           <div className="space-y-2 p-2 bg-bg-main rounded-md border border-border-color animate-in fade-in">
                             <label className="text-[11px] font-bold text-text-secondary uppercase">Alege Zilele</label>
                             <div className="grid grid-cols-4 gap-1">
                               {['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'].map((day, index) => (
                                 <button 
                                   type="button"
                                   key={day}
                                   onClick={() => {
                                     const currentDays = activeProp.irrigation?.days || [];
                                     const newDays = currentDays.includes(index) 
                                       ? currentDays.filter(d => d !== index)
                                       : [...currentDays, index];
                                     handleIrrigationChange('days', newDays.sort());
                                   }}
                                   className={`px-1 py-1 text-[11px] font-bold rounded-md transition-colors ${activeProp.irrigation?.days?.includes(index) ? 'bg-accent-color text-white' : 'bg-bg-card hover:bg-border-color'}`}
                                 >
                                   {day}
                                 </button>
                               ))}
                             </div>
                           </div>
                         )}

                         {activeProp.irrigation?.program === 'interval' && (
                           <div className="grid grid-cols-2 gap-2 p-2 bg-bg-main rounded-md border border-border-color animate-in fade-in">
                             <div className="space-y-1">
                               <label className="text-[11px] font-bold text-text-secondary uppercase">Interval (zile)</label>
                               <input 
                                 type="number" 
                                 className="w-full bg-bg-card border border-border-color rounded-md px-2 py-1.5 text-xs font-bold"
                                 placeholder="Ex: 3"
                                 value={activeProp.irrigation?.interval ?? ''}
                                 onChange={e => handleIrrigationChange('interval', parseInt(e.target.value, 10))}
                               />
                             </div>
                             <div className="space-y-1">
                               <label className="text-[11px] font-bold text-text-secondary uppercase">Dată Start</label>
                               <input 
                                 type="date" 
                                 className="w-full bg-bg-card border border-border-color rounded-md px-2 py-1.5 text-xs font-bold"
                                 value={activeProp.irrigation?.startDate ?? ''}
                                 onChange={e => handleIrrigationChange('startDate', e.target.value)}
                               />
                             </div>
                           </div>
                         )}

                         {(activeProp.irrigation?.program === 'even_days' || activeProp.irrigation?.program === 'odd_days') && (
                           <div className="p-2 bg-bg-main rounded-md border border-border-color animate-in fade-in">
                             <p className="text-[11px] text-text-secondary font-medium">Sistemul va porni în zilele calendaristice {activeProp.irrigation.program === 'even_days' ? 'pare' : 'impare'}.</p>
                           </div>
                         )}

                         <div className="space-y-1 pt-2 border-t border-border-color">
                           <label className="text-[11px] font-bold text-text-secondary uppercase">Ora Pornire</label>
                           <input 
                             type="time" 
                             className={`w-full bg-bg-main border border-border-color rounded-md px-2 py-1.5 text-xs font-bold ${!activeProp.irrigation?.program ? 'opacity-50 cursor-not-allowed' : ''}`} 
                             value={activeProp.irrigation?.startTime ?? '06:00'} 
                             onChange={e => handleIrrigationChange('startTime', e.target.value)} 
                             disabled={!activeProp.irrigation?.program}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[11px] font-bold text-text-secondary uppercase">Notițe Irigații</label>
                           <textarea 
                             className="w-full bg-bg-main border border-border-color rounded-md px-2 py-1.5 text-xs font-bold" 
                             value={activeProp.irrigation?.notes ?? ''} 
                             onChange={e => handleIrrigationChange('notes', e.target.value)} 
                             maxLength={200}
                             rows={4}
                           />
                         </div>
                       </div>
                     </div>
                  </div>

                  {/* RIGHT COLUMN: Contract & Financiar */}
                  <div className="space-y-6">
                    {/* 4. Contract & Financiar */}
                    {accountType !== 'PF' && (
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-accent-color flex items-center gap-2 mb-4">
                          Contract & Financiar
                        </h4>
                        
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Tip Contract</label>
                              <div className="flex bg-bg-main p-1 rounded-md border border-border-color h-10">
                                <button type="button" onClick={() => updateProperty(activePropertyIndex, 'contractType', 'maintenance')} className={`flex-1 rounded-sm text-[11px] font-bold uppercase transition-all ${activeProp.contractType === 'maintenance' ? 'bg-accent-color text-white' : 'text-text-secondary'}`}>{t('Maintenance')}</button>
                                <button type="button" onClick={() => updateProperty(activePropertyIndex, 'contractType', 'one-time')} className={`flex-1 rounded-sm text-[11px] font-bold uppercase transition-all ${activeProp.contractType === 'one-time' ? 'bg-accent-color text-white' : 'text-text-secondary'}`}>Lucrare Unică</button>
                              </div>
                            </div>

                            {activeProp.contractType === 'maintenance' && (
                              <div className="space-y-1 animate-in fade-in">
                                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">{t('Frequency')}</label>
                                <select 
                                  className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-sm font-bold text-main focus:border-accent-color"
                                  value={activeProp.maintenanceFrequency ?? 'weekly'}
                                  onChange={e => updateProperty(activePropertyIndex, 'maintenanceFrequency', e.target.value)}
                                >
                                  <option value="weekly">Săptămânal (7 zile)</option>
                                  <option value="biweekly">La 2 săptămâni (14 zile)</option>
                                  <option value="monthly">Lunar (30 zile)</option>
                                  <option value="occasional">Ocazional</option>
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-color">
                            <div className="space-y-1">
                              {activeProp.contractType === 'maintenance' && activeProp.maintenanceFrequency === 'occasional' ? (
                                <>
                                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    Tarif standard intervenție
                                  </label>
                                  <input type="number" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" value={activeProp.tarifInterventie ?? ''} onChange={e => updateProperty(activePropertyIndex, 'tarifInterventie', Number(e.target.value))} placeholder="Opțional" />
                                </>
                              ) : (
                                <>
                                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">
                                    {activeProp.contractType === 'one-time' ? 'Cost Lucrare' : 'Tarif lunar'}
                                  </label>
                                  <input type="number" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" value={activeProp.tarifLunar ?? 0} onChange={e => updateProperty(activePropertyIndex, 'tarifLunar', Number(e.target.value))} />
                                </>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Sold</label>
                              <input type="number" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" value={activeProp.sold ?? 0} onChange={e => updateProperty(activePropertyIndex, 'sold', Number(e.target.value))} />
                            </div>
                          </div>

                          {!(activeProp.contractType === 'maintenance' && activeProp.maintenanceFrequency === 'occasional') && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-color">
                              {activeProp.contractType !== 'one-time' ? (
                                <>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Emitere factură</label>
                                    <input type="number" min="1" max="31" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" value={activeProp.ziEmitereFactura ?? 1} onChange={e => updateProperty(activePropertyIndex, 'ziEmitereFactura', Number(e.target.value))} />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Scadență la (zi)</label>
                                    <input type="number" min="1" max="31" className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" value={activeProp.ziScadenta ?? 15} onChange={e => updateProperty(activePropertyIndex, 'ziScadenta', Number(e.target.value))} />
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-2 space-y-1">
                                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Dată Scadență</label>
                                  <input 
                                    type="date" 
                                    className="w-full bg-bg-main border border-border-color rounded-md px-4 py-2 outline-none text-lg font-black text-main focus:border-accent-color" 
                                    value={activeProp.dataScadenta ?? ''} 
                                    onChange={e => updateProperty(activePropertyIndex, 'dataScadenta', e.target.value)} 
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {activeProp.contractType === 'maintenance' && activeProp.maintenanceFrequency !== 'occasional' && (
                            <div className="space-y-2 pt-4 border-t border-border-color animate-in fade-in">
                              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">Luni Facturabile</label>
                              <div className="grid grid-cols-4 gap-2">
                                  {Array.from({ length: 12 }, (_, i) => {
                                      const date = new Date();
                                      date.setMonth(i);
                                      const monthName = date.toLocaleString('ro-RO', { month: 'short' });
                                      const isEnabled = activeProp.billableMonths 
                                          ? activeProp.billableMonths.includes(i)
                                          : orgSettings.billableMonths.includes(i);
                                      
                                      return (
                                          <button
                                              key={i}
                                              type="button"
                                              onClick={() => {
                                                  const currentMonths = activeProp.billableMonths || orgSettings.billableMonths;
                                                  const newMonths = isEnabled 
                                                      ? currentMonths.filter(m => m !== i)
                                                      : [...currentMonths, i];
                                                  updateProperty(activePropertyIndex, 'billableMonths', newMonths);
                                              }}
                                              className={`p-2 rounded text-[11px] font-bold uppercase transition-all border ${isEnabled 
                                                  ? 'bg-accent-color text-white border-accent-color' 
                                                  : 'bg-bg-main text-text-secondary border-border-color line-through opacity-50'}`}
                                          >
                                              {monthName}
                                          </button>
                                      );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* --- NEW SECTION: RECOMANDĂRI AGRONOMICE --- */}
      {activeProp.surfaceArea ? (
        <div className="w-full space-y-6">
          <section className="stihl-card rounded-lg p-0 overflow-hidden border border-emerald-500/20 bg-emerald-500/5">
            <button
              type="button"
              onClick={() => toggleSection('recommendations')}
              className="w-full flex items-center justify-between p-4 bg-transparent border-b border-emerald-500/10 hover:bg-emerald-500/10 transition-colors"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Sprout size={14} /> Recomandări Agronomice ({activeProp.name || 'Locație curentă'})
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Smart Guide</span>
                {expandedSections.recommendations ? <ChevronUp size={18} className="text-emerald-600" /> : <ChevronDown size={18} className="text-emerald-600" />}
              </div>
            </button>
            
            {expandedSections.recommendations && (
              <div className="p-4 md:p-6 space-y-4">
                <p className="text-[11px] text-text-secondary font-medium leading-relaxed mb-3">
                  Pentru suprafața totală de <strong className="text-main">{activeProp.surfaceArea} m²</strong>, necesarul recomandat pentru următoarea aplicare este:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-bg-card border border-border-color rounded-lg p-4 shadow-sm text-center relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full -z-10 blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                    <span className="block text-[11px] text-text-secondary font-bold uppercase tracking-wider mb-1">Mentenanță (Primăvară / Toamnă)</span>
                    <span className="block text-2xl font-black text-emerald-600">{(activeProp.surfaceArea * 0.03).toFixed(1)} kg</span>
                    <span className="block text-[10px] text-text-secondary mt-1">Dozaj: 30g/m²</span>
                  </div>
                  <div className="bg-bg-card border border-border-color rounded-lg p-4 shadow-sm text-center relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full -z-10 blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                    <span className="block text-[11px] text-text-secondary font-bold uppercase tracking-wider mb-1">Regenerare / Starter</span>
                    <span className="block text-2xl font-black text-amber-600">{(activeProp.surfaceArea * 0.025).toFixed(1)} kg</span>
                    <span className="block text-[10px] text-text-secondary mt-1">Dozaj: 25g/m²</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      </form>

      {/* Action Buttons */}
      <div className="bg-bg-card/95 border border-border-color rounded-2xl p-6 mt-8 flex flex-col sm:flex-row items-center justify-end gap-4 shadow-sm">
        <button type="button" onClick={() => onNavigate(accountType === 'PF' ? Page.ClientPortal : Page.Clients)} className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-main transition-colors bg-bg-main hover:bg-bg-card border border-border-color rounded-xl">Anulează</button>
        <button 
          onClick={handleSubmit}
          disabled={isProcessing}
          className="w-full sm:w-auto bg-accent-color text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent-color/90 transition-all flex justify-center items-center gap-2 disabled:opacity-50 shadow-lg shadow-accent-color/20"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Se salvează...
            </>
          ) : (
            accountType === 'PF' ? 'Salvează Grădina' : 'Salvează Client'
          )}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-bg-card border border-border-color rounded-2xl shadow-2xl max-w-md w-full p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">Confirmare Ștergere</h3>
            </div>
            
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              Ești sigur că vrei să ștergi {deleteConfirm.type === 'property' ? 'locația' : 'zona'} <span className="font-bold text-main">"{deleteConfirm.name}"</span>? 
              {deleteConfirm.type === 'property' && " Această acțiune va șterge toate datele asociate acestei locații."} Această acțiune este ireversibilă.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-main transition-colors"
              >
                Anulează
              </button>
              <button 
                onClick={confirmDelete}
                className="bg-red-500 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Șterge definitiv
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientForm;

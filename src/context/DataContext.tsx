
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, collection, query, where, onSnapshot, doc, limit, addDoc } from '../../services/firebase';
import { Client, Visit, Property, ServiceType, UserProfile, PotentialClient, GardenTask } from '../types';

interface DataContextType {
  clients: Client[];
  visits: Visit[];
  properties: Property[];
  leads: PotentialClient[];
  serviceTypes: ServiceType[];
  organization: any;
  loading: boolean;
  activeVisit: Visit | null;
  employees: UserProfile[];
  products: any[];
  gardenTasks: GardenTask[];
  globalSystemConfig: any;
  isExpertMode: boolean;
  setIsExpertMode: (val: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode; organizationId: string | null }> = ({ children, organizationId }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<PotentialClient[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [gardenTasks, setGardenTasks] = useState<GardenTask[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [organization, setOrganization] = useState<any>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [globalSystemConfig, setGlobalSystemConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isExpertMode, setIsExpertMode] = useState(() => {
    try {
      const item = window.localStorage.getItem('isExpertMode');
      return item ? JSON.parse(item) : false;
    } catch (error) {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('isExpertMode', JSON.stringify(isExpertMode));
    } catch (error) {
      console.error('Failed to save expert mode preference:', error);
    }
  }, [isExpertMode]);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubClients = onSnapshot(query(collection(db, 'clients'), where('organizationId', '==', organizationId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(items);
    });

    const unsubVisits = onSnapshot(query(
      collection(db, 'visits'), 
      where('organizationId', '==', organizationId)
    ), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));
      setVisits(items);
      const active = items.find(v => v.status === 'Activ');
      setActiveVisit(active || null);
    });

    const unsubProps = onSnapshot(query(collection(db, 'properties'), where('organizationId', '==', organizationId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      setProperties(items);
    });

    const unsubLeads = onSnapshot(query(collection(db, 'leads'), where('organizationId', '==', organizationId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as PotentialClient));
      setLeads(items);
    });

    const employeesQuery = query(collection(db, 'users'), where('organizationId', '==', organizationId));
    const unsubEmployees = onSnapshot(employeesQuery, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubServices = onSnapshot(query(collection(db, 'service_types'), where('organizationId', '==', organizationId)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceType));
      if (items.length === 0) {
        const defaults = [
          { name: 'Tuns Gazon', unit: 'mp', cost: 0, isDefault: true, isActive: true, order: 0, organizationId },
          { name: 'Aplicare ingrasamant solid', unit: 'mp', cost: 0, isDefault: true, isActive: true, order: 1, organizationId }
        ];
        defaults.forEach(async (s) => {
          await addDoc(collection(db, 'service_types'), {
            ...s,
            createdAt: new Date()
          });
        });
      }
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      setServiceTypes(items);
    });

    const unsubOrg = onSnapshot(doc(db, 'organizations', organizationId), (snap) => {
      if (snap.exists()) {
        setOrganization({ id: snap.id, ...snap.data() });
      }
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('organizationId', '==', organizationId)), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubGardenTasks = onSnapshot(query(collection(db, 'garden_tasks'), where('organizationId', '==', organizationId)), (snap) => {
      setGardenTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as GardenTask)));
    });

    const unsubGlobalConfig = onSnapshot(doc(db, 'system_config', 'global'), (snap) => {
      if (snap.exists()) {
        setGlobalSystemConfig(snap.data());
      }
    });

    // Complete loading after first results
    setLoading(false);

    return () => {
      unsubClients();
      unsubVisits();
      unsubProps();
      unsubLeads();
      unsubEmployees();
      unsubServices();
      unsubOrg();
      unsubProducts();
      unsubGardenTasks();
      unsubGlobalConfig();
    };
  }, [organizationId]);

  return (
    <DataContext.Provider value={{ clients, visits, properties, leads, serviceTypes, organization, loading, activeVisit, employees, products, gardenTasks, globalSystemConfig, isExpertMode, setIsExpertMode }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

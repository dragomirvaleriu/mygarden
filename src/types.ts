
export interface Organization {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  adminUid: string;
  createdAt: any;
  accentColors?: string[]; // Array of 5 hex colors
  contractTypeColors?: { maintenance: string; oneTime: string; inactive: string };
  defaultFertilizerDosage?: number; // 25, 30, or 35
  billableMonths?: number[]; // Array of month indices (0-11) that are billable by default
  defaultInvoiceDay?: number;
  defaultDueDay?: number;
  workDays?: 'L-V' | 'L-S' | 'L-D';
  startTime?: string;
  endTime?: string;
  /** @deprecated Use subscriptionTier instead */
  plan?: 'free' | 'pro' | 'enterprise';
  planExpires?: any;
  trialExpiresAt?: any;
  isLifetime?: boolean;
  /** @deprecated Use subscriptionTier instead */
  licenseType?: 'free' | 'basic' | 'pro';

  // New Billing Fields
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionProduct?: 'adFree' | 'academyPro' | 'bundle';
  subscriptionExpiresAt?: any; // timestamp
  
  // Legal & Financial
  cui?: string;
  regCom?: string;
  iban?: string;
  banca?: string;
  
  // Contact & Sediu Social
  localitate?: string;
  judet?: string;
  codPostal?: string;
  email?: string;
  website?: string;
  activeViewsDesktop?: string[];
  activeViewsMobile?: string[];
  status?: 'active' | 'inactive' | 'suspended' | 'cancelled';
}

export interface SubscriptionProduct {
  id: string;
  name: string;
  price: number;
  features: string[];
  description?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  organizationId?: string;
  role: 'user' | 'admin' | 'employee' | 'superadmin';
  theme: 'light' | 'dark';
  language?: string;
  employeeCode?: string; // Added employee code
  accentColor?: string; // Selected accent color
  clientsViewMode?: 'list' | 'map';
  clientsCompactView?: boolean;
  kanbanShowPastDays?: boolean;
  clientsStatusFilter?: string;
  clientsSearchTerm?: string;
  leadsStatusFilter?: string;
  leadsSearchTerm?: string;
  clientsShowBadPayersOnly?: boolean;
  clientsActiveTab?: 'clients' | 'leads';
  accountType?: 'PF' | 'PJ';
  mobile_viewMode?: 'list' | 'agenda' | 'kanban' | 'route' | 'guide';
  lastLoginAt?: any;
  desktop_viewMode?: 'list' | 'agenda' | 'kanban' | 'route' | 'guide';
  teamManagementActiveTab?: 'members' | 'chat' | 'timesheets';
  exp?: number;
  level?: number;
  subscriptionProduct?: 'adFree' | 'academyPro' | 'bundle';
  subscriptionExpiresAt?: any; // timestamp
  referralCode?: string; // own shareable code, server-generated
  referredBy?: string; // referral code captured at signup, if any
  referralBonusApplied?: boolean; // guards against double-granting on repeat purchases
  referralCount?: number; // server-incremented count of successful referrals
}

export interface AppNotification {
  id: string;
  type: 'purchase' | 'giftcode' | 'referral';
  title: string;
  message: string;
  actionPage?: Page;
  read: boolean;
  createdAt: any;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: 'employee';
  status: 'pending' | 'accepted';
  code: string;
  invitedBy: string;
}

export interface WorkSession {
  start: any;
  end?: any;
  duration?: number;
}

export interface TimeLog {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: any; // timestamp
  endTime?: any; // timestamp
  breaks: { start: any; end?: any; durationMinutes?: number }[];
  totalWorkMinutes?: number;
  overtimeMinutes?: number;
  status: 'working' | 'on_break' | 'finished';
  autoClosed?: boolean;
  isManual?: boolean;
  location?: { lat: number; lng: number };
  addedBy?: string; // For auditing manual entries
  addedAt?: any; // For auditing manual entries
}

export interface ServiceType {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  unit?: string;
  order?: number;
  cost?: number;
  isActive?: boolean;
  category?: 'watering' | 'mowing' | 'fertilizing' | 'pruning' | 'treatment' | 'other';
}

export interface Visit {
  id: string;
  organizationId: string;
  clientId: string;
  clientName?: string;
  propertyId?: string;
  propertyAddress?: string;
  clientAddress?: string;
  propertyMapsLink?: string;
  nextVisitScheduled?: boolean;
  latitude?: number;
  longitude?: number;
  data: string;
  originalData?: string;
  reprogrammed?: boolean;
  oraProgramare?: string;
  oraInceput?: string; // Ora de start a vizitei (HH:MM)
  oraSfarsit?: string; // Ora de sfârșit a vizitei (HH:MM)
  tipLucrare: string;
  detalii: string;
  status: 'Programat' | 'Activ' | 'Finalizat' | 'Anulat';
  createdAt: any;
  currentSessionStart?: any;
  workSessions?: WorkSession[];
  servicii_efectuate?: Array<{serviceId: string, name: string, quantity?: number, unit?: string}>;
  assignedTo?: string; // Employee ID or Code
  assignedToName?: string; // Employee Name/Email
  photos?: string[]; // URLs of photos uploaded for this visit
  finishNote?: string;
  checkinCoordinates?: { latitude: number, longitude: number };
  completedAt?: any; // Added completedAt
  estimatedDuration?: number; // Added estimatedDuration
  interventieCost?: number; // Added for one-time costs
  interventieIncasata?: boolean; // Added for one-time payments
  autoScheduledNextVisitId?: string | null;
  orderIndex?: number; // Added for route optimization persistence
}

export interface Property {
  id: string;
  clientId: string;
  organizationId: string;
  name: string; // e.g., "Locație Principală", "Sediu", "Casă Vacanță"
  address: string;
  mapsLink?: string;
  surfaceArea: number; // suprafataMp
  customAreas?: { 
    id: string; 
    name: string; 
    size: number; 
    photoUrl?: string;
    tipSol?: 'Nisipos' | 'Argilos' | 'Mixt';
    expunereSoare?: 'Plin' | 'Umbră' | 'Semi-umbră';
  }[];
  canvasData?: any;
  irrigation?: {
    type: 'days' | 'interval' | 'even_odd';
    days?: number[]; // Changed from string[] to number[] based on usage (0-6)
    interval?: number;
    evenOdd?: 'even' | 'odd';
    startTime?: string;
    program?: string; // Added program
    startDate?: string; // Added startDate
    notes?: string; // Added notes
  };
  latitude?: number;
  longitude?: number;
  suprafataMp?: number;
  sold?: number;
  zones?: string[];
  dataScadenta?: string;
  // Financial and Contract Fields (Moved from Client)
  contractType?: 'maintenance' | 'one-time' | 'project';
  maintenanceFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'occasional';
  tarifLunar?: number;
  tarifInterventie?: number;
  ziEmitereFactura?: number;
  ziScadenta?: number;
  billableMonths?: number[]; // Override organization defaults
  order?: number; // Added for manual sorting
  wateringStatus?: 'delayed_by_rain' | 'active' | string; // Irrigation controller status
  lastWeatherAlert?: string; // Last weather alert message
  seedingModeUntil?: any; // Added seedingModeUntil
  lastSolidFertilizerDate?: any;
  lastBilledMonth?: string; // Format: YYYY-MM
}

export interface ClientDocument {
  id: string;
  name: string;
  url: string;
  type: string; // 'image' or 'pdf'
  size?: number;
  createdAt: any;
}

export interface Client {
  id: string;
  organizationId: string;
  codClient: string;
  nume: string;
  email?: string;
  tip_persoana: 'PF' | 'PJ';
  adresa?: string; // Deprecated: Moved to Property
  telefon: string;
  tarifLunar?: number; // Deprecated: Moved to Property
  sold?: number; // Deprecated: Moved to Property
  suprafataMp?: number; // Deprecated: Moved to Property
  status: 'Activ' | 'Inactiv' | 'Rău Platnic';
  cnp?: string;
  numeFirma?: string;
  roFirma?: string;
  regCom?: string;
  banca?: string;
  iban?: string;
  data_facturare?: number;
  creditBalance?: number;
  Maps_link?: string; // Deprecated: Moved to Property
  areaSqm?: number; // Deprecated
  areas?: { id: string; name: string; size: number }[]; // Deprecated: Moved to Property
  irrigation?: { // Deprecated: Moved to Property
    type: 'days' | 'interval' | 'even_odd';
    days?: number[];
    interval?: number;
    evenOdd?: 'even' | 'odd';
    startTime?: string;
    program?: string;
    startDate?: string;
  };
  contractType?: 'maintenance' | 'one-time' | 'project'; // Deprecated: Moved to Property
  maintenanceFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'occasional'; // Deprecated: Moved to Property
  documents?: ClientDocument[];
  portalLink?: string;
  ziEmitereFactura?: number; // Deprecated: Moved to Property
  ziScadenta?: number; // Deprecated: Moved to Property
  dataScadenta?: string; // Deprecated: Moved to Property
  lastBilledMonth?: string; // Format: YYYY-MM
  billableMonths?: number[]; // Deprecated: Moved to Property
  order?: number; // For manual sorting
  latitude?: number;
  longitude?: number;
  propertyCount?: number;
  preferredPayment?: 'card' | 'cash';
  lastSolidFertilizerDate?: any;
}

export interface ServiceRecord {
  id: string;
  date: any;
  type: string;
  description: string;
  cost?: number;
}

export interface Equipment {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  purchaseDate: any;
  value: number;
  status: 'operational' | 'in_service' | 'retired';
  cost?: number;
  serviceHistory?: ServiceRecord[];
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  category: 'consumable' | 'equipment'; // Added category
  stock: number;
  unit: string;
  dosagePerSqm?: number; // Optional for equipment
  minStock?: number;
}

export interface PaymentAllocation {
  invoiceId: string;
  billingMonth: string;
  amount: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  propertyId: string;
  organizationId: string;
  billingMonth: string; // e.g., "2026-03" or "Istoric"
  amount: number;
  remainingAmount: number;
  status: 'unpaid' | 'partially_paid' | 'paid';
  createdAt: any;
}

export interface ClientHistory {
  id: string;
  clientId: string;
  organizationId: string;
  visitId?: string;
  propertyId?: string;
  propertyName?: string;
  type: 'visit_completion' | 'payment' | 'activity' | 'ai_diagnosis' | 'billing';
  activityType?: string;
  date: any;
  performedByName?: string;
  services?: Array<{ name: string; quantity?: string; unit?: string }>;
  photos?: Array<{ url: string; date: string }>;
  startTime?: any;
  duration?: number;
  details?: string;
  note?: string;
  amount?: number;
  hidden?: boolean;
  allocations?: PaymentAllocation[];
}

export enum Page {
  Dashboard = 'dashboard',
  Clients = 'clients',
  Schedule = 'schedule',
  Administration = 'administration',
  Services = 'services',
  Logs = 'logs',
  ClientForm = 'client-form',
  Details = 'details',
  Registru = 'registru',
  RoutePlanner = 'route-planner',
  ClientPortal = 'client-portal',
  Equipment = 'equipment',
  Reports = 'reports',
  AuditTrail = 'audit-trail',
  SuperAdmin = 'super-admin',
  Billing = 'billing',
  CareCalendar = 'care-calendar',
  GardenJournal = 'garden-journal',

  Gallery = 'gallery',
  Academy = 'academy',
  Tools = 'tools',
  GardenSetup = 'garden-setup',
  Timesheets = 'timesheets',
  Explore = 'explore'
}

export type PaymentHistory = ClientHistory;

export interface PotentialClient {
  id: string;
  organizationId: string;
  telefon: string;
  nume?: string;
  adresa: string;
  data: string;
  notite?: string;
  status: 'activ' | 'vizualizat' | 'ofertat' | 'confirmat' | 'convertit' | 'pierdut';
  nextActionDate?: string;
  notes?: { id: string; date: string; note: string; author: string }[];
  lostReason?: string;
  estimatedValue?: number;
}

export interface GardenTask {
  id: string;
  userId: string;
  organizationId: string;
  propertyId: string;
  category: 'watering' | 'mowing' | 'fertilizing' | 'pruning' | 'treatment' | 'other' | 'tuns' | 'ingrasamant solid' | 'foliare';
  title: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'one-time' | 'custom';
  intervalDays?: number;
  lastCompleted?: any; // timestamp
  nextDue: any; // timestamp
  status: 'pending' | 'completed';
  notes?: string;
  history?: { date: any; note?: string }[];
}

export interface UserPlant {
  id: string;
  userId: string;
  organizationId: string;
  catalogId: string;
  name: string;
  emoji: string;
  type: 'interior' | 'exterior';
  addedAt: any; // timestamp
}

export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  company: string;
  discountPercent?: number;
  isActive: boolean;
  createdAt: any;
  createdBy: string;
  expiresAt?: any;
}

export interface GiftCode {
  id: string;
  code: string;
  product: 'adFree' | 'academyPro' | 'bundle';
  days: number;
  used: boolean;
  usedBy?: string;
  usedByEmail?: string;
  usedAt?: any;
  createdBy: string;
  createdAt: any;
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Gift,
  BarChart3,
  Megaphone,
  Loader2,
  Search,
  Copy,
  Trash2,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  X,
  Check,
  TrendingUp,
  DollarSign,
  UserPlus,
  Ticket,
  MousePointerClick,
  Eye,
  Ban,
  Plus,
  ScrollText,
  ShieldPlus,
  ShieldMinus,
  UserX,
} from 'lucide-react';
import { Card, Pill } from '../components/ui/primitives';
import { db, functions, httpsCallable, doc, getDoc, collection, getDocs, deleteDoc } from '../services/firebase';
import toast from 'react-hot-toast';
import { UserProfile, Advertisement } from '../src/types';

interface Props {
  userProfile: UserProfile;
}

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  subscriptionProduct?: string;
  subscriptionExpiresAt?: any;
  createdAt?: any;
  lastLoginAt?: any;
  organizationId?: string;
  // The legacy free/pro/enterprise tier — this is what usePlan() actually
  // reads (from organizations/{orgId}), not subscriptionProduct. A user can
  // have a legacy 'enterprise' org and no subscriptionProduct at all, which
  // is why those two fields can legitimately disagree.
  orgSubscriptionTier?: string;
  orgSubscriptionProduct?: string;
  orgPlanExpires?: any;
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  details: Record<string, any>;
  at: string | null;
}

interface GiftCodeRow {
  code: string;
  product: string | null;
  days: number | null;
  used: boolean;
  usedBy: string | null;
  createdAt: string | null;
  usedAt: string | null;
}

interface AnalyticsPayload {
  totalUsers: number;
  adFree: number;
  academyPro: number;
  bundle: number;
  legacyPaid: number;
  free: number;
  totalRevenue: number;
  paidCount: number;
  arpu: number;
  conversionRate: number;
  activePlans: number;
  giftedCount: number;
  grantedCount: number;
  purchasedByProduct: Record<string, number>;
  giftCodesTotal: number;
  giftCodesRedeemed: number;
  signups: { month: string; count: number }[];
}

// The three sellable products, and what each is worth. Mirrors
// GRANTABLE_PRODUCTS in functions/src/index.ts — keep the two in sync.
const PRODUCTS = [
  { id: 'adFree', label: 'Fără reclame', price: 2, tone: 'water' as const, hex: '#3b82f6' },
  { id: 'academyPro', label: 'Academy Pro', price: 2, tone: 'accent' as const, hex: '#a855f7' },
  { id: 'bundle', label: 'Pachet complet', price: 3, tone: 'success' as const, hex: '#10b981' },
];

const productLabel = (id?: string | null) => PRODUCTS.find(p => p.id === id)?.label ?? id ?? '—';

// Presentation for each action recorded by logAudit() in functions/src/index.ts.
// Keep the key set in sync with the `action` strings passed there.
const AUDIT_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: 'success' | 'warn' | 'danger' | 'accent' }> = {
  grant_subscription: { label: 'Abonament acordat', icon: ShieldPlus, tone: 'success' },
  revoke_subscription: { label: 'Abonament anulat', icon: ShieldMinus, tone: 'warn' },
  delete_user: { label: 'Cont șters', icon: UserX, tone: 'danger' },
  create_gift_code: { label: 'Cod cadou generat', icon: Ticket, tone: 'accent' },
  delete_gift_code: { label: 'Cod cadou șters', icon: Trash2, tone: 'warn' },
};

const auditDetailLine = (entry: AuditEntry): string => {
  const d = entry.details || {};
  switch (entry.action) {
    case 'grant_subscription':
      return `${productLabel(d.product)} → ${d.targetEmail ?? d.targetUid} (${d.durationMonths ? d.durationMonths + ' luni' : 'pe viață'})`;
    case 'revoke_subscription':
      return `${d.targetEmail ?? d.targetUid}`;
    case 'delete_user':
      return `${d.targetEmail ?? d.targetUid}${d.deletedOrganization ? ' · organizație ștearsă' : ''}`;
    case 'create_gift_code':
      return `${d.code} · ${productLabel(d.product)} · ${d.days} zile`;
    case 'delete_gift_code':
      return `${d.code}`;
    default:
      return JSON.stringify(d);
  }
};

// Mirrors usePlan()'s resolution: prefer the legacy org tier when it grants
// more than the new product system does, since that's what the rest of the
// app (sidebar badge, feature gates) actually treats the user as having.
function getEffectivePlan(user: UserData, superadminEmail: string): { label: string; tone: 'neutral' | 'accent' | 'water' | 'success' | 'warn' } {
  if (user.email === superadminEmail) return { label: 'Enterprise (dev)', tone: 'accent' };
  if (user.orgSubscriptionTier === 'enterprise') return { label: 'Enterprise', tone: 'accent' };
  if (user.orgSubscriptionTier === 'lifetime') return { label: 'Pe viață', tone: 'success' };

  const product = user.orgSubscriptionProduct ?? user.subscriptionProduct;
  const match = PRODUCTS.find(p => p.id === product);
  if (match) return { label: match.label, tone: match.tone };

  if (user.orgSubscriptionTier === 'pro') return { label: 'Pro (legacy)', tone: 'warn' };
  return { label: 'Gratuit', tone: 'neutral' };
}

const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDate = (v: any) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

const initials = (user: UserData) =>
  (user.displayName?.trim() || user.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('');

// A user who never logged in again after signup, or hasn't in 60+ days, is a
// reasonable candidate to prune — this threshold only drives the "Inactivi"
// filter chip, it never deletes anything by itself.
const INACTIVE_DAYS = 60;
const daysSince = (v: any): number | null => {
  const d = toDate(v);
  return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null;
};
const isInactiveUser = (user: UserData): boolean => {
  const since = daysSince(user.lastLoginAt ?? user.createdAt);
  return since === null || since >= INACTIVE_DAYS;
};

// ─── Small building blocks ───────────────────────────────────────────────

const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({
  open,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg bg-bg-card border border-border-color rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 px-6 py-4 bg-bg-card/95 backdrop-blur border-b border-border-color">
          <h3 className="text-sm font-black uppercase tracking-widest text-main">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="p-1.5 rounded-lg text-text-secondary hover:text-main hover:bg-bg-main transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accent?: string;
}> = ({ label, value, hint, icon: Icon, accent = 'var(--accent-color)' }) => (
  <Card padding="none" className="p-5 relative overflow-hidden">
    <div
      className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-[0.07] pointer-events-none"
      style={{ background: accent }}
    />
    <div className="flex items-start justify-between gap-3 mb-3">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-secondary">{label}</p>
      <Icon size={16} className="shrink-0" style={{ color: accent }} />
    </div>
    <p className="text-3xl font-black text-main leading-none tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-text-secondary mt-2">{hint}</p>}
  </Card>
);

const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2" aria-hidden>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-16 rounded-xl bg-bg-main animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
    ))}
  </div>
);

const EmptyState: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  hint?: string;
}> = ({ icon: Icon, title, hint }) => (
  <div className="text-center py-14">
    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-bg-main flex items-center justify-center">
      <Icon size={24} className="text-text-secondary" />
    </div>
    <p className="text-sm font-bold text-main">{title}</p>
    {hint && <p className="text-xs text-text-secondary mt-1">{hint}</p>}
  </div>
);

// ─── Charts (inline SVG — no chart library, no extra bundle weight) ──────

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="20" className="stroke-bg-main" />
        {total > 0 &&
          data.map(d => {
            if (d.value === 0) return null;
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                strokeWidth="20"
                stroke={d.color}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-main rotate-90 text-[22px] font-black"
          style={{ transformOrigin: '80px 80px' }}
        >
          {total}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="fill-text-secondary rotate-90 text-[9px] font-bold uppercase tracking-wider"
          style={{ transformOrigin: '80px 80px' }}
        >
          conturi
        </text>
      </svg>
      <ul className="flex-1 w-full space-y-2">
        {data.map(d => (
          <li key={d.label} className="flex items-center gap-2.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-text-secondary flex-1 truncate">{d.label}</span>
            <span className="font-black text-main tabular-nums">{d.value}</span>
            <span className="text-text-secondary/60 tabular-nums w-11 text-right">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SignupChart: React.FC<{ data: { month: string; count: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="flex items-end gap-1.5 h-40" role="img" aria-label="Înscrieri în ultimele 12 luni">
      {data.map(d => {
        const pct = (d.count / max) * 100;
        const [y, m] = d.month.split('-');
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 group min-w-0">
            <span className="text-[10px] font-black text-main tabular-nums opacity-0 group-hover:opacity-100 transition">
              {d.count}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-md bg-accent-color/70 group-hover:bg-accent-color transition-all min-h-[3px]"
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${d.month}: ${d.count}`}
              />
            </div>
            <span className="text-[9px] font-bold text-text-secondary uppercase tabular-nums">
              {m}/{y.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const RevenueBars: React.FC<{ data: { label: string; count: number; revenue: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.revenue));
  return (
    <div className="space-y-4">
      {data.map(d => (
        <div key={d.label}>
          <div className="flex items-baseline justify-between mb-1.5 text-xs">
            <span className="text-text-secondary font-medium">{d.label}</span>
            <span className="font-black text-main tabular-nums">
              ${d.revenue}
              <span className="text-text-secondary/60 font-bold ml-1.5">({d.count})</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-bg-main overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.revenue / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Ad create form ──────────────────────────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl bg-bg-main border border-border-color text-sm text-main placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-color focus:ring-2 focus:ring-accent-color/20 transition';

const CreateAdForm: React.FC<{ onAdCreated: () => void }> = ({ onAdCreated }) => {
  const [formData, setFormData] = useState({ title: '', company: '', imageUrl: '', link: '', discountPercent: 0 });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await httpsCallable(functions, 'createAd')(formData);
      toast.success('Reclamă creată!');
      setFormData({ title: '', company: '', imageUrl: '', link: '', discountPercent: 0 });
      onAdCreated();
    } catch (err: any) {
      toast.error('Nu am putut crea reclama: ' + (err?.message || 'eroare necunoscută'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Titlu reclamă" value={formData.title} required
          onChange={e => setFormData({ ...formData, title: e.target.value })} />
        <input className={inputCls} placeholder="Companie" value={formData.company} required
          onChange={e => setFormData({ ...formData, company: e.target.value })} />
        <input className={inputCls} type="url" placeholder="URL imagine" value={formData.imageUrl} required
          onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} />
        <input className={inputCls} type="url" placeholder="Link (cu cod de afiliere)" value={formData.link} required
          onChange={e => setFormData({ ...formData, link: e.target.value })} />
        <input className={inputCls} type="number" min={0} max={100} placeholder="Reducere (%)"
          value={formData.discountPercent}
          onChange={e => setFormData({ ...formData, discountPercent: parseInt(e.target.value) || 0 })} />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-accent-color text-accent-text text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        Publică reclama
      </button>
    </form>
  );
};

// ─── Main panel ──────────────────────────────────────────────────────────

type Tab = 'users' | 'gifting' | 'ads' | 'analytics' | 'audit';

const SuperAdmin: React.FC<Props> = ({ userProfile }) => {
  const isSuperAdmin = userProfile.role === 'superadmin' || userProfile.email === 'dragomirvaleriu@gmail.com';

  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [giftCodes, setGiftCodes] = useState<GiftCodeRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAds, setLoadingAds] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'paid' | 'free' | 'inactive'>('all');

  // Grant modal
  const [grantTarget, setGrantTarget] = useState<UserData | null>(null);
  const [grantProduct, setGrantProduct] = useState<string>('bundle');
  const [grantDuration, setGrantDuration] = useState<1 | 3 | 12 | null>(12);
  const [granting, setGranting] = useState(false);

  // Gift code generator
  const [giftProduct, setGiftProduct] = useState('adFree');
  const [giftDays, setGiftDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // ── Data loading ──

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const userData: UserData[] = usersSnap.docs.map(snap => {
        const data = snap.data();
        return {
          uid: snap.id,
          email: data.email,
          displayName: data.displayName,
          subscriptionProduct: data.subscriptionProduct,
          subscriptionExpiresAt: data.subscriptionExpiresAt,
          createdAt: data.createdAt,
          lastLoginAt: data.lastLoginAt,
          organizationId: data.organizationId,
        };
      });

      // Join each user to their org — usePlan() resolves the app-wide plan
      // from organizations/{orgId}, so without this join the table would show
      // a plan that disagrees with the badge the user actually sees.
      const orgIds = Array.from(new Set(userData.map(u => u.organizationId).filter(Boolean))) as string[];
      const orgEntries = await Promise.all(
        orgIds.map(async orgId => {
          try {
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            return [orgId, orgSnap.exists() ? orgSnap.data() : null] as const;
          } catch {
            return [orgId, null] as const;
          }
        })
      );
      const orgMap = new Map(orgEntries);
      userData.forEach(u => {
        const org = u.organizationId ? orgMap.get(u.organizationId) : null;
        u.orgSubscriptionTier = org?.subscriptionTier;
        u.orgSubscriptionProduct = org?.subscriptionProduct;
        u.orgPlanExpires = org?.planExpires;
      });

      userData.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
      setUsers(userData);
    } catch (err: any) {
      toast.error('Nu am putut încărca utilizatorii: ' + err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadAds = useCallback(async () => {
    setLoadingAds(true);
    try {
      const adsSnap = await getDocs(collection(db, 'superadmin/data/ads'));
      setAds(adsSnap.docs.map(s => ({ id: s.id, ...s.data() }) as Advertisement));
    } catch (err: any) {
      toast.error('Nu am putut încărca reclamele: ' + err.message);
    } finally {
      setLoadingAds(false);
    }
  }, []);

  const loadGiftCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const res: any = await httpsCallable(functions, 'listGiftCodes')({ limit: 100 });
      setGiftCodes(res.data.codes || []);
    } catch (err: any) {
      toast.error('Nu am putut încărca codurile: ' + (err?.message || 'eroare'));
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res: any = await httpsCallable(functions, 'getAdminAnalytics')({});
      setAnalytics(res.data);
    } catch (err: any) {
      toast.error('Nu am putut încărca statisticile: ' + (err?.message || 'eroare'));
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const loadAuditLog = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res: any = await httpsCallable(functions, 'listAuditLog')({ limit: 100 });
      setAuditEntries(res.data.entries || []);
    } catch (err: any) {
      toast.error('Nu am putut încărca jurnalul: ' + (err?.message || 'eroare'));
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, loadUsers]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (activeTab === 'ads' && !ads.length) loadAds();
    if (activeTab === 'gifting' && !giftCodes.length) loadGiftCodes();
    if (activeTab === 'analytics' && !analytics) loadAnalytics();
    if (activeTab === 'audit' && !auditEntries.length) loadAuditLog();
  }, [activeTab, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──

  const grantSubscription = async () => {
    if (!grantTarget) return;
    setGranting(true);
    try {
      await httpsCallable(functions, 'grantSubscription')({
        userId: grantTarget.uid,
        product: grantProduct,
        durationMonths: grantDuration,
      });
      toast.success(
        `${productLabel(grantProduct)} activat pentru ${grantTarget.email}` +
          (grantDuration ? ` (${grantDuration} luni)` : ' (pe viață)')
      );
      setGrantTarget(null);
      await loadUsers();
      if (analytics) loadAnalytics();
    } catch (err: any) {
      toast.error('Nu am putut acorda abonamentul: ' + (err?.message || 'eroare necunoscută'));
    } finally {
      setGranting(false);
    }
  };

  const revokeSubscription = async (user: UserData) => {
    setBusyUserId(user.uid);
    try {
      await httpsCallable(functions, 'revokeSubscription')({ userId: user.uid });
      toast.success(`Abonamentul lui ${user.email} a fost anulat.`);
      await loadUsers();
      if (analytics) loadAnalytics();
    } catch (err: any) {
      toast.error('Nu am putut anula abonamentul: ' + (err?.message || 'eroare'));
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (user: UserData) => {
    setBusyUserId(user.uid);
    try {
      await httpsCallable(functions, 'deleteUserAccount')({ userId: user.uid });
      setUsers(prev => prev.filter(u => u.uid !== user.uid));
      toast.success(`Contul ${user.email} a fost șters definitiv.`);
      if (analytics) loadAnalytics();
    } catch (err: any) {
      toast.error('Nu am putut șterge contul: ' + (err?.message || 'eroare'));
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmDelete = (user: UserData) => {
    toast(
      t => (
        <div className="flex flex-col gap-1">
          <div className="font-bold text-sm">Ștergi definitiv acest cont?</div>
          <div className="text-xs opacity-80 break-all">{user.email}</div>
          <div className="text-[11px] opacity-70 mt-1">
            Se șterg și grădina, jurnalul și pozele. Acțiunea nu poate fi anulată.
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                deleteUser(user);
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition"
            >
              Da, șterge
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-1 bg-slate-500 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition"
            >
              Anulează
            </button>
          </div>
        </div>
      ),
      { duration: 12000 }
    );
  };

  const generateGiftCode = async () => {
    setGenerating(true);
    try {
      const res: any = await httpsCallable(functions, 'createGiftCode')({ product: giftProduct, days: giftDays });
      if (res.data?.success) {
        setLastCode(res.data.code);
        toast.success('Cod generat!');
        loadGiftCodes();
      }
    } catch (err: any) {
      toast.error('Nu am putut genera codul: ' + (err?.message || 'eroare'));
    } finally {
      setGenerating(false);
    }
  };

  const deleteGiftCode = async (code: string) => {
    try {
      await httpsCallable(functions, 'deleteGiftCode')({ code });
      setGiftCodes(prev => prev.filter(c => c.code !== code));
      toast.success('Cod șters.');
    } catch (err: any) {
      toast.error('Nu am putut șterge codul: ' + (err?.message || 'eroare'));
    }
  };

  const deleteAd = async (adId: string) => {
    try {
      await deleteDoc(doc(db, 'superadmin', 'data', 'ads', adId));
      setAds(prev => prev.filter(a => a.id !== adId));
      toast.success('Reclamă ștearsă.');
    } catch (err: any) {
      toast.error('Nu am putut șterge reclama: ' + err.message);
    }
  };

  const seedAds = async () => {
    setSeeding(true);
    try {
      const res: any = await httpsCallable(functions, 'seedDefaultAds')({});
      toast.success(`${res.data.count} reclame adăugate!`);
      loadAds();
    } catch (err: any) {
      toast.error('Nu am putut adăuga reclamele: ' + (err?.message || 'eroare'));
    } finally {
      setSeeding(false);
    }
  };

  const copy = (text: string, what = 'Copiat') => {
    navigator.clipboard.writeText(text);
    toast.success(what);
  };

  // ── Derived ──

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter(u => {
      if (q && !(u.email?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q))) return false;
      if (planFilter === 'all') return true;
      if (planFilter === 'inactive') return u.email !== userProfile.email && isInactiveUser(u);
      const isPaid = getEffectivePlan(u, userProfile.email).tone !== 'neutral';
      return planFilter === 'paid' ? isPaid : !isPaid;
    });
  }, [users, searchTerm, planFilter, userProfile.email]);

  const headlineStats = useMemo(() => {
    const paying = users.filter(u => {
      const p = getEffectivePlan(u, userProfile.email);
      return p.tone !== 'neutral' && u.email !== userProfile.email;
    }).length;
    const inactive = users.filter(u => u.email !== userProfile.email && isInactiveUser(u)).length;
    return { total: users.length, paying, free: users.length - paying, inactive };
  }, [users, userProfile.email]);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-6">
        <Card className="max-w-sm text-center">
          <ShieldAlert size={32} className="mx-auto mb-3 text-red-500" />
          <h1 className="text-lg font-black text-main mb-1">Acces restricționat</h1>
          <p className="text-sm text-text-secondary">Această zonă este rezervată administratorului produsului.</p>
        </Card>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'users', label: 'Utilizatori', icon: Users },
    { id: 'gifting', label: 'Coduri cadou', icon: Gift },
    { id: 'ads', label: 'Reclame', icon: Megaphone },
    { id: 'analytics', label: 'Statistici', icon: BarChart3 },
    { id: 'audit', label: 'Jurnal', icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-bg-main">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-bg-main/85 backdrop-blur-lg border-b border-border-color">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-xl bg-accent-color/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-accent-color" />
                </div>
                <h1 className="text-2xl font-black text-main tracking-tight">Panou administrare</h1>
              </div>
              <p className="text-xs text-text-secondary">
                {headlineStats.total} conturi · {headlineStats.paying} plătitori · {headlineStats.free} gratuite
              </p>
            </div>
            <button
              onClick={() => {
                loadUsers();
                if (activeTab === 'ads') loadAds();
                if (activeTab === 'gifting') loadGiftCodes();
                if (activeTab === 'analytics') loadAnalytics();
                if (activeTab === 'audit') loadAuditLog();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-bg-card border border-border-color text-[11px] font-black uppercase tracking-wider text-text-secondary hover:text-main hover:border-accent-color/30 transition"
            >
              <RefreshCw size={13} className={loadingUsers ? 'animate-spin' : ''} />
              Reîmprospătează
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition ${
                  activeTab === id
                    ? 'border-accent-color text-accent-color'
                    : 'border-transparent text-text-secondary hover:text-main'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* ─── Users ─── */}
        {activeTab === 'users' && (
          <Card padding="none" className="overflow-hidden">
            <div className="p-5 border-b border-border-color space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={16} />
                <input
                  type="text"
                  placeholder="Caută după email sau nume..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>
              <div className="flex gap-1.5">
                {([
                  ['all', 'Toate', users.length],
                  ['paid', 'Plătitori', headlineStats.paying],
                  ['free', 'Gratuite', headlineStats.free],
                  ['inactive', 'Inactivi', headlineStats.inactive],
                ] as const).map(([id, label, count]) => (
                  <button
                    key={id}
                    onClick={() => setPlanFilter(id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                      planFilter === id
                        ? 'bg-accent-color text-accent-text'
                        : 'bg-bg-main text-text-secondary hover:text-main'
                    }`}
                  >
                    {label} <span className="opacity-60 tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {loadingUsers ? (
                <SkeletonRows />
              ) : filteredUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Niciun utilizator găsit"
                  hint={searchTerm ? 'Încearcă alt termen de căutare.' : undefined}
                />
              ) : (
                <ul className="space-y-2">
                  {filteredUsers.map(user => {
                    const plan = getEffectivePlan(user, userProfile.email);
                    const isSelf = user.email === userProfile.email;
                    const busy = busyUserId === user.uid;
                    const expiry = user.subscriptionExpiresAt || user.orgPlanExpires;
                    const inactive = !isSelf && isInactiveUser(user);

                    return (
                      <li
                        key={user.uid}
                        className="flex items-center gap-3 p-3 rounded-xl bg-bg-main border border-transparent hover:border-border-color transition group"
                      >
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-color/10 text-accent-color flex items-center justify-center text-[11px] font-black">
                          {initials(user)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-main truncate">
                            {user.displayName || user.email?.split('@')[0]}
                          </p>
                          <p className="text-[11px] text-text-secondary truncate">{user.email}</p>
                        </div>

                        <div className="hidden md:flex flex-col items-end gap-1 shrink-0 w-32">
                          <Pill tone={plan.tone}>{plan.label}</Pill>
                          <span className="text-[10px] text-text-secondary tabular-nums">
                            {expiry ? `expiră ${fmtDate(expiry)}` : 'fără expirare'}
                          </span>
                        </div>

                        <div className="hidden lg:flex flex-col items-end gap-1 shrink-0 w-28">
                          <span
                            className={`text-[10px] tabular-nums font-bold ${inactive ? 'text-amber-500' : 'text-text-secondary'}`}
                            title={`Cont creat: ${fmtDate(user.createdAt)}`}
                          >
                            {user.lastLoginAt ? `activ ${fmtDate(user.lastLoginAt)}` : 'nicio logare'}
                          </span>
                          {inactive && <Pill tone="warn">Inactiv</Pill>}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {busy ? (
                            <Loader2 size={16} className="animate-spin text-text-secondary mx-3" />
                          ) : isSelf ? (
                            // The owner account is hardcoded to Enterprise in usePlan()
                            // regardless of any Firestore field — granting/revoking/deleting
                            // it would be a no-op at best and is never a real action.
                            <span className="text-[10px] text-text-secondary/50 italic px-2">cont proprietar</span>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setGrantTarget(user);
                                  setGrantProduct('bundle');
                                  setGrantDuration(12);
                                }}
                                title="Acordă abonament"
                                className="p-2 rounded-lg text-text-secondary hover:text-accent-color hover:bg-accent-color/10 transition"
                              >
                                <Gift size={15} />
                              </button>
                              {plan.tone !== 'neutral' && (
                                <button
                                  onClick={() => revokeSubscription(user)}
                                  title="Anulează abonamentul"
                                  className="p-2 rounded-lg text-text-secondary hover:text-amber-500 hover:bg-amber-500/10 transition"
                                >
                                  <Ban size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => confirmDelete(user)}
                                title="Șterge contul"
                                className="p-2 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        )}

        {/* ─── Gift codes ─── */}
        {activeTab === 'gifting' && (
          <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
            <Card>
              <h2 className="text-sm font-black uppercase tracking-widest text-main mb-1">Generează cod</h2>
              <p className="text-[11px] text-text-secondary mb-5 leading-relaxed">
                Codurile sunt universale — nu sunt legate de un cont. Primul care îl folosește primește produsul.
              </p>

              <label className="block text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">Produs</label>
              <div className="space-y-1.5 mb-4">
                {PRODUCTS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setGiftProduct(p.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition ${
                      giftProduct === p.id
                        ? 'border-accent-color bg-accent-color/5 text-main font-bold'
                        : 'border-border-color bg-bg-main text-text-secondary hover:text-main'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-black tabular-nums">${p.price}</span>
                      {giftProduct === p.id && <Check size={14} className="text-accent-color" />}
                    </span>
                  </button>
                ))}
              </div>

              <label className="block text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">
                Valabilitate (zile)
              </label>
              <input
                type="number"
                min={1}
                value={giftDays}
                onChange={e => setGiftDays(parseInt(e.target.value) || 30)}
                className={`${inputCls} mb-5`}
              />

              <button
                onClick={generateGiftCode}
                disabled={generating}
                className="w-full py-3 rounded-xl bg-accent-color text-accent-text text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                Generează
              </button>

              {lastCode && (
                <div className="mt-5 p-4 rounded-xl border-2 border-dashed border-accent-color/40 bg-accent-color/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">Cod nou</p>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="text-xl font-black text-accent-color tracking-widest flex-1">{lastCode}</code>
                    <button
                      onClick={() => copy(lastCode, 'Cod copiat')}
                      className="p-2 rounded-lg text-text-secondary hover:text-main hover:bg-bg-card transition"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                  <button
                    onClick={() => copy(`${window.location.origin}/#?giftCode=${lastCode}`, 'Link copiat')}
                    className="w-full py-2 rounded-lg bg-bg-card border border-border-color text-[10px] font-black uppercase tracking-wider text-text-secondary hover:text-main transition"
                  >
                    Copiază linkul de activare
                  </button>
                </div>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
                <h2 className="text-sm font-black uppercase tracking-widest text-main">Istoric coduri</h2>
                <span className="text-[10px] font-bold text-text-secondary tabular-nums">
                  {giftCodes.filter(c => !c.used).length} nefolosite / {giftCodes.length}
                </span>
              </div>
              <div className="p-5">
                {loadingCodes ? (
                  <SkeletonRows rows={4} />
                ) : giftCodes.length === 0 ? (
                  <EmptyState icon={Ticket} title="Niciun cod generat încă" hint="Generează primul cod din stânga." />
                ) : (
                  <ul className="space-y-1.5">
                    {giftCodes.map(c => {
                      const product = PRODUCTS.find(p => p.id === c.product);
                      return (
                        <li
                          key={c.code}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 rounded-xl bg-bg-main hover:bg-bg-main/60 transition"
                        >
                          <code
                            className={`text-sm font-black tracking-widest ${c.used ? 'text-text-secondary line-through' : 'text-main'}`}
                          >
                            {c.code}
                          </code>
                          <Pill tone={c.used ? 'neutral' : 'success'}>{c.used ? 'Folosit' : 'Activ'}</Pill>
                          <Pill tone={product?.tone ?? 'neutral'}>{productLabel(c.product)}</Pill>
                          <span className="text-[11px] text-text-secondary font-bold">
                            {c.days ?? '—'} zile
                          </span>
                          <span className="text-[10px] text-text-secondary/70 tabular-nums">
                            {c.createdAt ? `generat ${fmtDate(c.createdAt)}` : ''}
                            {c.used && c.usedAt ? ` · folosit ${fmtDate(c.usedAt)}` : ''}
                          </span>
                          <div className="flex items-center gap-0.5 ml-auto shrink-0">
                            <button
                              onClick={() => copy(c.code, 'Cod copiat')}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-main hover:bg-bg-card transition"
                              title="Copiază codul"
                            >
                              <Copy size={14} />
                            </button>
                            {!c.used && (
                              <button
                                onClick={() => deleteGiftCode(c.code)}
                                className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition"
                                title="Șterge codul"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ─── Ads ─── */}
        {activeTab === 'ads' && (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-sm font-black uppercase tracking-widest text-main">Reclamă nouă</h2>
                <button
                  onClick={seedAds}
                  disabled={seeding}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-main border border-border-color text-[10px] font-black uppercase tracking-wider text-text-secondary hover:text-main transition disabled:opacity-50"
                >
                  {seeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Adaugă 5 exemple
                </button>
              </div>
              <CreateAdForm onAdCreated={loadAds} />
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
                <h2 className="text-sm font-black uppercase tracking-widest text-main">Reclame active</h2>
                <span className="text-[10px] font-bold text-text-secondary tabular-nums">{ads.length}</span>
              </div>
              <div className="p-5">
                {loadingAds ? (
                  <SkeletonRows rows={2} />
                ) : ads.length === 0 ? (
                  <EmptyState icon={Megaphone} title="Nicio reclamă încă" hint="Creează una sau adaugă exemplele." />
                ) : (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {ads.map(ad => {
                      const impressions = (ad as any).impressions || 0;
                      const clicks = (ad as any).clicks || 0;
                      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                      return (
                        <div
                          key={ad.id}
                          className="rounded-xl border border-border-color overflow-hidden bg-bg-main hover:border-accent-color/30 transition group"
                        >
                          <div className="relative h-32 bg-bg-card overflow-hidden">
                            <img
                              src={ad.imageUrl}
                              alt={ad.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            {!!ad.discountPercent && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-accent-color text-accent-text text-[10px] font-black">
                                -{ad.discountPercent}%
                              </span>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="text-sm font-bold text-main truncate">{ad.title}</h3>
                            <p className="text-[11px] text-text-secondary mb-3">{ad.company}</p>

                            <div className="flex items-center gap-3 mb-2 text-[10px] font-bold text-text-secondary">
                              <span className="flex items-center gap-1">
                                <Eye size={11} /> {impressions}
                              </span>
                              <span className="flex items-center gap-1">
                                <MousePointerClick size={11} /> {clicks}
                              </span>
                              <span className="ml-auto text-main font-black tabular-nums">{ctr.toFixed(1)}% CTR</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-bg-card overflow-hidden mb-3">
                              <div
                                className="h-full rounded-full bg-accent-color transition-all"
                                style={{ width: `${Math.min(ctr, 100)}%` }}
                              />
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => window.open(ad.link, '_blank', 'noopener,noreferrer')}
                                className="flex-1 py-1.5 rounded-lg bg-bg-card border border-border-color text-[10px] font-black uppercase tracking-wider text-text-secondary hover:text-main transition"
                              >
                                Deschide
                              </button>
                              <button
                                onClick={() => deleteAd(ad.id || '')}
                                className="px-2.5 py-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition"
                                title="Șterge reclama"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ─── Analytics ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {loadingAnalytics && !analytics ? (
              <SkeletonRows rows={6} />
            ) : !analytics ? (
              <EmptyState icon={BarChart3} title="Statisticile nu au putut fi încărcate" />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total conturi" value={analytics.totalUsers} icon={Users} />
                  <StatCard
                    label="Venit încasat"
                    value={`$${analytics.totalRevenue}`}
                    hint={
                      analytics.paidCount > 0
                        ? `${analytics.paidCount} plăți · ARPU $${analytics.arpu}`
                        : 'Plata online nu e activă încă'
                    }
                    icon={DollarSign}
                    accent="#10b981"
                  />
                  <StatCard
                    label="Planuri active"
                    value={analytics.activePlans}
                    hint={`${analytics.giftedCount + analytics.grantedCount} oferite gratuit`}
                    icon={TrendingUp}
                    accent="#3b82f6"
                  />
                  <StatCard
                    label="Coduri cadou"
                    value={`${analytics.giftCodesRedeemed}/${analytics.giftCodesTotal}`}
                    hint="folosite / emise"
                    icon={Ticket}
                    accent="#a855f7"
                  />
                </div>

                {/* Revenue only ever counts verified Stripe purchases. Until
                    payments go live every plan here is a giveaway, and saying
                    so plainly beats a revenue number that isn't real money. */}
                {analytics.activePlans > 0 && analytics.totalRevenue === 0 && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <Gift size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Toate cele <strong className="text-main">{analytics.activePlans}</strong> planuri active au fost
                      oferite gratuit (coduri cadou sau acordate din panou), deci nu contează ca venit. Cifra de venit
                      va crește doar din plăți reale, după activarea Stripe.
                    </p>
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-5">
                  <Card>
                    <h2 className="text-sm font-black uppercase tracking-widest text-main mb-5">Distribuția planurilor</h2>
                    <DonutChart
                      data={[
                        { label: 'Gratuit', value: analytics.free, color: 'var(--text-secondary)' },
                        ...PRODUCTS.map(p => ({
                          label: p.label,
                          value: (analytics as any)[p.id] ?? 0,
                          color: p.hex,
                        })),
                        { label: 'Pro (legacy)', value: analytics.legacyPaid, color: '#f59e0b' },
                      ]}
                    />
                  </Card>

                  <Card>
                    <div className="flex items-baseline justify-between mb-1">
                      <h2 className="text-sm font-black uppercase tracking-widest text-main">Venit pe produs</h2>
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary">
                        doar plăți
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary mb-5">
                      Planurile oferite gratuit nu apar aici.
                    </p>
                    <RevenueBars
                      data={PRODUCTS.map(p => {
                        const count = analytics.purchasedByProduct?.[p.id] ?? 0;
                        return { label: p.label, count, revenue: count * p.price, color: p.hex };
                      })}
                    />
                    <div className="mt-6 pt-4 border-t border-border-color flex items-baseline justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">
                        Total încasat
                      </span>
                      <span className="text-2xl font-black text-main tabular-nums">${analytics.totalRevenue}</span>
                    </div>
                  </Card>
                </div>

                <Card>
                  <div className="flex items-center gap-2 mb-5">
                    <UserPlus size={14} className="text-accent-color" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-main">
                      Înscrieri — ultimele 12 luni
                    </h2>
                  </div>
                  <SignupChart data={analytics.signups} />
                </Card>
              </>
            )}
          </div>
        )}

        {/* ─── Audit log ─── */}
        {activeTab === 'audit' && (
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
              <h2 className="text-sm font-black uppercase tracking-widest text-main">Jurnal de audit</h2>
              <span className="text-[10px] font-bold text-text-secondary tabular-nums">{auditEntries.length}</span>
            </div>
            <div className="p-5">
              {loadingAudit ? (
                <SkeletonRows rows={6} />
              ) : auditEntries.length === 0 ? (
                <EmptyState icon={ScrollText} title="Niciun eveniment înregistrat încă" hint="Acțiunile de administrare (acordare, anulare, ștergere) vor apărea aici." />
              ) : (
                <ul className="space-y-1.5">
                  {auditEntries.map(entry => {
                    const meta = AUDIT_META[entry.action] ?? { label: entry.action, icon: ScrollText, tone: 'accent' as const };
                    const Icon = meta.icon;
                    return (
                      <li key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-main">
                        <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                          meta.tone === 'danger' ? 'bg-red-500/10 text-red-500'
                          : meta.tone === 'warn' ? 'bg-amber-500/10 text-amber-500'
                          : meta.tone === 'success' ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-accent-color/10 text-accent-color'
                        }`}>
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-main">{meta.label}</p>
                          <p className="text-[11px] text-text-secondary truncate">{auditDetailLine(entry)}</p>
                        </div>
                        <div className="hidden sm:flex flex-col items-end shrink-0 gap-0.5">
                          <span className="text-[10px] text-text-secondary tabular-nums">
                            {entry.at ? fmtDate(entry.at) : '—'}
                          </span>
                          <span className="text-[10px] text-text-secondary/60 truncate max-w-[160px]">
                            {entry.actorEmail}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Grant subscription modal */}
      <Modal open={!!grantTarget} onClose={() => setGrantTarget(null)} title="Acordă abonament">
        {grantTarget && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-main">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-color/10 text-accent-color flex items-center justify-center text-[11px] font-black">
                {initials(grantTarget)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-main truncate">
                  {grantTarget.displayName || grantTarget.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-text-secondary truncate">{grantTarget.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">
                Produs
              </label>
              <div className="space-y-1.5">
                {PRODUCTS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setGrantProduct(p.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition ${
                      grantProduct === p.id
                        ? 'border-accent-color bg-accent-color/5 text-main font-bold'
                        : 'border-border-color bg-bg-main text-text-secondary hover:text-main'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-black tabular-nums">${p.price}</span>
                      {grantProduct === p.id && <Check size={14} className="text-accent-color" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">
                Durată
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([1, 3, 12, null] as const).map(d => (
                  <button
                    key={String(d)}
                    onClick={() => setGrantDuration(d)}
                    className={`py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition ${
                      grantDuration === d
                        ? 'border-accent-color bg-accent-color text-accent-text'
                        : 'border-border-color bg-bg-main text-text-secondary hover:text-main'
                    }`}
                  >
                    {d === null ? 'Pe viață' : `${d} ${d === 1 ? 'lună' : 'luni'}`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={grantSubscription}
              disabled={granting}
              className="w-full py-3 rounded-xl bg-accent-color text-accent-text text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {granting ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
              Activează abonamentul
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SuperAdmin;

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Gift,
  BarChart3,
  Megaphone,
  Loader2,
  ChevronRight,
  Search,
  Copy,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/primitives';
import { db, functions, httpsCallable, doc, getDoc, collection, query, where, getDocs, deleteDoc } from '../services/firebase';
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
  organizationId?: string;
  // The legacy free/pro/enterprise tier — this is what usePlan() actually
  // reads (from organizations/{orgId}), not subscriptionProduct. A user can
  // have a legacy 'enterprise' org and no subscriptionProduct at all, which
  // is why those two fields can legitimately disagree.
  orgSubscriptionTier?: string;
  orgPlanExpires?: any;
}

// Mirrors usePlan()'s resolution: prefer the legacy org tier when it grants
// more than the new product system does, since that's what the rest of the
// app (sidebar badge, feature gates) actually treats the user as having.
function getEffectivePlanLabel(user: UserData, superadminEmail: string): string {
  if (user.email === superadminEmail) return 'Enterprise (dev)';
  if (user.orgSubscriptionTier === 'enterprise') return 'Enterprise';
  if (user.orgSubscriptionTier === 'lifetime') return 'Lifetime';
  if (user.subscriptionProduct) {
    const label = user.subscriptionProduct === 'adFree' ? 'Ad-Free' : user.subscriptionProduct === 'academyPro' ? 'Academy Pro' : 'Bundle';
    return label;
  }
  if (user.orgSubscriptionTier === 'pro') return 'Pro (legacy)';
  return 'Free';
}

interface GiftCodeData {
  code: string;
  product: string;
  link: string;
}

const CreateAdForm: React.FC<{ onAdCreated: () => void }> = ({ onAdCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    imageUrl: '',
    link: '',
    discountPercent: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const createAdFn = httpsCallable(functions, 'createAd');
      await createAdFn(formData);
      toast.success('Ad created successfully!');
      setFormData({ title: '', company: '', imageUrl: '', link: '', discountPercent: 0 });
      onAdCreated();
    } catch (err: any) {
      toast.error('Failed to create ad: ' + (err?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Ad Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
        />
        <input
          type="text"
          placeholder="Company Name"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          required
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
        />
        <input
          type="url"
          placeholder="Image URL"
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          required
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
        />
        <input
          type="url"
          placeholder="Ad Link (with affiliate codes)"
          value={formData.link}
          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
          required
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
        />
        <div>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Discount (%)"
            value={formData.discountPercent}
            onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
        Create Ad
      </button>
    </form>
  );
};

const SuperAdmin: React.FC<Props> = ({ userProfile }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'gifting' | 'ads' | 'analytics'>('users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [giftProduct, setGiftProduct] = useState<'adFree' | 'academyPro' | 'bundle'>('adFree');
  const [giftDays, setGiftDays] = useState(30);
  const [generatedCode, setGeneratedCode] = useState<GiftCodeData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [analyticsData, setAnalyticsData] = useState({
    totalUsers: 0,
    adFreeCount: 0,
    academyProCount: 0,
    bundleCount: 0,
    legacyPaidCount: 0,
    totalRevenue: 0,
  });

  // Verify superadmin access
  useEffect(() => {
    if (userProfile.role !== 'superadmin' && userProfile.email !== 'dragomirvaleriu@gmail.com') {
      toast.error('Access denied: Superadmin only');
      return;
    }
  }, [userProfile]);

  // Auto-load users on mount so the panel isn't empty until someone clicks Refresh
  useEffect(() => {
    loadUsers();
  }, []);

  // Load users
  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const userData: UserData[] = [];
      usersSnap.forEach((snap) => {
        const data = snap.data();
        userData.push({
          uid: snap.id,
          email: data.email,
          displayName: data.displayName,
          subscriptionProduct: data.subscriptionProduct,
          subscriptionExpiresAt: data.subscriptionExpiresAt,
          createdAt: data.createdAt,
          organizationId: data.organizationId,
        });
      });

      // Join each user to their org's legacy subscriptionTier — that field
      // (not subscriptionProduct) is what usePlan() actually resolves the
      // app-wide plan badge from, so it's the only way to show the real
      // effective plan here instead of a partial/misleading one.
      const orgIds = Array.from(new Set(userData.map(u => u.organizationId).filter(Boolean))) as string[];
      const orgEntries = await Promise.all(
        orgIds.map(async (orgId) => {
          const orgSnap = await getDoc(doc(db, 'organizations', orgId));
          return [orgId, orgSnap.exists() ? orgSnap.data() : null] as const;
        })
      );
      const orgMap = new Map(orgEntries);
      userData.forEach(u => {
        const org = u.organizationId ? orgMap.get(u.organizationId) : null;
        u.orgSubscriptionTier = org?.subscriptionTier;
        u.orgPlanExpires = org?.planExpires;
      });

      setUsers(userData);
      updateAnalytics(userData);
    } catch (err: any) {
      toast.error('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load ads
  const loadAds = async () => {
    setLoading(true);
    try {
      const adsSnap = await getDocs(collection(db, 'superadmin/data/ads'));
      const adsList: Advertisement[] = [];
      adsSnap.forEach((snap) => {
        adsList.push({
          id: snap.id,
          ...snap.data(),
        } as Advertisement);
      });
      setAds(adsList);
    } catch (err: any) {
      toast.error('Failed to load ads: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update analytics
  const updateAnalytics = (userData: UserData[]) => {
    const adFree = userData.filter(u => u.subscriptionProduct === 'adFree').length;
    const academyPro = userData.filter(u => u.subscriptionProduct === 'academyPro').length;
    const bundle = userData.filter(u => u.subscriptionProduct === 'bundle').length;
    // Legacy pro/enterprise orgs (pre-dating the 3-product system, or granted
    // via trial/manual override) — counted separately since they're not
    // revenue from the new products, but still real paid-tier users.
    const legacyPaid = userData.filter(u =>
      !u.subscriptionProduct &&
      u.email !== userProfile.email &&
      (u.orgSubscriptionTier === 'pro' || u.orgSubscriptionTier === 'enterprise' || u.orgSubscriptionTier === 'lifetime')
    ).length;

    setAnalyticsData({
      totalUsers: userData.length,
      adFreeCount: adFree,
      academyProCount: academyPro,
      bundleCount: bundle,
      legacyPaidCount: legacyPaid,
      totalRevenue: (adFree * 2) + (academyPro * 2) + (bundle * 3),
    });
  };

  // Generate a universal gift code — not tied to any specific user. Whoever
  // redeems it first (via the link or by typing the code into "Contul meu")
  // gets the product.
  const handleGenerateGiftCode = async () => {
    setLoading(true);
    try {
      const createGiftCode = httpsCallable(functions, 'createGiftCode');
      const result: any = await createGiftCode({
        product: giftProduct,
        days: giftDays,
      });

      if (result.data.success) {
        const link = `${window.location.origin}/#?giftCode=${result.data.code}`;
        setGeneratedCode({
          code: result.data.code,
          product: giftProduct,
          link,
        });
        toast.success('Gift code generated!');
      }
    } catch (err: any) {
      toast.error('Failed to generate gift code: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Delete ad
  const deleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    try {
      await deleteDoc(doc(db, 'superadmin', 'data', 'ads', adId));
      setAds(ads.filter(a => a.id !== adId));
      toast.success('Ad deleted successfully');
    } catch (err: any) {
      toast.error('Failed to delete ad: ' + err.message);
    }
  };

  // Seed 5 default Romanian ads (one-time helper)
  const handleSeedDefaultAds = async () => {
    setSeeding(true);
    try {
      const seedFn = httpsCallable(functions, 'seedDefaultAds');
      const result: any = await seedFn({});
      toast.success(`${result.data.count} ads seeded successfully!`);
      loadAds();
    } catch (err: any) {
      toast.error('Failed to seed ads: ' + (err?.message || 'Unknown error'));
    } finally {
      setSeeding(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mb-2">
            SuperAdmin Panel
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Manage users, gift codes, ads, and revenue</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'gifting', label: 'Gift Codes', icon: Gift },
            { id: 'ads', label: 'Ads', icon: Megaphone },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id as any);
                if (id === 'users') loadUsers();
                if (id === 'ads') loadAds();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                activeTab === id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h2>
              <button
                onClick={loadUsers}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                Refresh
              </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
                className="w-full pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* Users Table - Responsive */}
            <div className="overflow-x-auto">
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-600">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Display Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Subscription</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Expires</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.uid}
                      onClick={() => setSelectedUser(user)}
                      className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition ${
                        selectedUser?.uid === user.uid ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{user.email}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{user.displayName || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-sm font-medium">
                          {getEffectivePlanLabel(user, userProfile.email)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {user.subscriptionExpiresAt
                          ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
                          : user.orgPlanExpires?.toDate
                          ? user.orgPlanExpires.toDate().toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    selectedUser?.uid === user.uid
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{user.email}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{user.displayName || 'No name'}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs font-medium">
                      {getEffectivePlanLabel(user, userProfile.email)}
                    </span>
                    {user.subscriptionExpiresAt && (
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs">
                        Expires: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Gift Codes Tab */}
        {activeTab === 'gifting' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Generator */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Generate Gift Code</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Codes are universal — not tied to any user. Whoever redeems the code or link first gets the product.
              </p>

              {/* Product Selection */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Product</p>
                <select
                  value={giftProduct}
                  onChange={(e) => setGiftProduct(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="adFree">Ad-Free ($2)</option>
                  <option value="academyPro">Academy Pro ($2)</option>
                  <option value="bundle">Bundle ($3)</option>
                </select>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Duration (days)</p>
                <input
                  type="number"
                  min={1}
                  value={giftDays}
                  onChange={(e) => setGiftDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateGiftCode}
                disabled={loading}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 transition font-medium flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
                Generate Code
              </button>
            </Card>

            {/* Generated Code Display */}
            {generatedCode && (
              <Card className="p-6 bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={24} />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Code Generated</h3>
                </div>

                <div className="space-y-4">
                  {/* Code Display */}
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-600 dark:border-emerald-400">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Gift Code</p>
                    <div className="flex items-center gap-2">
                      <code className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {generatedCode.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCode.code)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Product</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{generatedCode.product}</p>
                  </div>

                  {/* Share Link */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Share Link</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedCode.link}
                        className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedCode.link)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Ads Tab */}
        {activeTab === 'ads' && (
          <div className="space-y-6">
            {/* Create Ad Form */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Ad</h2>
                <button
                  onClick={handleSeedDefaultAds}
                  disabled={seeding}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {seeding ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
                  Seed 5 Romanian Ads
                </button>
              </div>
              <CreateAdForm onAdCreated={() => { loadAds(); setGeneratedCode(null); }} />
            </Card>

            {/* Active Ads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Ads</h2>
                <button
                  onClick={loadAds}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
                  Refresh
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {ads.map((ad) => {
                  const impressions = (ad as any).impressions || 0;
                  const clicks = (ad as any).clicks || 0;
                  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
                  return (
                    <div key={ad.id} className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden hover:shadow-lg transition">
                      <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover" loading="lazy" />
                      <div className="p-4">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{ad.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{ad.company}</p>

                        {/* Analytics */}
                        <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded">
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Impressions</p>
                            <p className="font-bold text-slate-900 dark:text-white">{impressions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Clicks</p>
                            <p className="font-bold text-slate-900 dark:text-white">{clicks}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">CTR</p>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{ctr}%</p>
                          </div>
                        </div>

                        {ad.discountPercent && (
                          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                            {ad.discountPercent}% discount
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(ad.link, '_blank')}
                            className="flex-1 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                          >
                            View Link
                          </button>
                          <button
                            onClick={() => deleteAd(ad.id || '')}
                            className="flex-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {ads.length === 0 && (
                <div className="text-center py-12">
                  <Megaphone className="mx-auto mb-4 text-slate-400" size={48} />
                  <p className="text-slate-600 dark:text-slate-400">No ads yet. Create one to get started!</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            <button
              onClick={() => {
                loadUsers();
                toast.success('Analytics updated');
              }}
              className="mb-6 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
              Refresh Data
            </button>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Total Users */}
              <Card className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Users</p>
                <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                  {analyticsData.totalUsers}
                </p>
              </Card>

              {/* Ad-Free */}
              <Card className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Ad-Free Subscribers</p>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {analyticsData.adFreeCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  ${analyticsData.adFreeCount * 2} revenue
                </p>
              </Card>

              {/* Academy Pro */}
              <Card className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Academy Pro</p>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {analyticsData.academyProCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  ${analyticsData.academyProCount * 2} revenue
                </p>
              </Card>

              {/* Bundle */}
              <Card className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Bundle Subscribers</p>
                <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                  {analyticsData.bundleCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  ${analyticsData.bundleCount * 3} revenue
                </p>
              </Card>

              {/* Legacy Pro/Enterprise (pre-existing trials/manual grants, not new-product revenue) */}
              <Card className="p-6">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Legacy Pro/Enterprise</p>
                <p className="text-4xl font-bold text-slate-600 dark:text-slate-300">
                  {analyticsData.legacyPaidCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Not counted in revenue below
                </p>
              </Card>

              {/* Total Revenue */}
              <Card className="p-6 md:col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Revenue</p>
                <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${analyticsData.totalRevenue}
                </p>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;

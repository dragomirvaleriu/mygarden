import { useEffect, useState } from 'react';
import { doc, onSnapshot } from '../../services/firebase';
import { auth, db } from '../../services/firebase';
import { UserProfile } from '../types';

/**
 * Hook that returns the current authenticated user's profile and subscription tier.
 */
export const usePlan = (uid?: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'enterprise' | 'lifetime'>('free');

  useEffect(() => {
    const effectiveUid = uid || auth.currentUser?.uid;
    
    if (!effectiveUid) {
      setSubscriptionTier('free');
      setProfile(null);
      return;
    }
    
    let unsubOrg: () => void = () => {};
    const userRef = doc(db, 'users', effectiveUid);
    
    const unsubUser = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;
      const userData = snap.data() as UserProfile;
      setProfile(userData);
      
      const isDev = userData.email?.toLowerCase() === 'dragomirvaleriu@gmail.com';
      
      if (userData.organizationId) {
        unsubOrg();
        const orgRef = doc(db, 'organizations', userData.organizationId);
        unsubOrg = onSnapshot(orgRef, orgSnap => {
          if (!orgSnap.exists()) {
            setSubscriptionTier(isDev ? 'enterprise' : 'free');
            return;
          }
          const orgData = orgSnap.data() as any;
          const now = Date.now();
          
          let tier: 'free' | 'pro' | 'enterprise' | 'lifetime' = 'free';

          if (isDev) {
            tier = 'enterprise';
          } else if (orgData.subscriptionTier) {
            // Use the new standard field if it exists
            tier = orgData.subscriptionTier;
          } else {
            // Fallback to legacy fields
            const effectiveLicense = orgData.licenseType || (orgData.plan === 'pro' ? 'pro' : 'free');
            const isOrgPro = orgData.isLifetime || effectiveLicense === 'pro';
            tier = orgData.isLifetime ? 'lifetime' : (isOrgPro ? 'pro' : 'free');
          }

          // Check expiration for 'pro' trial/plan
          const expires = orgData.trialExpiresAt?.toDate 
            ? orgData.trialExpiresAt.toDate().getTime() 
            : (orgData.planExpires?.toDate ? orgData.planExpires.toDate().getTime() : Infinity);

          // If plan has expired and it's not lifetime or enterprise, downgrade to free
          if (tier !== 'lifetime' && tier !== 'enterprise' && now > expires) {
             tier = 'free';
          }
          
          setSubscriptionTier(tier);
        });
      } else {
        setSubscriptionTier(isDev ? 'enterprise' : 'free');
      }
    });

    return () => {
      unsubUser();
      unsubOrg();
    };
  }, [uid]);

  // Derived limits and features
  const isPaid = subscriptionTier !== 'free';

  const limits = {
    // Free is a funnel, not a product: enough to feel the value, not to run a business on.
    maxClients: subscriptionTier === 'free' ? 3 : 999999,
    maxProperties: subscriptionTier === 'free' ? 1 : 999999,
    maxEmployees: subscriptionTier === 'free' ? 1 : 999999,
  };

  const features = {
    hasKanban: isPaid,
    hasRoutePlanner: isPaid,
    hasAdvancedReports: isPaid,
    // Revenue-driving features — the things that hurt to be without. Gated to paid tiers
    // so they justify the subscription. Wired into their screens as each ships.
    hasEInvoicing: isPaid,       // e-Factura / ANAF automatic invoicing
    hasOnlinePayments: isPaid,   // card payments in the client portal
    hasWhatsApp: isPaid,         // automated WhatsApp notifications
    hasAIPlantScan: isPaid,      // AI plant/disease diagnosis
  };

  return { profile, subscriptionTier, limits, features };
};

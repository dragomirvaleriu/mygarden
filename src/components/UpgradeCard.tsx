import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';

/**
 * Simple card prompting the user to upgrade to the Pro plan.
 * `checkoutSessionId` should be a pre‑created Stripe Checkout Session ID.
 */
export const UpgradeCard: React.FC<{checkoutSessionId?: string, accountType?: 'PF' | 'PJ'}> = ({checkoutSessionId, accountType = 'PJ'}) => {
  const { t } = useTranslation();

  const handleUpgrade = async () => {
    if (!checkoutSessionId) {
      alert("Stripe Checkout integration is pending. Please contact support or use a gift code.");
      return;
    }
    const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PK);
    stripe?.redirectToCheckout({sessionId: checkoutSessionId});
  };

  return (
    <div className="p-6 bg-bg-card border border-border-color rounded-xl shadow-md">
      <h3 className="text-lg font-bold">{accountType === 'PF' ? t('Commercial Subscription') : t('Premium Billing')}</h3>
      <p className="mt-2 text-sm text-text-secondary">
        {accountType === 'PF' 
          ? t('Upgrade to a Commercial account to access team management, financial reports, and lead management.')
          : t('Premium billing access is only available for Pro users.')}
      </p>
      <button
        onClick={handleUpgrade}
        className="mt-4 w-full py-2 bg-accent-color text-white rounded hover:bg-accent-color/90 font-bold uppercase tracking-widest text-[11px]"
      >
        {accountType === 'PF' ? t('Upgrade to Commercial') : t('Upgrade to Pro')}
      </button>
    </div>
  );
};

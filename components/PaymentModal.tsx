import React, { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Client, Property } from '../src/types';
import { processPayment } from '../services/paymentService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface PaymentModalProps {
  isOpen: boolean;
  client: Client | null;
  initialAmount: string;
  properties: Property[];
  organizationId: string;
  onClose: () => void;
  onSuccess?: () => void;
  source?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  client,
  initialAmount,
  properties,
  organizationId,
  onClose,
  onSuccess,
  source
}) => {
  const { t } = useTranslation();
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [isProcessing, setIsProcessing] = useState(false);

  // Default source if not provided
  const actualSource = source || t('Quick Collect');

  // Update amount if initialAmount changes (e.g. when opening modal for a new client)
  React.useEffect(() => {
    setAmountStr(initialAmount);
  }, [initialAmount]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !client) return null;

  const handlePayment = async () => {
    if (!amountStr) return;
    setIsProcessing(true);
    
    // Show a loading toast
    const toastId = toast.loading(`${t('Processing')}...`);
    
    try {
      const amount = parseFloat(amountStr);
      await processPayment(amount, client, properties, organizationId, actualSource);
      toast.success(`${t('Collect')} ${t('Save')}: ${amount} RON`, { id: toastId });
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(`${t('Error')}: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="stihl-card w-full max-w-sm rounded-lg p-6 relative bg-bg-card animate-in zoom-in duration-200 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary hover:text-main">
          <X size={20} />
        </button>
        <h3 className="text-lg font-black text-main mb-1">{t('Quick Collect')}</h3>
        <p className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-6">{client.nume}</p>
        
        <div className="space-y-4">
            <div>
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1">{t('Current Balance')}</label>
                <div className="text-xl font-black text-red-500">{client.sold || 0} RON</div>
            </div>
            <div>
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1">{t('Amount Collected (RON)')}</label>
                <input 
                    type="number" 
                    autoFocus
                    className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-lg font-bold text-main outline-none focus:border-accent-color"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePayment()}
                    placeholder="0.00"
                />
            </div>
            <button 
                onClick={handlePayment}
                disabled={isProcessing || !amountStr}
                className="w-full bg-accent-color hover:bg-accent-color/90 py-3 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md mt-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('Processing')}...
                  </>
                ) : (
                  <>
                    <Check size={16} /> {t('Confirm')}
                  </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

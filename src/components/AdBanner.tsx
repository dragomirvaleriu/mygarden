
import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useData } from '../context/DataContext';

interface AdBannerProps {
  subscriptionTier?: 'free' | 'pro' | 'enterprise' | 'lifetime';
  variant?: 'full' | 'compact';
}

export const AdBanner: React.FC<AdBannerProps> = ({ subscriptionTier, variant = 'full' }) => {
  const [dismissed, setDismissed] = useState(false);
  const { globalSystemConfig } = useData();
  const [currentAd, setCurrentAd] = useState<any>(null);

  useEffect(() => {
    const ads = globalSystemConfig?.adsConfig?.ads || [];
    if (ads.length > 0) {
      const randomAd = ads[Math.floor(Math.random() * ads.length)];
      setCurrentAd(randomAd);
    } else {
      // Fallback
      setCurrentAd({
        title: 'Boost Your Garden with Premium Seeds!',
        description: 'Get 20% off on your first order at pentrugazon.ro with code LANDSCAPE20',
        shortDescription: '20% OFF @ pentrugazon.ro',
        buttonText: 'Shop Now',
        url: 'https://pentrugazon.ro'
      });
    }
  }, [globalSystemConfig?.adsConfig?.ads]);

  if (dismissed || !currentAd) return null;

  if (variant === 'compact') {
    return (
      <div className="mx-2 my-4 p-4 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 border border-blue-600/10 rounded-2xl relative group overflow-hidden">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
            <ExternalLink size={20} />
          </div>
          <div>
            <h4 className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Sponsored</h4>
            <p className="text-[11px] font-bold text-main leading-tight mb-1">{currentAd.title}</p>
            <p className="text-[8px] text-text-secondary font-bold uppercase tracking-tighter leading-none opacity-60 mb-3">{currentAd.shortDescription}</p>
          </div>
          <a 
            href={currentAd.url}
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all text-center block"
          >
            {currentAd.buttonText || 'Shop Now'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 p-4 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-600/20 rounded-2xl relative group overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
          <X size={14} className="text-text-secondary" />
        </button>
      </div>
      
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
          <ExternalLink size={32} />
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Sponsored</h4>
          <p className="text-sm font-bold text-main leading-snug mb-1">{currentAd.title}</p>
          <p className="text-[11px] text-text-secondary font-medium uppercase tracking-wider">{currentAd.description}</p>
        </div>
        
        <a 
          href={currentAd.url}
          target="_blank" 
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-105 transition-all active:scale-95 shrink-0 text-center block"
        >
          {currentAd.buttonText || 'Shop Now'}
        </a>
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-600/5 rounded-full blur-2xl pointer-events-none"></div>
    </div>
  );
};

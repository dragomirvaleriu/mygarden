import React, { useEffect, useState } from 'react';
import { db, doc, collection, getDocs } from '../services/firebase';
import { X } from 'lucide-react';

interface Ad {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  company: string;
  discountPercent?: number;
}

interface Props {
  userSubscriptionProduct?: 'adFree' | 'academyPro' | 'bundle' | null;
}

const AdBanner: React.FC<Props> = ({ userSubscriptionProduct }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Hide ads if user has ad-free or bundle subscription
  const shouldShowAds = userSubscriptionProduct !== 'adFree' && userSubscriptionProduct !== 'bundle';

  useEffect(() => {
    const loadAds = async () => {
      try {
        const adsCol = collection(db, 'superadmin', 'data', 'ads');
        const adsSnap = await getDocs(adsCol);
        const adsList = adsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setAds(adsList.filter(ad => ad.isActive));
      } catch (err) {
        console.error('Failed to load ads:', err);
      }
    };

    loadAds();
  }, []);

  if (!shouldShowAds || ads.length === 0 || dismissed) {
    return null;
  }

  const currentAd = ads[currentAdIndex % ads.length];

  const handleNext = () => {
    setCurrentAdIndex((prev) => (prev + 1) % ads.length);
  };

  return (
    <div className="w-full rounded-xl border border-border-color bg-bg-card overflow-hidden hover:shadow-md transition-shadow">
      <a
        href={currentAd.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative group"
      >
        <img
          src={currentAd.imageUrl}
          alt={currentAd.title}
          className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <p className="text-white font-bold text-sm">Vizitează oferta</p>
        </div>
      </a>

      <div className="p-3 border-t border-border-color bg-bg-main">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{currentAd.company}</p>
            <p className="text-sm font-bold text-main truncate">{currentAd.title}</p>
            {currentAd.discountPercent ? (
              <p className="text-xs text-accent-color font-bold">-{currentAd.discountPercent}% Reducere</p>
            ) : null}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setDismissed(true);
            }}
            className="text-text-secondary hover:text-main transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {ads.length > 1 && (
          <div className="flex gap-1 mt-2">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={handleNext}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  idx === currentAdIndex % ads.length ? 'bg-accent-color' : 'bg-border-color/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;

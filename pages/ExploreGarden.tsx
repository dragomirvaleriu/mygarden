import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf, Package, LayoutGrid } from 'lucide-react';
import Explore from './Explore';
import GardenCollectionPage from './GardenCollectionPage';

interface Props {
  organizationId: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
  onNavigateToUpgrade: () => void;
}

type Tab = 'browse' | 'collection';

const ExploreGarden: React.FC<Props> = ({ organizationId, subscriptionTier, onNavigateToUpgrade }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('browse');

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="sticky top-0 z-20 bg-bg-main border-b border-border-color px-4 sm:px-6 py-3 flex gap-2">
        <button
          onClick={() => setActiveTab('browse')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'browse'
              ? 'bg-accent-color text-white shadow-lg'
              : 'text-text-secondary hover:bg-bg-card'
          }`}
        >
          <Package className="w-4 h-4" />
          {t('Explorează')}
        </button>
        <button
          onClick={() => setActiveTab('collection')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'collection'
              ? 'bg-accent-color text-white shadow-lg'
              : 'text-text-secondary hover:bg-bg-card'
          }`}
        >
          <Leaf className="w-4 h-4" />
          {t('Grădina mea')}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'browse' && (
          <Explore
            organizationId={organizationId}
            subscriptionTier={subscriptionTier}
            onNavigateToUpgrade={onNavigateToUpgrade}
          />
        )}
        {activeTab === 'collection' && <GardenCollectionPage />}
      </div>
    </div>
  );
};

export default ExploreGarden;

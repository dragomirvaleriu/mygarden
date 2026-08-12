import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf, Package, LayoutGrid } from 'lucide-react';
import { useData } from '../src/context/DataContext';
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
  const { properties } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(properties?.[0]?.id || null);

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher + Property selector */}
      <div className="sticky top-0 z-20 bg-bg-main border-b border-border-color px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2">
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

        {/* Property selector */}
        {properties && properties.length > 1 && (
          <select
            value={selectedPropertyId || ''}
            onChange={(e) => setSelectedPropertyId(e.target.value || null)}
            className="px-3 py-2 rounded-lg bg-bg-card border border-border-color text-sm font-medium text-text-main outline-none focus:border-accent-color"
          >
            <option value="">{t('Toate proprietățile')}</option>
            {properties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name || `Proprietate ${prop.id}`}
              </option>
            ))}
          </select>
        )}
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
        {activeTab === 'collection' && <GardenCollectionPage propertyId={selectedPropertyId} />}
      </div>
    </div>
  );
};

export default ExploreGarden;

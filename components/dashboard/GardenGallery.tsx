import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Visit, Client, Property } from '../../src/types';

import { Image } from 'lucide-react';
export const GardenGallery: React.FC<{ visits: Visit[] }> = ({ visits }) => {
  const { t } = useTranslation();
  
  const allPhotos = useMemo(() => {
    return visits
      .filter(v => v.photos && v.photos.length > 0)
      .flatMap(v => v.photos!.map(url => ({ url, date: v.data, type: v.tipLucrare })))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 12);
  }, [visits]);

  if (allPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 opacity-30">
        <Image size={32} className="mb-2" />
        <p className="text-[11px] font-black uppercase tracking-widest">{t('No photos yet')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar max-h-[300px] pr-1">
      {allPhotos.map((photo, i) => (
        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border-color/20 relative group cursor-pointer">
          <img src={photo.url} alt="Garden" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
            <p className="text-[8px] text-white font-black uppercase truncate">{photo.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

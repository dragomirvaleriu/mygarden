import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import { Settings, X, Moon, Sun, Zap } from 'lucide-react';

interface Props {
  theme: 'light' | 'dark';
  selectedAccentColor: string;
  onToggleTheme: () => void;
  onSelectAccentColor: (color: string) => void;
}

const MobileSettingsModal: React.FC<Props> = ({
  theme,
  selectedAccentColor,
  onToggleTheme,
  onSelectAccentColor,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // 5 slots, grouped masculine/feminine-coded per explicit request: 3 "boy"
  // colors first (green/blue/red), then 2 "girl" colors (pink/purple). Keep
  // in sync with the same fallback array in src/App.tsx
  // (organization?.accentColors default).
  const accentColors = [
    '#4A7C59', // Olive Green
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#EC4899', // Pink
    '#a855f7', // Purple
  ];

  const languages = [
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ];

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2.5 rounded-lg hover:bg-bg-card transition-colors text-text-secondary hover:text-accent-color"
        title={t('Settings')}
        aria-label="Settings"
      >
        <Settings size={22} strokeWidth={2} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full md:w-96 bg-bg-card border border-border-color rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:slide-in-from-center duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-bg-card border-b border-border-color p-4 flex items-center justify-between rounded-t-3xl md:rounded-t-2xl">
              <h2 className="text-lg font-black text-main flex items-center gap-2">
                <Settings size={20} className="text-accent-color" />
                {t('Settings')}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-bg-main rounded-lg transition-colors text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Dark/Light Mode */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider">
                  {t('Theme')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                      setIsOpen(false);
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'bg-accent-color/20 text-accent-color border border-accent-color/40'
                        : 'bg-bg-main text-text-secondary hover:text-main border border-border-color'
                    }`}
                  >
                    <Sun size={18} />
                    {t('Light')}
                  </button>
                  <button
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                      setIsOpen(false);
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                      theme === 'dark'
                        ? 'bg-accent-color/20 text-accent-color border border-accent-color/40'
                        : 'bg-bg-main text-text-secondary hover:text-main border border-border-color'
                    }`}
                  >
                    <Moon size={18} />
                    {t('Dark')}
                  </button>
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider">
                  {t('Accent Color')}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {accentColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        onSelectAccentColor(color);
                        setIsOpen(false);
                      }}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        selectedAccentColor === color
                          ? 'ring-2 ring-offset-2 ring-offset-bg-card ring-accent-color scale-105'
                          : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider">
                  {t('Language')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setIsOpen(false);
                      }}
                      className={`py-3 px-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-1 ${
                        i18n.language === lang.code
                          ? 'bg-accent-color/20 text-accent-color border border-accent-color/40'
                          : 'bg-bg-main text-text-secondary hover:text-main border border-border-color'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-xs">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="pt-4 border-t border-border-color text-center">
                <p className="text-xs text-text-secondary font-medium">
                  ⚙️ {t('Settings are saved automatically')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileSettingsModal;

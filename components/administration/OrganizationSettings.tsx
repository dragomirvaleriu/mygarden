import React from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Calendar, Landmark, Clock, Settings2, Globe, Mail, Phone, MapPin } from 'lucide-react';

interface Props {
  orgForm: {
    name: string;
    address: string;
    mapsLink?: string;
    phone?: string;
    accentColors: string[];
    contractTypeColors?: { maintenance: string; oneTime: string; inactive: string };
    activeViewsDesktop?: string[];
    activeViewsMobile?: string[];
    billableMonths: number[];
    defaultInvoiceDay: number;
    defaultDueDay: number;
    workDays: 'L-V' | 'L-S' | 'L-D';
    startTime: string;
    endTime: string;
    plan: string;
    planExpires: any;
    cui?: string;
    regCom?: string;
    iban?: string;
    banca?: string;
    localitate?: string;
    judet?: string;
    codPostal?: string;
    email?: string;
    website?: string;
  };
  setOrgForm: React.Dispatch<React.SetStateAction<any>>;
  handleUpdateOrg: (e: React.FormEvent) => Promise<void>;
  isUpdatingOrg: boolean;
  view?: 'general' | 'visual' | 'all';
  readOnly?: boolean;
  accountType?: 'PF' | 'PJ';
}

const OrganizationSettings: React.FC<Props> = ({ 
  orgForm, 
  setOrgForm, 
  handleUpdateOrg, 
  isUpdatingOrg,
  view = 'all',
  readOnly = false,
  accountType = 'PJ'
}) => {
  const { t } = useTranslation();

  const months = [
    t('Jan'), t('Feb'), t('Mar'), t('Apr'), t('May'), t('Jun'),
    t('Jul'), t('Aug'), t('Sep'), t('Oct'), t('Nov'), t('Dec')
  ];

  return (
    <div className="space-y-8">
      {/* General & Scheduling Section */}
      {(view === 'all' || view === 'general') && (
      <section className="stihl-card rounded-lg p-6 relative overflow-hidden h-fit bg-bg-card border border-border-color">
        <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
          <Settings2 size={16} className="text-accent-color" />
          {accountType === 'PF' ? t('Garden Settings') : t('Organization Parameters')}
        </h3>
        
        <form onSubmit={handleUpdateOrg} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">
                {accountType === 'PF' ? t('Garden Name') : t('Company Name')}
              </label>
              <input 
                type="text" 
                required 
                className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                value={orgForm.name || ''} 
                onChange={e => setOrgForm({...orgForm, name: e.target.value})} 
                disabled={readOnly}
              />
            </div>
            {accountType !== 'PF' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Fiscal ID (CUI)')}</label>
                  <input 
                    type="text" 
                    placeholder="RO..."
                    className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                    value={orgForm.cui || ''} 
                    onChange={e => setOrgForm({...orgForm, cui: e.target.value})} 
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Trade Registry No.')}</label>
                  <input 
                    type="text" 
                    placeholder="J40/..."
                    className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                    value={orgForm.regCom || ''} 
                    onChange={e => setOrgForm({...orgForm, regCom: e.target.value})} 
                    disabled={readOnly}
                  />
                </div>
              </>
            )}
          </div>

          {/* Legal Section */}
          <div className="pt-4 border-t border-border-color/50">
            <h4 className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <MapPin size={12} />
              {accountType === 'PF' ? t('Home Address & Location') : t('Head Office & Contact')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{accountType === 'PF' ? t('Home Address') : t('Headquarters Address')}</label>
                    <input 
                        type="text" 
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.address || ''} 
                        onChange={e => setOrgForm({...orgForm, address: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('City')}</label>
                    <input 
                        type="text" 
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.localitate || ''} 
                        onChange={e => setOrgForm({...orgForm, localitate: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('County')}</label>
                    <input 
                        type="text" 
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.judet || ''} 
                        onChange={e => setOrgForm({...orgForm, judet: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Postal Code')}</label>
                    <input 
                        type="text" 
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.codPostal || ''} 
                        onChange={e => setOrgForm({...orgForm, codPostal: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 mt-4 border-t border-border-color/30">
                <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 block ml-1">
                        <Phone size={12} className="text-accent-color opacity-70" />
                        {t('Phone Number')}
                    </label>
                    <input 
                        type="tel" 
                        placeholder="+40..."
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.phone || ''} 
                        onChange={e => setOrgForm({...orgForm, phone: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 block ml-1">
                        <Mail size={12} className="text-accent-color opacity-70" />
                        {t('Email Address')}
                    </label>
                    <input 
                        type="email" 
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.email || ''} 
                        onChange={e => setOrgForm({...orgForm, email: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 block ml-1">
                        <Globe size={12} className="text-accent-color opacity-70" />
                        {t('Website')}
                    </label>
                    <input 
                        type="text" 
                        placeholder="www..."
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.website || ''} 
                        onChange={e => setOrgForm({...orgForm, website: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
                <div className="space-y-1.5 lg:col-span-4">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 block ml-1">
                        <MapPin size={12} className="text-accent-color opacity-70" />
                        {t('Google Maps Link (Headquarters/Home)')}
                    </label>
                    <input 
                        type="text" 
                        placeholder={t('Link Maps (Optimizare traseu)...')}
                        className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                        value={orgForm.mapsLink || ''} 
                        onChange={e => setOrgForm({...orgForm, mapsLink: e.target.value})} 
                        disabled={readOnly}
                    />
                </div>
            </div>
          </div>

          {/* Bank Details */}
          {accountType !== 'PF' && (
            <div className="pt-4 border-t border-border-color/50">
              <h4 className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                < Landmark size={12} />
                {t('Banking Details')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Bank Name')}</label>
                      <input 
                          type="text" 
                          className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                          value={orgForm.banca || ''} 
                          onChange={e => setOrgForm({...orgForm, banca: e.target.value})} 
                          disabled={readOnly}
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('IBAN Account')}</label>
                      <input 
                          type="text" 
                          placeholder="RO..."
                          className="w-full bg-bg-main rounded-md px-4 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                          value={orgForm.iban || ''} 
                          onChange={e => setOrgForm({...orgForm, iban: e.target.value})} 
                          disabled={readOnly}
                      />
                  </div>
              </div>
            </div>
          )}

          {/* Section 2: Weekly Schedule */}
          {accountType !== 'PF' && (
            <div className="pt-4 border-t border-border-color/50">
              <h4 className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Calendar size={12} />
                {t('Weekly Schedule')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Work Days')}</label>
                  <select 
                    className="w-full bg-bg-main rounded-md px-3 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-xs disabled:opacity-70 disabled:cursor-not-allowed"
                    value={orgForm.workDays || 'L-S'}
                    onChange={e => setOrgForm({...orgForm, workDays: e.target.value as 'L-V' | 'L-S' | 'L-D'})}
                    disabled={readOnly}
                  >
                    <option value="L-V">{t('Monday - Friday')}</option>
                    <option value="L-S">{t('Monday - Saturday')}</option>
                    <option value="L-D">{t('Monday - Sunday')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Start Time')}</label>
                  <select 
                    className="w-full bg-bg-main rounded-md px-3 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-xs disabled:opacity-70 disabled:cursor-not-allowed"
                    value={orgForm.startTime || '09:00'}
                    onChange={e => setOrgForm({...orgForm, startTime: e.target.value})}
                    disabled={readOnly}
                  >
                    {['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'].map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('End Time')}</label>
                  <select 
                    className="w-full bg-bg-main rounded-md px-3 py-2.5 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-xs disabled:opacity-70 disabled:cursor-not-allowed"
                    value={orgForm.endTime || '17:00'}
                    onChange={e => setOrgForm({...orgForm, endTime: e.target.value})}
                    disabled={readOnly}
                  >
                    {['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'].map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Finance & Billing */}
          {accountType !== 'PF' && (
            <div className="pt-4 border-t border-border-color/50">
              <h4 className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                < Landmark size={12} />
                {t('Finance & Billing')}
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Default Billable Months')}</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {months.map((month, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (readOnly) return;
                          const newMonths = orgForm.billableMonths.includes(index)
                            ? orgForm.billableMonths.filter(m => m !== index)
                            : [...orgForm.billableMonths, index];
                          setOrgForm({ ...orgForm, billableMonths: newMonths });
                        }}
                        className={`py-2 rounded-md text-[11px] font-bold uppercase transition-all border ${
                          orgForm.billableMonths.includes(index)
                            ? 'bg-accent-color text-white border-accent-color shadow-sm'
                            : 'bg-bg-main text-text-secondary border-border-color hover:bg-accent-color/5'
                        }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Default Invoice Day')}</label>
                    <input 
                      type="number" 
                      min="1" max="31"
                      className="w-full bg-bg-main rounded-md px-4 py-2 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                      value={orgForm.defaultInvoiceDay || ''} 
                      onChange={e => setOrgForm({...orgForm, defaultInvoiceDay: Number(e.target.value)})}
                      disabled={readOnly}
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Default Due Day')}</label>
                    <input 
                      type="number" 
                      min="1" max="31"
                      className="w-full bg-bg-main rounded-md px-4 py-2 outline-none font-bold border border-border-color focus:border-accent-color transition-all text-main text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
                      value={orgForm.defaultDueDay || ''} 
                      onChange={e => setOrgForm({...orgForm, defaultDueDay: Number(e.target.value)})}
                      disabled={readOnly}
                      placeholder="Ex: 15"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!readOnly && (
            <button 
              type="submit" 
              disabled={isUpdatingOrg} 
              className="w-full stihl-button py-3.5 rounded-md font-black uppercase tracking-widest text-[11px] shadow-lg transition-all active:scale-[0.98] text-white"
            >
              {isUpdatingOrg ? t('Syncing Cloud') : (accountType === 'PF' ? t('Update Garden Profile') : t('Update Company Profile'))}
            </button>
          )}
        </form>
      </section>
      )}

      {/* Visual Configuration Section (Separated) */}
      {(view === 'all' || view === 'visual') && (
      <section className="stihl-card rounded-lg p-6 relative overflow-hidden h-fit bg-bg-card border border-border-color">
        <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
          <Palette size={16} className="text-accent-color" />
          {t('Visual Configuration')}
        </h3>

        <div className="space-y-6">
          {/* Contract Type Colors */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Contract Type Colors')}</label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Maintenance')}</label>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: orgForm.contractTypeColors?.maintenance || '#3b82f6' }}></div>
                </div>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer border border-border-color p-0.5 bg-bg-main disabled:opacity-50"
                  value={orgForm.contractTypeColors?.maintenance || '#3b82f6'}
                  onChange={e => setOrgForm({...orgForm, contractTypeColors: {...orgForm.contractTypeColors, maintenance: e.target.value}})}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase">{t('One-Time Works')}</label>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: orgForm.contractTypeColors?.oneTime || '#f97316' }}></div>
                </div>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer border border-border-color p-0.5 bg-bg-main disabled:opacity-50"
                  value={orgForm.contractTypeColors?.oneTime || '#f97316'}
                  onChange={e => setOrgForm({...orgForm, contractTypeColors: {...orgForm.contractTypeColors, oneTime: e.target.value}})}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase">{t('Inactive')}</label>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: orgForm.contractTypeColors?.inactive || '#ef4444' }}></div>
                </div>
                <input type="color" className="w-full h-10 rounded-lg cursor-pointer border border-border-color p-0.5 bg-bg-main disabled:opacity-50"
                  value={orgForm.contractTypeColors?.inactive || '#ef4444'}
                  onChange={e => setOrgForm({...orgForm, contractTypeColors: {...orgForm.contractTypeColors, inactive: e.target.value}})}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* Accent Colors */}
          <div className="space-y-4 pt-4 border-t border-border-color/50">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block ml-1">{t('Accent Colors')} ({t('Personalization')})</label>
            <div className="grid grid-cols-5 gap-3">
              {orgForm.accentColors.map((color, index) => (
                <div key={index} className="space-y-2">
                  <input 
                    type="color" 
                    className="w-full h-12 rounded-xl cursor-pointer border border-border-color p-1 bg-bg-main shadow-sm hover:shadow-md transition-shadow disabled:opacity-50"
                    value={color ?? '#000000'}
                    onChange={(e) => {
                      const newColors = [...orgForm.accentColors];
                      newColors[index] = e.target.value;
                      setOrgForm({...orgForm, accentColors: newColors});
                    }}
                    disabled={readOnly}
                  />
                  <input 
                    type="text" 
                    className="w-full text-[8px] bg-bg-main border border-border-color rounded py-1 text-center font-black text-text-secondary uppercase disabled:opacity-50"
                    value={color ?? ''}
                    onChange={(e) => {
                      const newColors = [...orgForm.accentColors];
                      newColors[index] = e.target.value;
                      setOrgForm({...orgForm, accentColors: newColors});
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

export default OrganizationSettings;

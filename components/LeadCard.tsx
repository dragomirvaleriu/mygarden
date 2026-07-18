import React from 'react';
import { PotentialClient, Page } from '../src/types';
import { Phone, MapPin, Pencil, Trash2, UserPlus, Eye, FileText, X, Calendar, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { ro, enUS, pl, cs } from 'date-fns/locale';

interface LeadCardProps {
  lead: PotentialClient;
  onNavigate: (page: Page, id?: string) => void;
  onEdit: (lead: PotentialClient) => void;
  onDelete: (leadId: string) => void;
  onUpdateStatus: (leadId: string, status: string) => void;
  onUpdateNote: (leadId: string, note: string) => void;
  onOpenLostReason: (leadId: string) => void;
  canEditNotes?: boolean;
  showScheduledDate?: boolean;
  scheduledDate?: string;
}

const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  onNavigate,
  onEdit,
  onDelete,
  onUpdateStatus,
  onUpdateNote,
  onOpenLostReason,
  canEditNotes = false,
  showScheduledDate = false,
  scheduledDate
}) => {
  const { t, i18n } = useTranslation();
  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;
  
  const statusColors = {
    'activ': 'bg-blue-500/10 text-blue-500',
    'vizualizat': 'bg-yellow-500/10 text-yellow-500',
    'ofertat': 'bg-purple-500/10 text-purple-500',
    'confirmat': 'bg-green-500/10 text-green-500',
    'pierdut': 'bg-red-500/10 text-red-500'
  };

  const statusLabels = {
    'activ': t('New'),
    'vizualizat': t('To see'),
    'ofertat': t('Waiting response'),
    'confirmat': t('Converted'),
    'pierdut': t('Lost')
  };

  return (
    <div className="bg-lead-accent hover:bg-lead-accent-hover p-2.5 pb-6 hover:border-accent-color/50 border border-transparent rounded-xl transition-colors flex flex-col h-full relative group text-sm shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 truncate">
          <h3 className="text-base font-bold text-main leading-tight truncate">{lead.nume || t('No Name')}</h3>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${statusColors[lead.status]}`}>
            {statusLabels[lead.status] || lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(Page.ClientForm, `lead:${lead.id}`); }}
            className="p-1.5 text-text-secondary hover:text-green-500 hover:bg-green-500/10 rounded transition-colors"
            title={t('Convert to Client')}
          >
            <UserPlus size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
            className="p-1.5 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded transition-colors"
            title={t('Edit Lead')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
            className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title={t('Delete Lead')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 flex-grow">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5 shrink-0">
            <Phone size={14} className="text-accent-color" />
            <a href={`tel:${lead.telefon}`} className="hover:text-accent-color transition-colors">{lead.telefon}</a>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPin size={14} className="text-accent-color shrink-0" />
            <span className="truncate" title={lead.adresa}>{lead.adresa}</span>
          </div>
        </div>

        <div className="mt-2">
          {canEditNotes ? (
            <textarea
              defaultValue={lead.notite || ''}
              onBlur={(e) => {
                if (e.target.value !== lead.notite) {
                  onUpdateNote(lead.id, e.target.value);
                }
              }}
              placeholder={t('Add notes...')}
              className="w-full p-2 bg-black/5 dark:bg-white/5 rounded text-xs text-text-secondary border border-transparent focus:border-accent-color/30 focus:bg-transparent outline-none resize-none transition-all"
              rows={2}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs text-text-secondary italic line-clamp-2 px-2">
              {lead.notite || t('No Name')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap gap-1">
        {lead.status !== 'confirmat' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, 'vizualizat'); }}
              className={`flex-1 px-1 py-1 rounded text-[11px] font-bold transition-colors flex items-center justify-center gap-1 ${lead.status === 'vizualizat' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-black/5 dark:bg-white/5 text-text-secondary hover:bg-yellow-500/10 hover:text-yellow-600'}`}
            >
              <Eye size={12} />
              {t('To see')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(lead.id, 'ofertat'); }}
              className={`flex-1 px-1 py-1 rounded text-[11px] font-bold transition-colors flex items-center justify-center gap-1 ${lead.status === 'ofertat' ? 'bg-purple-500/20 text-purple-600' : 'bg-black/5 dark:bg-white/5 text-text-secondary hover:bg-purple-500/10 hover:text-purple-600'}`}
            >
              <FileText size={12} />
              {t('Waiting response')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenLostReason(lead.id); }}
              className={`flex-1 px-1 py-1 rounded text-[11px] font-bold transition-colors flex items-center justify-center gap-1 ${lead.status === 'pierdut' ? 'bg-red-500/20 text-red-600' : 'bg-black/5 dark:bg-white/5 text-text-secondary hover:bg-red-500/10 hover:text-red-600'}`}
            >
              <X size={12} />
              {t('Lost')}
            </button>
          </>
        )}
        {lead.status === 'pierdut' && lead.lostReason && (
           <div className="w-full text-[11px] text-red-500 font-medium text-center">
             {t('Reason')}: {lead.lostReason}
           </div>
        )}
      </div>

      <div className="absolute bottom-1 left-2 flex items-center gap-3 text-[11px] text-text-secondary">
        {showScheduledDate && scheduledDate ? (
          <div className="flex items-center gap-1 font-bold text-accent-color">
            <CalendarClock size={10} className="shrink-0" />
            <span>{format(new Date(scheduledDate), 'd MMMM', { locale: currentLocale })}</span>
          </div>
        ) : (
          <>
            {lead.data && (!lead.nextActionDate || format(new Date(lead.data), 'dd/MM/yyyy') !== format(new Date(lead.nextActionDate), 'dd/MM/yyyy')) && (
              <div className="flex items-center gap-1" title={t('Date Added')}>
                <Calendar size={10} className="text-accent-color shrink-0" />
                <span>{format(new Date(lead.data), 'd MMMM', { locale: currentLocale })}</span>
              </div>
            )}
            {lead.nextActionDate && (
              <div className="flex items-center gap-1 font-medium text-accent-color" title={t('Next Action')}>
                <CalendarClock size={10} className="shrink-0" />
                <span>{format(new Date(lead.nextActionDate), 'd MMMM', { locale: currentLocale })}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeadCard;

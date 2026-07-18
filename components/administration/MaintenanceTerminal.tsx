import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Zap, Trash2 } from 'lucide-react';

interface Props {
  terminalLogs: string[];
  isProcessing: boolean;
  setConfirmationModal: (modal: any) => void;
  orgName: string;
}

const MaintenanceTerminal: React.FC<Props> = ({
  terminalLogs,
  isProcessing,
  setConfirmationModal,
  orgName
}) => {
  const { t } = useTranslation();

  const generateMathChallenge = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return {
      question: `${a} + ${b}`,
      answer: a + b
    };
  };

  return (
    <section className="stihl-card rounded-lg p-6 relative overflow-hidden h-fit bg-bg-card border border-border-color">
      <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-8 flex items-center gap-2">
        <Database size={16} className="text-accent-color" />
        {t('Maintenance Terminal')}
      </h3>
      <div className="h-64 bg-bg-main rounded-xl p-5 border border-border-color overflow-y-auto font-mono text-[11px] leading-relaxed text-text-secondary space-y-2 custom-scrollbar shadow-inner">
        {terminalLogs.map((log, i) => (
          <p key={i} className={`whitespace-pre-wrap ${log.includes('✅') ? 'text-green-500' : log.includes('❌') ? 'text-red-500' : log.includes('⚠️') ? 'text-yellow-500' : ''}`}>
            {log}
          </p>
        ))}
      </div>
    </section>
  );
};

export default MaintenanceTerminal;

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db, collection, onSnapshot, doc, deleteDoc, query, where, writeBatch, serverTimestamp, addDoc, getDoc, getDocs } from '../services/firebase';
import { Visit, Client, ServiceType, PaymentHistory, Property } from '../src/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, PieChart, Pie } from 'recharts';
import { Trash2, TrendingUp, TrendingDown, Users, CalendarCheck, Wallet, HandCoins, ArrowUpRight, ArrowDownRight, DollarSign, FileDown, Loader2, AlertTriangle, BellRing, Check, X, Sprout, Maximize, FileSpreadsheet, CreditCard, CalendarClock, ChevronDown, BarChart2, CalendarDays } from 'lucide-react';
import { format, startOfMonth, startOfDay, endOfDay, parseISO, isWithinInterval, eachDayOfInterval, subDays, subMonths, subYears, getDay, isSameDay, eachWeekOfInterval, endOfWeek, startOfWeek, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { exportToExcel } from '../utils/export';
import { getWhatsAppLink } from '../utils/phone';
import { PaymentModal } from '../components/PaymentModal';
import { ExportFormatModal } from '../components/reports/ExportFormatModal';
import { MaintenanceTooltip, ProjectsTooltip } from '../components/reports/Tooltips';
import { PageSkeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { isDebtor } from '../utils/clientUtils';

interface Props {
  organizationId: string;
}

const MonthlyCollectionsTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const growth = data.prevValue ? ((data.value - data.prevValue) / data.prevValue) * 100 : 0;
    return (
      <div className="bg-bg-card p-3 border border-border-color rounded-xl shadow-lg min-w-[160px] relative z-50">
        <p className="text-xs font-black text-text-secondary uppercase mb-1">{data.name}</p>
        <p className={`text-sm font-black ${data.isForecast ? 'text-emerald-500' : 'text-main'}`}>
          {data.value.toLocaleString()} RON
        </p>
        {data.isForecast && (
          <p className="text-[10px] text-emerald-500/70 font-bold mt-0.5">Prognoză</p>
        )}
        {!data.isForecast && data.prevValue > 0 && (
          <>
            <p className="text-[10px] text-text-secondary/60 mt-1">Luna prec.: {data.prevValue.toLocaleString()} RON</p>
            <div className={`mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit ${growth >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {growth > 0 ? '+' : ''}{growth.toFixed(1)}% vs. lună precedentă
            </div>
          </>
        )}
      </div>
    );
  }
  return null;
};

const ReportsPage: React.FC<Props> = ({ organizationId }) => {
  const { t, i18n } = useTranslation();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  // Existing states...

  
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [workDays, setWorkDays] = useState<'L-V' | 'L-S' | 'L-D'>('L-S');
  const [orgData, setOrgData] = useState<any>(null);
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'with_balance' | 'no_balance'>('all');
  const [paymentsListModal, setPaymentsListModal] = useState<{ filterType: 'all' | 'maintenance' | 'projects'; paymentMethod?: 'all' | 'cash' | 'cont'; } | null>(null);
  const [debtsListModal, setDebtsListModal] = useState<{ filterType: 'all' | 'maintenance' | 'projects'; paymentMethod?: 'all' | 'cash' | 'cont'; } | null>(null);
  const [forecastListModal, setForecastListModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'operational' | 'financial'>('operational');
  
  const [exportModalType, setExportModalType] = useState<'card' | 'cash' | 'financial' | null>(null);

  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, client: Client | null, amount: string}>({isOpen: false, client: null, amount: ''});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return format(d, 'yyyy-MM-dd');
  });

  const setDatePreset = (preset: 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const d = new Date();
    if (preset === 'thisMonth') {
      setStartDate(format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(d, 'yyyy-MM-dd'));
    } else if (preset === 'lastMonth') {
      setStartDate(format(new Date(d.getFullYear(), d.getMonth() - 1, 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(d.getFullYear(), d.getMonth(), 0), 'yyyy-MM-dd'));
    } else if (preset === 'thisYear') {
      setStartDate(format(new Date(d.getFullYear(), 0, 1), 'yyyy-MM-dd'));
      setEndDate(format(d, 'yyyy-MM-dd'));
    }
  };

  useEffect(() => {
    if (window.innerWidth < 768) {
      const element = document.getElementById('reports-content-anchor');
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const getAttributedAmount = (p: PaymentHistory, start: Date, end: Date) => {
    const pDate = p.date?.toDate ? p.date.toDate() : null;
    if (pDate && pDate >= start && pDate <= end) {
      return p.amount || 0;
    }
    return 0;
  };

  const pastMonthsOptions = useMemo(() => {
    const options = [];
    const d = new Date();
    for (let i = 1; i <= 12; i++) {
      const pastD = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const monthName = pastD.toLocaleString(i18n.language === 'ro' ? 'ro-RO' : 'en-US', { month: 'long', year: 'numeric' });
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      options.push({
        label: capitalized,
        value: i // how many months ago
      });
    }
    return options;
  }, [i18n.language]);

  const selectedPastMonthValue = useMemo(() => {
    if (!startDate || !endDate) return "";
    const d = new Date();
    for (let i = 1; i <= 12; i++) {
      const start = format(new Date(d.getFullYear(), d.getMonth() - i, 1), 'yyyy-MM-dd');
      const end = format(new Date(d.getFullYear(), d.getMonth() - i + 1, 0), 'yyyy-MM-dd');
      if (startDate === start && endDate === end) {
        return String(i);
      }
    }
    return "";
  }, [startDate, endDate]);


  const visitsQuery = useMemo(() => organizationId ? query(collection(db, 'visits'), where('organizationId', '==', organizationId)) : null, [organizationId]);
  const { data: visits, loading: loadingVisits } = useFirestoreQuery<Visit>(visitsQuery, { pageSize: 0 });

  const clientsQuery = useMemo(() => organizationId ? query(collection(db, 'clients'), where('organizationId', '==', organizationId)) : null, [organizationId]);
  const { data: clients, loading: loadingClients } = useFirestoreQuery<Client>(clientsQuery, { pageSize: 0 });

  const historyQuery = useMemo(() => organizationId ? query(collection(db, 'client_history'), where('organizationId', '==', organizationId), where('type', '==', 'payment')) : null, [organizationId]);
  const { data: paymentHistory, loading: loadingHistory } = useFirestoreQuery<PaymentHistory>(historyQuery, { pageSize: 0 });

  const servicesQuery = useMemo(() => organizationId ? query(collection(db, 'service_types'), where('organizationId', '==', organizationId)) : null, [organizationId]);
  const { data: serviceTypes, loading: loadingServices } = useFirestoreQuery<ServiceType>(servicesQuery, { pageSize: 0 });

  const propertiesQuery = useMemo(() => organizationId ? query(collection(db, 'properties'), where('organizationId', '==', organizationId)) : null, [organizationId]);
  const { data: properties, loading: loadingProperties } = useFirestoreQuery<Property>(propertiesQuery, { pageSize: 0 });

  const augmentedClients = useMemo(() => {
    const normalizeType = (type: string | undefined | null): 'maintenance' | 'one-time' => {
      if (!type) return 'maintenance';
      const lower = type.toLowerCase();
      if (lower.includes('proiect') || lower.includes('lucrare') || lower.includes('project') || lower.includes('one-time') || lower.includes('one_time')) {
        return 'one-time';
      }
      return 'maintenance';
    };

    return (clients || []).map(client => {
      const clientProps = (properties || []).filter(p => p.clientId === client.id);
      if (clientProps.length === 0) return {
        ...client,
        sold: client.sold || 0,
        tarifLunar: client.tarifLunar || 0,
        contractType: normalizeType(client.contractType)
      };

      let totalSold = 0;
      let totalTarif = 0;
      let ziScadenta = client.ziScadenta;
      let dataScadenta = client.dataScadenta;

      const hasMaintenance = clientProps.some(p => {
        const pType = (p.contractType || '').toLowerCase();
        return pType === 'maintenance' || pType.includes('mentenanț') || pType.includes('mentenant');
      });

      let rawContractType = client.contractType;
      if (hasMaintenance) {
        rawContractType = 'maintenance';
      } else if (clientProps.length > 0 && clientProps[0].contractType) {
        rawContractType = clientProps[0].contractType;
      }

      const contractType = normalizeType(rawContractType);

      clientProps.forEach(p => {
        totalSold += Number(p.sold || 0);
        totalTarif += Number(p.tarifLunar || 0);
        if (Number(p.sold || 0) > 0 && p.ziScadenta && (!ziScadenta || p.ziScadenta < ziScadenta)) {
          ziScadenta = p.ziScadenta;
        }
        if (p.dataScadenta) {
          dataScadenta = p.dataScadenta;
        }
      });

      return {
        ...client,
        sold: totalSold,
        tarifLunar: totalTarif,
        contractType,
        ziScadenta,
        dataScadenta
      };
    });
  }, [clients, properties]);

  const latestPaymentsTicker = useMemo(() => {
    return (paymentHistory || [])
      .filter(p => p.amount > 0)
      .sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const db = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return db - da;
      })
      .slice(0, 15)
      .map(p => {
        const client = (clients || []).find(c => c.id === p.clientId);
        const name = client ? (client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume) : 'Client Necunoscut';
        const dateStr = p.date?.toDate ? format(p.date.toDate(), 'dd/MM/yyyy') : '';
        return { ...p, clientName: name, dateStr };
      });
  }, [paymentHistory, clients]);



  const loading = loadingVisits || loadingClients || loadingHistory || loadingServices || loadingProperties;

  useEffect(() => {
    if (!organizationId) return;

    const unsubOrg = onSnapshot(doc(db, 'organizations', organizationId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOrgData(data);
        if (data.workDays) {
          setWorkDays(data.workDays);
        }
      }
    }, (err) => {
      console.error("Error in organization settings listener:", err);
    });

    return () => {
      unsubOrg();
    };
  }, [organizationId]);



  // Export modal Încasări în Perioadă — PDF
  const downloadPaymentsModalPDF = () => {
    if (!paymentsListModal) return;
    const doc = new jsPDF();
    const typeLabel = paymentsListModal.filterType === 'all'
      ? t('All')
      : paymentsListModal.filterType === 'maintenance'
        ? t('Maintenance')
        : t('One-time Projects');
    const methodLabel = paymentsListModal.paymentMethod === 'cash'
      ? 'Cash'
      : paymentsListModal.paymentMethod === 'cont'
        ? 'Cont'
        : t('All');
    doc.text(`${t('Collections List')} (${typeLabel} - ${methodLabel}) - ${format(parseISO(startDate), 'dd.MM')} / ${format(parseISO(endDate), 'dd.MM')}`, 14, 15);

    const tableData = filteredPaymentsForModal.map(p => [
      p.date?.toDate ? format(p.date.toDate(), 'dd.MM.yyyy') : '-',
      p.clientName,
      `${(p.amount || 0).toLocaleString()} RON`,
      p.preferredPayment === 'cash' ? 'Cash' : 'Cont'
    ]);

    autoTable(doc, {
      head: [[t('Date'), t('Client'), t('Amount'), t('Payment')]],
      body: tableData,
      startY: 25,
    });

    doc.save(`${t('Collections')}_${paymentsListModal.filterType}_${paymentsListModal.paymentMethod || 'all'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Export modal Încasări în Perioadă — Excel
  const downloadPaymentsModalExcel = () => {
    if (!paymentsListModal) return;
    const excelData = filteredPaymentsForModal.map(p => ({
      [t('Date')]: p.date?.toDate ? format(p.date.toDate(), 'dd.MM.yyyy') : '-',
      [t('Client')]: p.clientName,
      [t('Amount')]: p.amount || 0,
      [t('Payment')]: p.preferredPayment === 'cash' ? 'Cash' : 'Cont',
      [t('Details')]: p.details || ''
    }));
    exportToExcel(excelData, `${t('Collections')}_${paymentsListModal.filterType}_${paymentsListModal.paymentMethod || 'all'}_${format(new Date(), 'yyyy-MM-dd')}`);
  };


  const executeFinancialReportExport = (formatType: 'pdf' | 'excel' | 'word' | 'txt') => {
    // Sort clients alphabetically, then separate active and inactive
    const sortedClients = [...augmentedClients].sort((a, b) => {
      const aName = a.tip_persoana === 'PJ' ? (a.numeFirma || a.nume || '') : (a.nume || '');
      const bName = b.tip_persoana === 'PJ' ? (b.numeFirma || b.nume || '') : (b.nume || '');
      return aName.localeCompare(bName);
    });

    const activeClients = sortedClients.filter(c => c.status === 'Activ');
    const inactiveClients = sortedClients.filter(c => c.status !== 'Activ');
    const finalClients = [...activeClients, ...inactiveClients];

    const getClientName = (c: any) => c.tip_persoana === 'PJ' ? (c.numeFirma || c.nume) : c.nume;
    const getPayment = (c: any) => c.preferredPayment === 'cash' ? 'cash' : 'CONT / CARD';

    const flatData = finalClients.map(c => ({
        [t('Client')]: c.status !== 'Activ' ? `[INACTIV] ${getClientName(c)}` : getClientName(c),
        [t('Type')]: c.tip_persoana,
        [t('Monthly Tariff')]: c.tarifLunar || 0,
        [t('Balance')]: c.sold || 0,
        [t('Status')]: c.status,
        [t('Payment')]: getPayment(c)
    }));

    const fileNameBase = `${t('Financial Report')}_${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === 'excel') {
      exportToExcel(flatData, fileNameBase);
    } else if (formatType === 'txt') {
      let txtContent = `${t('Financial Report')} - ${format(new Date(), 'dd/MM/yyyy')}\n\n`;
      flatData.forEach(row => {
        txtContent += `${row[t('Client')]} | ${row[t('Type')]} | ${row[t('Monthly Tariff')]} RON | ${row[t('Balance')]} RON | ${row[t('Status')]} | ${row[t('Payment')]}\n`;
      });
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileNameBase}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (formatType === 'word') {
      let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>`;
      htmlContent += `<h2>${t('Financial Report')} - ${format(new Date(), 'dd/MM/yyyy')}</h2>`;
      htmlContent += `<table border="1" style="border-collapse: collapse; width: 100%;"><thead><tr>`;
      htmlContent += `<th>${t('Client')}</th><th>${t('Type')}</th><th>${t('Monthly Tariff')}</th><th>${t('Balance')}</th><th>${t('Status')}</th><th>${t('Payment')}</th></tr></thead><tbody>`;
      finalClients.forEach(c => {
        const isInactive = c.status !== 'Activ';
        const wrap = (val: any) => isInactive ? `<s><span style="color: grey;">${val}</span></s>` : val;
        htmlContent += `<tr><td>${wrap(getClientName(c))}</td><td>${wrap(c.tip_persoana)}</td><td>${wrap((c.tarifLunar || 0) + ' RON')}</td><td>${wrap((c.sold || 0) + ' RON')}</td><td>${wrap(c.status)}</td><td>${wrap(getPayment(c))}</td></tr>`;
      });
      htmlContent += `</tbody></table></body></html>`;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileNameBase}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const doc = new jsPDF();
      doc.text(`${t('Financial Report')} - ${format(new Date(), 'dd/MM/yyyy')}`, 14, 15);
  
      const tableData = finalClients.map(c => [
          getClientName(c),
          c.tip_persoana,
          `${c.tarifLunar || 0} RON`,
          `${c.sold || 0} RON`,
          c.status,
          getPayment(c)
      ]);
  
      (doc as any).autoTable({
          head: [[t('Client'), t('Type'), t('Monthly Tariff'), t('Balance'), t('Status'), t('Payment')]],
          body: tableData,
          startY: 25,
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const status = finalClients[data.row.index].status;
              if (status !== 'Activ') {
                data.cell.styles.textColor = [150, 150, 150];
              }
            }
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body') {
              const status = finalClients[data.row.index].status;
              if (status !== 'Activ') {
                doc.setDrawColor(255, 0, 0);
                doc.setLineWidth(0.5);
                const startX = data.cell.x + data.cell.padding('left');
                const startY = data.cell.y + data.cell.height / 2;
                const endX = data.cell.x + data.cell.width - data.cell.padding('right');
                doc.line(startX, startY, endX, startY);
              }
            }
          }
      });
  
      doc.save(`${fileNameBase}.pdf`);
    }
  };

  const downloadDebtsPDF = () => {
    if (!debtsListModal) return;
    const doc = new jsPDF();
    const typeLabel = debtsListModal.filterType === 'all' 
      ? t('All') 
      : debtsListModal.filterType === 'maintenance' 
        ? t('Maintenance') 
        : t('One-Time Works');
    const methodLabel = debtsListModal.paymentMethod === 'cash' 
      ? 'Cash' 
      : debtsListModal.paymentMethod === 'cont' 
        ? 'Cont' 
        : t('All');
    
    doc.text(`${t('Outstanding Debts')} (${typeLabel} - ${methodLabel}) - ${format(new Date(), 'dd/MM/yyyy')}`, 14, 15);

    const activeDebtors = filteredDebtorsForModal.filter(c => c.status === 'Activ');
    const inactiveDebtors = filteredDebtorsForModal.filter(c => c.status !== 'Activ');

    const formatRow = (c: any) => {
        const sold = c.sold || 0;
        const tarifLunar = c.tarifLunar || 0;
        const restanta = Math.max(0, sold - tarifLunar);
        const curenta = Math.min(sold, tarifLunar);
        return [
            c.clientName,
            c.ageDays > 0 ? `${c.ageDays} ${t('days overdue')}` : t('Within Term'),
            `${curenta} RON`,
            `${restanta} RON`,
            `${sold} RON`,
            c.preferredPayment === 'cash' ? 'Cash' : 'Card / Cont'
        ];
    };

    autoTable(doc, {
        head: [[t('Client'), t('Overdue Status'), 'Tarif Lunar', 'Restanțe', 'Total', t('Payment')]],
        body: activeDebtors.map(formatRow),
        startY: 25,
    });

    if (inactiveDebtors.length > 0) {
        const finalY = (doc as any).lastAutoTable.finalY || 25;
        doc.text("Clienți Inactivi / Fostă Colaborare (Cu Sold)", 14, finalY + 10);
        autoTable(doc, {
            head: [[t('Client'), t('Overdue Status'), 'Tarif Lunar', 'Restanțe', 'Total', t('Payment')]],
            body: inactiveDebtors.map(formatRow),
            startY: finalY + 15,
        });
    }

    doc.save(`${t('Outstanding Debts')}_${debtsListModal.filterType}_${debtsListModal.paymentMethod || 'all'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const downloadDebtsExcel = () => {
    if (!debtsListModal) return;

    const sorted = [...filteredDebtorsForModal].sort((a, b) => {
        if (a.status === 'Activ' && b.status !== 'Activ') return -1;
        if (a.status !== 'Activ' && b.status === 'Activ') return 1;
        return 0;
    });

    const excelData = sorted.map(c => {
        const sold = c.sold || 0;
        const tarifLunar = c.tarifLunar || 0;
        const restanta = Math.max(0, sold - tarifLunar);
        const curenta = Math.min(sold, tarifLunar);
        
        return {
            [t('Client')]: c.clientName,
            'Status Client': c.status === 'Activ' ? 'Activ' : 'Inactiv',
            [t('Overdue Status')]: c.ageDays > 0 ? `${c.ageDays} ${t('days overdue')}` : t('Within Term'),
            'Tarif Lunar': curenta,
            'Restanțe': restanta,
            'Total': sold,
            [t('Payment')]: c.preferredPayment === 'cash' ? 'Cash' : 'Card / Cont'
        };
    });

    exportToExcel(excelData, `${t('Outstanding Debts')}_${debtsListModal.filterType}_${debtsListModal.paymentMethod || 'all'}_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleDeletePayment = async (paymentId: string) => {
    const payment = paymentHistory.find(p => p.id === paymentId);
    if (!payment) return;

    setConfirmationModal({
      title: t("Delete Payment"),
      message: t("Are you sure you want to delete this payment? This action is irreversible and the amount will be added back to the client's debt."),
      onConfirm: async () => {
        setIsDeleting(paymentId);
        const toastId = toast.loading(t("Deleting payment..."));
        try {
          const batch = writeBatch(db);
          
          // 1. Delete the history record
          batch.delete(doc(db, 'client_history', paymentId));
          
          // 2. Restore invoice remaining amounts and statuses using allocations
          const allocations = payment.allocations || [];
          const propertySoldUpdates: Record<string, number> = {};

          if (allocations.length > 0) {
            for (const alloc of allocations) {
              const invRef = doc(db, 'invoices', alloc.invoiceId);
              const invSnap = await getDoc(invRef);
              if (invSnap.exists()) {
                const invData = invSnap.data();
                const currentRemaining = invData.remainingAmount || 0;
                const newRemaining = Number((currentRemaining + alloc.amount).toFixed(2));
                
                const invoiceAmount = invData.amount || 0;
                const newStatus = newRemaining >= invoiceAmount ? 'unpaid' : 'partially_paid';
                
                batch.update(invRef, {
                  remainingAmount: newRemaining,
                  status: newStatus
                });

                const propId = invData.propertyId;
                propertySoldUpdates[propId] = Number(((propertySoldUpdates[propId] || 0) + alloc.amount).toFixed(2));
              }
            }
            
            // Update each property's sold field based on restored amounts
            for (const propId of Object.keys(propertySoldUpdates)) {
              const prop = properties.find(p => p.id === propId);
              if (prop) {
                const currentSold = prop.sold || 0;
                const restoredAmount = propertySoldUpdates[propId];
                batch.update(doc(db, 'properties', propId), {
                  sold: Number((currentSold + restoredAmount).toFixed(2))
                });
              }
            }
          } else {
            // Fallback for historical payments (no allocations):
            // Restore the full amount to the first property
            const clientProps = properties.filter(p => p.clientId === payment.clientId);
            if (clientProps.length > 0) {
              const firstProp = clientProps[0];
              const currentSold = firstProp.sold || 0;
              const newSold = Number((currentSold + (payment.amount || 0)).toFixed(2));
              batch.update(doc(db, 'properties', firstProp.id), { sold: newSold });
              console.log(`[PAYMENT_DELETE] Fallback: Restored ${payment.amount} to property ${firstProp.id}. New sold: ${newSold}`);
            }
          }
          
          await batch.commit();
          toast.success(t("Payment deleted and balance restored"), { id: toastId });
        } catch (err: any) {
          console.error("Error deleting payment:", err);
          toast.error(t("Error deleting payment") + ": " + err.message, { id: toastId });
        } finally {
          setIsDeleting(null);
        }
      }
    });
  };


  const [isDownloadingInvoices, setIsDownloadingInvoices] = useState<'card' | 'cash' | null>(null);

  const executeInvoicesExport = async (paymentMethod: 'card' | 'cash', formatType: 'pdf' | 'excel' | 'word' | 'txt') => {
    setIsDownloadingInvoices(paymentMethod);
    const toastId = toast.loading(t('Fetching invoices...'));
    try {
      const parsedEnd = parseISO(endDate);
      const selectedMonthStr = `${parsedEnd.getFullYear()}-${String(parsedEnd.getMonth() + 1).padStart(2, '0')}`;
      
      const q = query(
        collection(db, 'invoices'),
        where('organizationId', '==', organizationId),
        where('billingMonth', '==', selectedMonthStr)
      );
      
      const snap = await getDocs(q);
      const fetchedInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      if (fetchedInvoices.length === 0) {
        toast.error(t('No invoices found for the selected month.'), { id: toastId });
        setIsDownloadingInvoices(null);
        return;
      }

      const invoicesByClient: Record<string, {
        clientName: string;
        addresses: string[];
        amount: number;
        remainingAmount: number;
        statusStr: string;
      }> = {};

      // 1. Add invoices for the current month
      fetchedInvoices.forEach(inv => {
        const client = augmentedClients.find(c => c.id === inv.clientId);
        if (!client) return;

        const isClientCash = client.preferredPayment === 'cash';
        if (paymentMethod === 'cash' ? !isClientCash : isClientCash) return;

        const clientName = client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume;
        const property = properties.find(p => p.id === inv.propertyId);
        const propertyAddress = property ? property.address : t('Unknown Location');

        if (!invoicesByClient[client.id]) {
          invoicesByClient[client.id] = {
            clientName,
            addresses: [],
            amount: 0,
            remainingAmount: client.sold || 0,
            statusStr: client.status || 'Activ'
          };
        }

        const clientGroup = invoicesByClient[client.id];
        if (propertyAddress && !clientGroup.addresses.includes(propertyAddress)) {
          clientGroup.addresses.push(propertyAddress);
        }
        clientGroup.amount += inv.amount || 0;
      });

      // 2. Add clients who have sold > 0 but NO invoice this month
      augmentedClients.forEach(client => {
        const isClientCash = client.preferredPayment === 'cash';
        if (paymentMethod === 'cash' ? !isClientCash : isClientCash) return;

        if ((client.sold || 0) > 0 && !invoicesByClient[client.id]) {
          const clientName = client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume;
          const clientProps = properties.filter(p => p.clientId === client.id).map(p => p.address);
          
          invoicesByClient[client.id] = {
            clientName,
            addresses: clientProps.length > 0 ? clientProps : [t('No address')],
            amount: 0, // No invoice this month
            remainingAmount: client.sold || 0,
            statusStr: client.status || 'Activ'
          };
        }
      });

      // Split into active and inactive
      const allInvoices = Object.values(invoicesByClient).sort((a, b) => a.clientName.localeCompare(b.clientName));
      const activeInvoices = allInvoices.filter(g => g.statusStr === 'Activ');
      const inactiveInvoices = allInvoices.filter(g => g.statusStr !== 'Activ');

      if (activeInvoices.length === 0 && inactiveInvoices.length === 0) {
        toast.error(t('No invoices or debts found for the selected payment method.'), { id: toastId });
        setIsDownloadingInvoices(null);
        return;
      }

      const monthName = new Date(selectedYear, selectedMonth).toLocaleString(i18n.language === 'ro' ? 'ro-RO' : 'en-US', { month: 'long' });
      const methodLabel = paymentMethod === 'cash' ? t('Cash') : t('Card / Transfer');
      const fileNameBase = `${t('Invoices')}_${monthName}_${selectedYear}_${paymentMethod === 'cash' ? 'Cash' : 'Card'}`;
      
      const flatData: any[] = [];
      const pushToFlat = (data: typeof allInvoices) => {
        data.forEach(inv => {
          let statusLabel = t('Unpaid');
          if (inv.remainingAmount <= 0) statusLabel = t('Paid');
          else if (inv.remainingAmount < inv.amount) statusLabel = t('Partial');

          flatData.push({
            [t('Client')]: inv.clientName,
            [t('Property')]: inv.addresses.join('; '),
            [t('Tarif Lunar')]: inv.amount || 0,
            [t('Sold Total')]: inv.remainingAmount || 0,
            [t('Status')]: statusLabel
          });
        });
      };
      pushToFlat(activeInvoices);
      const inactiveWithDebt = inactiveInvoices.filter(inv => inv.remainingAmount > 0);
      pushToFlat(inactiveWithDebt);

      if (formatType === 'excel') {
        exportToExcel(flatData, fileNameBase);
      } else if (formatType === 'txt') {
        let txtContent = `${t('Invoice List')} - ${monthName} ${selectedYear}\n${t('Payment Method')}: ${methodLabel}\n\n`;
        flatData.forEach(row => {
          txtContent += `${row[t('Client')]} | ${row[t('Property')]} | ${row[t('Tarif Lunar')]} RON | ${row[t('Sold Total')]} RON | ${row[t('Status')]}\n`;
        });
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileNameBase}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (formatType === 'word') {
        let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>`;
        htmlContent += `<h2>${t('Invoice List')} - ${monthName} ${selectedYear}</h2>`;
        htmlContent += `<p>${t('Payment Method')}: ${methodLabel}</p>`;
        htmlContent += `<table border="1" style="border-collapse: collapse; width: 100%;"><thead><tr>`;
        htmlContent += `<th>${t('Client')}</th><th>${t('Property')}</th><th>${t('Tarif Lunar')}</th><th>${t('Sold Total')}</th><th>${t('Status')}</th></tr></thead><tbody>`;
        flatData.forEach(row => {
          htmlContent += `<tr><td>${row[t('Client')]}</td><td>${row[t('Property')]}</td><td>${row[t('Tarif Lunar')]} RON</td><td>${row[t('Sold Total')]} RON</td><td>${row[t('Status')]}</td></tr>`;
        });
        htmlContent += `</tbody></table></body></html>`;
        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileNameBase}.doc`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`${t('Invoice List')} - ${monthName} ${selectedYear}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`${t('Payment Method')}: ${methodLabel}`, 14, 21);
        doc.text(`${t('Organization')}: ${orgData?.name || ''}`, 14, 27);

        let finalY = 33;

        // --- HELPER TO RENDER TABLE ---
        const renderTable = (data: typeof allInvoices, title: string, startY: number) => {
          if (data.length === 0) return startY;
          
          doc.setFontSize(12);
          doc.text(title, 14, startY);
          
          let totalInvoiced = 0;
          let totalRemaining = 0;

          const tableData = data.map(inv => {
            totalInvoiced += inv.amount || 0;
            totalRemaining += inv.remainingAmount || 0;

            let statusLabel = t('Unpaid');
            if (inv.remainingAmount <= 0) statusLabel = t('Paid');
            else if (inv.remainingAmount < inv.amount) statusLabel = t('Partial');

            return [
              inv.clientName,
              inv.addresses.join('\n'),
              `${inv.amount || 0} RON`,
              `${inv.remainingAmount || 0} RON`,
              statusLabel
            ];
          });

          tableData.push([
            t('Total'),
            '',
            `${totalInvoiced.toFixed(2)} RON`,
            `${totalRemaining.toFixed(2)} RON`,
            ''
          ]);

          autoTable(doc, {
            head: [[t('Client'), t('Property'), 'Tarif Lunar', 'Sold Total', t('Status')]],
            body: tableData,
            startY: startY + 5,
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            didParseCell: (data) => {
              if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 240, 240];
              }
            }
          });

          return (doc as any).lastAutoTable.finalY + 10;
        };

        if (activeInvoices.length > 0) {
          finalY = renderTable(activeInvoices, "Clienți Activi", finalY);
        }

        if (inactiveWithDebt.length > 0) {
          finalY = renderTable(inactiveWithDebt, "Clienți Inactivi / Fostă Colaborare (Cu Sold)", finalY);
        }

        doc.save(`${fileNameBase}.pdf`);
      }
      
      toast.success(t('Invoices list downloaded successfully'), { id: toastId });
    } catch (err: any) {
      console.error("[DOWNLOAD_INVOICES] Error:", err);
      toast.error(t('Error downloading invoices list') + ': ' + err.message, { id: toastId });
    } finally {
      setIsDownloadingInvoices(null);
    }
  };

  const downloadInvoices = (paymentMethod: 'card' | 'cash') => {
    setExportModalType(paymentMethod);
  };


  // Filter Data
  const filteredVisits = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    return visits.filter(v => {
      if (v.status !== 'Finalizat' || !v.completedAt) return false;
      const visitDate = v.completedAt?.toDate ? v.completedAt.toDate() : new Date(v.completedAt as any);
      return visitDate >= start && visitDate <= end;
    });
  }, [visits, startDate, endDate]);

  // Calculate Metrics
  const totalRevenue = useMemo(() => filteredVisits.reduce((acc, visit) => {
    const visitRevenue = visit.servicii_efectuate?.reduce((total, service) => {
      const serviceType = serviceTypes.find(st => st.id === service.serviceId);
      return total + (service.quantity || 1) * (serviceType?.cost || 0);
    }, 0) || 0;

    return acc + visitRevenue;
  }, 0), [filteredVisits, serviceTypes]);

  const totalVisits = filteredVisits.length;
  const { activeClientsCount, activePropertiesCount } = useMemo(() => {
    const activeClients = augmentedClients.filter(c => c.status === 'Activ');
    let clientsCount = 0;
    let propsCount = 0;

    activeClients.forEach(c => {
      const clientProps = properties.filter(p => p.clientId === c.id);
      
      const maintenanceProps = clientProps.filter(p => {
        const pType = (p.contractType || '').toLowerCase();
        return pType === 'maintenance' || pType.includes('mentenanț') || pType.includes('mentenant') || !pType;
      });

      if (maintenanceProps.length > 0) {
        clientsCount += 1;
        propsCount += maintenanceProps.length;
      } else if (clientProps.length === 0) {
        const cType = (c.contractType || '').toLowerCase();
        const isMaintenance = !cType || cType === 'maintenance' || cType.includes('mentenanț') || cType.includes('mentenant');
        if (isMaintenance) {
          clientsCount += 1;
          propsCount += 1;
        }
      }
    });

    return { activeClientsCount: clientsCount, activePropertiesCount: propsCount };
  }, [augmentedClients, properties]);  
  const visitedClientsCount = useMemo(() => {
    return (clients || []).filter(c => c.status === 'Activ').length;
  }, [clients]);

  const visitedPropertiesCount = useMemo(() => {
    const activeClientIds = new Set((clients || []).filter(c => c.status === 'Activ').map(c => c.id));
    return properties.filter(p => activeClientIds.has(p.clientId)).length;
  }, [properties, clients]);

  const totalOneTimeProperties = useMemo(() => {
    const activeClientIds = new Set((clients || []).filter(c => c.status === 'Activ').map(c => c.id));
    return properties.filter(p => (p.contractType === 'one-time' || p.contractType === 'project') && activeClientIds.has(p.clientId)).length;
  }, [properties, clients]);
  
  const totalMaintenanceClients = useMemo(() => {
    const activeClientIds = new Set((clients || []).filter(c => c.status === 'Activ').map(c => c.id));
    const maintenanceClientIds = new Set(properties.filter(p => p.contractType === 'maintenance' && activeClientIds.has(p.clientId)).map(p => p.clientId));
    return maintenanceClientIds.size;
  }, [properties, clients]);

  const totalOneTimeClients = useMemo(() => {
    const activeClientIds = new Set((clients || []).filter(c => c.status === 'Activ').map(c => c.id));
    const oneTimeClientIds = new Set(properties.filter(p => (p.contractType === 'one-time' || p.contractType === 'project') && activeClientIds.has(p.clientId)).map(p => p.clientId));
    return oneTimeClientIds.size;
  }, [properties, clients]);

  const totalActiveSurface = useMemo(() => {
    const activeClients = (clients || []).filter(c => c.status === 'Activ');
    let totalSurface = 0;

    activeClients.forEach(c => {
      const clientProps = properties.filter(p => p.clientId === c.id);
      
      const maintenanceProps = clientProps.filter(p => {
        const pType = (p.contractType || '').toLowerCase();
        return pType === 'maintenance' || pType.includes('mentenanț') || pType.includes('mentenant') || !pType;
      });

      if (maintenanceProps.length > 0) {
        // If they have maintenance properties, sum their areas
        totalSurface += maintenanceProps.reduce((sum, p) => sum + (Number((p.surfaceArea || '').toString().replace(/\D/g, '')) || Number((p.suprafataMp || '').toString().replace(/\D/g, '')) || 0), 0);
      } else if (clientProps.length === 0) {
        // If they have NO properties at all, check if the client itself is considered maintenance
        const cType = (c.contractType || '').toLowerCase();
        const isMaintenance = !cType || cType === 'maintenance' || cType.includes('mentenanț') || cType.includes('mentenant');
        if (isMaintenance) {
          totalSurface += (Number((c.suprafataMp || '').toString().replace(/\D/g, '')) || Number((c.areaSqm || '').toString().replace(/\D/g, '')) || 0);
        }
      }
    });

    return totalSurface;
  }, [clients, properties]);

  const fertilizerNeededKg = useMemo(() => {
    const rate = orgData?.defaultFertilizerDosage || 30; // Default 30g/mp
    return (totalActiveSurface * rate) / 1000;
  }, [totalActiveSurface, orgData]);

  const { forecastNextMonth, forecastPropertiesCount, forecastClientsList } = useMemo(() => {
    const currentSystemMonth = new Date().getMonth();
    const nextMonth = (currentSystemMonth + 1) % 12;
    const isNextMonthBillable = orgData?.billableMonths ? orgData.billableMonths.includes(nextMonth) : true;

    if (!isNextMonthBillable) {
      return { forecastNextMonth: 0, forecastPropertiesCount: 0, forecastClientsList: [] };
    }

    let forecastTotal = 0;
    let propCount = 0;
    const clientsList: { name: string, sum: number }[] = [];

    augmentedClients.filter(c => c.status === 'Activ').forEach(client => {
      const clientProps = properties.filter(p => p.clientId === client.id);
      let clientSum = 0;
      
      if (clientProps.length > 0) {
        const maintenanceProps = clientProps.filter(p => {
          const pType = (p.contractType || '').toLowerCase();
          return pType === 'maintenance' || pType.includes('mentenanț') || pType.includes('mentenant');
        });

        maintenanceProps.forEach(p => {
          clientSum += (p.tarifLunar || 0);
          propCount++;
        });
      } else {
        const cType = (client.contractType || '').toLowerCase();
        const isMaintenance = !cType || cType === 'maintenance' || cType.includes('mentenanț') || cType.includes('mentenant');
        if (isMaintenance && client.tarifLunar > 0) {
          clientSum += client.tarifLunar;
          propCount++;
        }
      }

      if (clientSum > 0) {
        forecastTotal += clientSum;
        clientsList.push({ name: client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume, sum: clientSum });
      }
    });

    clientsList.sort((a, b) => b.sum - a.sum);

    return { forecastNextMonth: forecastTotal, forecastPropertiesCount: propCount, forecastClientsList: clientsList };
  }, [augmentedClients, properties, orgData]);
  const { 
    totalCollected, 
    totalCollectedPrevPeriod,
    totalCollectedCashPrevPeriod,
    totalCollectedContPrevPeriod,
    totalCollectedMaintenance, 
    totalCollectedProjects,
    totalCollectedCash,
    totalCollectedCont,
    totalCollectedMaintenanceCash,
    totalCollectedMaintenanceCont,
    totalCollectedProjectsCash,
    totalCollectedProjectsCont
  } = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    const periodDays = differenceInDays(end, start) + 1;
    
    let prevStart, prevEnd;
    if (periodDays > 300) {
      prevStart = new Date(start.getFullYear() - 1, 0, 1);
      prevEnd = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else {
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
    }
    
    return paymentHistory.reduce((acc, p) => {
      if (!p.date || !p.date.toDate) return acc;
      const pDate = p.date.toDate();
      const amount = p.amount || 0;

      if (pDate >= prevStart && pDate <= prevEnd) {
        const client = augmentedClients.find(c => c.id === p.clientId);
        const isCash = client && client.preferredPayment === 'cash';
        acc.totalCollectedPrevPeriod += amount;
        if (isCash) {
          acc.totalCollectedCashPrevPeriod += amount;
        } else {
          acc.totalCollectedContPrevPeriod += amount;
        }
      }

      if (pDate >= start && pDate <= end) {
        const client = augmentedClients.find(c => c.id === p.clientId);
        const isCash = client && client.preferredPayment === 'cash';
        const isMaintenance = client && client.contractType === 'maintenance';

        acc.totalCollected += amount;
        if (isCash) {
          acc.totalCollectedCash += amount;
        } else {
          acc.totalCollectedCont += amount;
        }

        if (isMaintenance) {
          acc.totalCollectedMaintenance += amount;
          if (isCash) {
            acc.totalCollectedMaintenanceCash += amount;
          } else {
            acc.totalCollectedMaintenanceCont += amount;
          }
        } else {
          acc.totalCollectedProjects += amount;
          if (isCash) {
            acc.totalCollectedProjectsCash += amount;
          } else {
            acc.totalCollectedProjectsCont += amount;
          }
        }
      }
      return acc;
    }, { 
      totalCollected: 0, 
      totalCollectedPrevPeriod: 0,
      totalCollectedCashPrevPeriod: 0,
      totalCollectedContPrevPeriod: 0,
      totalCollectedMaintenance: 0, 
      totalCollectedProjects: 0,
      totalCollectedCash: 0,
      totalCollectedCont: 0,
      totalCollectedMaintenanceCash: 0,
      totalCollectedMaintenanceCont: 0,
      totalCollectedProjectsCash: 0,
      totalCollectedProjectsCont: 0
    });
  }, [paymentHistory, startDate, endDate, augmentedClients]);

  const monthlyCollectionsChartData = useMemo(() => {
    const data = [];
    const d = new Date();
    
    const getMonthTotal = (monthsAgo: number) => {
      // Same logic as card: start of month to end of month, all payments
      const monthStart = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
      let total = 0;
      paymentHistory.forEach(p => {
         const pDate = p.date?.toDate ? p.date.toDate() : null;
         if (pDate && pDate >= monthStart && pDate <= monthEnd) {
           total += p.amount || 0;
         }
      });
      return total;
    };
    
    // Past 10 months + current month
    for (let i = 10; i >= 0; i--) {
      const monthD = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const total = getMonthTotal(i);
      const prevTotal = getMonthTotal(i + 1);
      
      const monthName = monthD.toLocaleString(i18n.language === 'ro' ? 'ro-RO' : 'en-US', { month: 'short' });
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
      
      data.push({
        name: capitalized,
        value: total,
        prevValue: prevTotal,
        isForecast: false,
        monthIndex: monthD.getMonth()
      });
    }
    
    // Add Next Month Forecast
    const nextMonthD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const nextMonthName = nextMonthD.toLocaleString(i18n.language === 'ro' ? 'ro-RO' : 'en-US', { month: 'short' });
    const capitalizedNext = nextMonthName.charAt(0).toUpperCase() + nextMonthName.slice(1).replace('.', '');
    
    data.push({
      name: `${capitalizedNext} (Est)`,
      value: forecastNextMonth,
      prevValue: getMonthTotal(0),
      isForecast: true,
      monthIndex: nextMonthD.getMonth()
    });
    
    return data;
  }, [paymentHistory, forecastNextMonth, i18n.language]);

  // Chart Data Preparation
  const maintenanceChartData = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    
    const days = eachDayOfInterval({ start, end });
    
    const isWorkingDay = (date: Date) => {
      const day = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (workDays === 'L-V') return day >= 1 && day <= 5;
      if (workDays === 'L-S') return day >= 1 && day <= 6;
      if (workDays === 'L-D') return true; // All days
      return true;
    };

    return days.filter(isWorkingDay).map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      
      const dayVisits = visits.filter(v => {
        const vDate = v.completedAt ? (v.completedAt?.toDate ? format(v.completedAt.toDate(), 'yyyy-MM-dd') : format(new Date(v.completedAt as any), 'yyyy-MM-dd')) : v.data;
        return vDate === dayStr && v.status === 'Finalizat';
      });
      
      const maintenanceVisits = dayVisits.filter(v => {
        const prop = properties.find(p => p.id === v.propertyId);
        const client = augmentedClients.find(c => c.id === v.clientId);
        const contractType = prop?.contractType || client?.contractType;
        
        if (contractType) {
           return contractType === 'maintenance';
        }
        
        // Fallback for older data
        const type = (v.tipLucrare || '').toLowerCase();
        return !type || type.includes('mentenanț') || type.includes('mentenant') || type.includes('maintenance') || type.includes('tuns');
      });
      
      // Sort visits by start time
      dayVisits.sort((a, b) => {
          const aStart = (a.workSessions?.[0]?.start?.toDate ? a.workSessions[0].start.toDate() : (a.workSessions?.[0]?.start ? new Date(a.workSessions[0].start as any) : null)) || (a.completedAt?.toDate ? a.completedAt.toDate() : (a.completedAt ? new Date(a.completedAt as any) : new Date(0)));
          const bStart = (b.workSessions?.[0]?.start?.toDate ? b.workSessions[0].start.toDate() : (b.workSessions?.[0]?.start ? new Date(b.workSessions[0].start as any) : null)) || (b.completedAt?.toDate ? b.completedAt.toDate() : (b.completedAt ? new Date(b.completedAt as any) : new Date(0)));
          return aStart.getTime() - bStart.getTime();
      });

      const visitDetails = dayVisits.map(v => {
          const client = augmentedClients.find(c => c.id === v.clientId);
          const property = properties.find(p => p.id === v.propertyId);
          const clientName = client 
            ? (client.tip_persoana === 'PJ' 
                ? `${client.numeFirma || t('Unknown Company')}${client.nume ? ` (${client.nume})` : ''}` 
                : client.nume)
            : (v.clientName || t('Unknown Client'));

          // Calculate duration from workSessions or fallback to estimatedDuration
          let durationMinutes = 0;
          if (v.workSessions && v.workSessions.length > 0) {
              durationMinutes = v.workSessions.reduce((acc, session) => {
                  if (session.start && session.end) {
                      const start = session.start.toDate ? session.start.toDate() : new Date(session.start);
                      const end = session.end.toDate ? session.end.toDate() : new Date(session.end);
                      return acc + (end.getTime() - start.getTime()) / (1000 * 60);
                  }
                  return acc;
              }, 0);
          } else if (v.estimatedDuration) {
              durationMinutes = v.estimatedDuration;
          }
          
          durationMinutes = Math.round(durationMinutes);
          return {
              clientName,
              propertyAddress: v.propertyAddress || (property ? property.address : ''),
              durationMinutes
          };
      });
      
      return {
        name: format(day, 'dd/MM'),
        fullDate: format(day, 'EEEE dd MMMM', { locale: i18n.language === 'ro' ? ro : undefined }),
        Vizite: maintenanceVisits.length,
        TotalVizite: dayVisits.length,
        visitDetails
      };
    });
  }, [visits, workDays, startDate, endDate, augmentedClients, properties]);

  const weeklyVisitsData = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    
    // Get all weeks in the interval
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }); // Start on Monday
    
    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const actualEnd = weekEnd > end ? end : weekEnd;
      const actualStart = weekStart < start ? start : weekStart;
      
      const visitsInWeek = filteredVisits.filter(v => {
        const vDate = v.completedAt?.toDate ? v.completedAt.toDate() : (v.completedAt ? new Date(v.completedAt as any) : null);
        return vDate && vDate >= actualStart && vDate <= actualEnd;
      });
      
      return {
        name: `S${index + 1}`,
        range: `${format(actualStart, 'dd.MM')} - ${format(actualEnd, 'dd.MM')}`,
        Vizite: visitsInWeek.length
      };
    });
  }, [filteredVisits, startDate, endDate]);

  // Chart Data Preparation - Financial Evolution (Daily)
  const financialChartData = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    const days = eachDayOfInterval({ start, end });

    // Pre-aggregate data for faster lookup and correctness
    const aggregated: Record<string, {
      incasariMentenanta: number;
      incasariProiecte: number;
      clientPayments: Record<string, { client: Client; amount: number }>;
    }> = {};

    paymentHistory.forEach(p => {
      if (!p.date || !p.date.toDate) return;
      const pDate = p.date.toDate();
      const client = augmentedClients.find(c => c.id === p.clientId);
      if (!client) return;

      const pDateStr = format(pDate, 'yyyy-MM-dd');
      if (!aggregated[pDateStr]) {
        aggregated[pDateStr] = { incasariMentenanta: 0, incasariProiecte: 0, clientPayments: {} };
      }
      const isMaintenance = client.contractType === 'maintenance';
      const amount = p.amount || 0;

      if (isMaintenance) {
        aggregated[pDateStr].incasariMentenanta += amount;
      } else {
        aggregated[pDateStr].incasariProiecte += amount;
      }

      if (!aggregated[pDateStr].clientPayments[client.id]) {
        aggregated[pDateStr].clientPayments[client.id] = { client, amount: 0 };
      }
      aggregated[pDateStr].clientPayments[client.id].amount += amount;
    });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const data = aggregated[dayStr] || { incasariMentenanta: 0, incasariProiecte: 0, clientPayments: {} };

      const clientList = Object.values(data.clientPayments).map(cp => ({
        ...cp.client,
        paymentAmount: cp.amount
      }));

      return {
        name: format(day, 'dd/MM'),
        fullDate: format(day, 'EEEE dd MMMM', { locale: i18n.language === 'ro' ? ro : undefined }),
        IncasariMentenanta: Number(data.incasariMentenanta.toFixed(2)),
        IncasariProiecte: Number(data.incasariProiecte.toFixed(2)),
        clientList
      };
    });
  }, [paymentHistory, startDate, endDate, augmentedClients]);

  const maintenanceClientsWithoutProperties = useMemo(() => {
    const maintenanceClients = augmentedClients.filter(c => c.status === 'Activ' && c.contractType === 'maintenance');
    return maintenanceClients.filter(c => !properties.some(p => p.clientId === c.id));
  }, [augmentedClients, properties]);

  const incompleteDataSection = (
    maintenanceClientsWithoutProperties.length > 0 && (
      <div className="stihl-card p-6 rounded-2xl border-2 border-red-500/20 bg-red-500/5 mt-6">
        <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
          <AlertTriangle size={16} /> {t('Warning: Incomplete Data')}
        </h3>
        <p className="text-xs text-red-500/80 mb-4">{t('The following maintenance clients have no defined locations:')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {maintenanceClientsWithoutProperties.map(c => (
            <div key={c.id} className="bg-bg-card p-2 rounded border border-red-500/10 text-xs font-bold text-main">
              {c.tip_persoana === 'PJ' ? `${c.numeFirma} (${c.nume})` : c.nume}
            </div>
          ))}
        </div>
      </div>
    )
  );

  const periodCollectionPercentage = useMemo(() => {
    return totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;
  }, [totalCollected, totalRevenue]);

  const getDebtAgeDays = (client: any): number => {
    if (!client.sold || client.sold <= 0) return 0;
    
    const today = startOfDay(new Date());
    let dueDate: Date;
    
    let monthsOffset = 0;
    if (client.tarifLunar && client.tarifLunar > 0) {
        monthsOffset = Math.floor((client.sold - 0.01) / client.tarifLunar);
    }
    if (monthsOffset < 0) monthsOffset = 0;
    
    if (client.dataScadenta) {
      const parsedDate = startOfDay(parseISO(client.dataScadenta));
      dueDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth() - monthsOffset, parsedDate.getDate());
    } else {
      const d = new Date();
      dueDate = startOfDay(new Date(d.getFullYear(), d.getMonth() - monthsOffset, client.ziScadenta || 15));
    }
    
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const { 
    totalOutstanding, 
    totalOutstandingCash,
    totalOutstandingCont,
    totalOutstandingMaintenance, 
    totalOutstandingMaintenanceCash,
    totalOutstandingMaintenanceCont,
    totalOutstandingProjects,
    totalOutstandingProjectsCash,
    totalOutstandingProjectsCont,
    agingReport
  } = useMemo(() => {
    return augmentedClients.reduce((acc, c) => {
      const isMaintenance = c.contractType === 'maintenance';
      const isProject = c.contractType === 'one-time';
      const isCash = c.preferredPayment === 'cash';
      
      const amount = (c.sold || 0);
      acc.totalOutstanding += amount;
      if (isCash) {
        acc.totalOutstandingCash += amount;
      } else {
        acc.totalOutstandingCont += amount;
      }
      
      if (isMaintenance) {
          acc.totalOutstandingMaintenance += amount;
          if (isCash) {
            acc.totalOutstandingMaintenanceCash += amount;
          } else {
            acc.totalOutstandingMaintenanceCont += amount;
          }
      } else {
          // Fallback & project
          acc.totalOutstandingProjects += amount;
          if (isCash) {
            acc.totalOutstandingProjectsCash += amount;
          } else {
            acc.totalOutstandingProjectsCont += amount;
          }
      }

      // Aging calculation
      if (amount > 0) {
          const age = getDebtAgeDays(c);
          if (age <= 15) acc.agingReport.current += amount;
          else if (age <= 30) acc.agingReport.days15to30 += amount;
          else if (age <= 60) acc.agingReport.days30to60 += amount;
          else acc.agingReport.daysOver60 += amount;
      }

      return acc;
    }, { 
      totalOutstanding: 0, 
      totalOutstandingCash: 0,
      totalOutstandingCont: 0,
      totalOutstandingMaintenance: 0, 
      totalOutstandingMaintenanceCash: 0,
      totalOutstandingMaintenanceCont: 0,
      totalOutstandingProjects: 0,
      totalOutstandingProjectsCash: 0,
      totalOutstandingProjectsCont: 0,
      agingReport: { current: 0, days15to30: 0, days30to60: 0, daysOver60: 0 }
    });
  }, [augmentedClients]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredPaymentsForModal = useMemo(() => {
    if (!paymentsListModal) return [];
    const filter = paymentsListModal.filterType;
    const method = paymentsListModal.paymentMethod || 'all';
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    return paymentHistory
      .flatMap(p => {
        const attributed = getAttributedAmount(p, start, end);
        if (attributed <= 0) return [];

        const client = augmentedClients.find(c => c.id === p.clientId);
        if (!client) return [];

        if (method !== 'all') {
          const preferredPayment = client.preferredPayment || 'cont';
          if (method === 'cash' && preferredPayment !== 'cash') return [];
          if (method === 'cont' && preferredPayment === 'cash') return [];
        }

        const isMaintenance = client.contractType === 'maintenance';
        const isProject = client.contractType === 'one-time';

        if (filter !== 'all') {
          if (filter === 'maintenance' && !isMaintenance) return [];
          if (filter === 'projects' && !isProject && (isMaintenance || isProject)) return [];
        }

        const displayDetails = p.details || '';

        return [{
          ...p,
          amount: attributed,
          details: displayDetails,
          clientName: client.tip_persoana === 'PJ' 
            ? `${client.numeFirma || 'Firma Necunoscută'}${client.nume ? ` (${client.nume})` : ''}` 
            : client.nume,
          preferredPayment: client.preferredPayment || 'cont'
        }];
      })
      .sort((a, b) => {
        const dateA = a.date?.toDate?.()?.getTime() || 0;
        const dateB = b.date?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });
  }, [paymentsListModal, paymentHistory, startDate, endDate, augmentedClients, t]);

  const filteredDebtorsForModal = useMemo(() => {
    if (!debtsListModal) return [];
    const filter = debtsListModal.filterType;
    const method = debtsListModal.paymentMethod || 'all';

    return augmentedClients
      .filter(c => {
        if (!c.sold || c.sold === 0) return false;

        const isMaintenance = c.contractType === 'maintenance';
        const isProject = c.contractType === 'one-time';

        if (filter !== 'all') {
          if (filter === 'maintenance' && !isMaintenance) return false;
          if (filter === 'projects') {
            const isProj = isProject || (!isMaintenance && !isProject);
            if (!isProj) return false;
          }
        }

        if (method !== 'all') {
          const isCash = c.preferredPayment === 'cash';
          if (method === 'cash' && !isCash) return false;
          if (method === 'cont' && isCash) return false;
        }

        return true;
      })
      .map(c => {
        const ageDays = getDebtAgeDays(c);
        return {
          ...c,
          ageDays,
          clientName: c.tip_persoana === 'PJ' 
            ? `${c.numeFirma || 'Firma Necunoscută'}${c.nume ? ` (${c.nume})` : ''}` 
            : c.nume
        };
      })
      .sort((a, b) => {
        if (b.ageDays !== a.ageDays) {
          return b.ageDays - a.ageDays;
        }
        return (b.sold || 0) - (a.sold || 0);
      });
  }, [debtsListModal, augmentedClients]);

  const modalPaymentsTotal = useMemo(() => {
    return filteredPaymentsForModal.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filteredPaymentsForModal]);

  const modalDebtsTotal = useMemo(() => {
    return filteredDebtorsForModal.reduce((sum, c) => sum + (c.sold || 0), 0);
  }, [filteredDebtorsForModal]);

  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!hasScrolled) {
      const timer = setTimeout(() => {
        const el = document.getElementById('anchor-rapoarte');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setHasScrolled(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasScrolled, activeTab]);

  if (loading) {
    return <PageSkeleton />;
  }
  
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20 w-full min-w-0">
      {confirmationModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmationModal(null)}></div>
          <div className="bg-bg-card border border-border-color rounded-xl p-6 shadow-2xl relative z-10 w-full max-w-md animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-main mb-2">{confirmationModal.title}</h3>
            <p className="text-sm text-text-secondary mb-6">{confirmationModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmationModal(null)}
                className="px-4 py-2 rounded-lg font-bold text-text-secondary hover:bg-bg-main transition-colors"
              >
                {t('Cancel')}
              </button>
              <button 
                onClick={() => {
                  confirmationModal.onConfirm();
                  setConfirmationModal(null);
                }}
                className="px-4 py-2 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md"
              >
                {t('Confirm Deletion')}
              </button>
            </div>
          </div>
        </div>
      )}


      <div id="reports-content-anchor" className="hidden" />

      <PaymentModal
        isOpen={paymentModal.isOpen}
        client={paymentModal.client}
        initialAmount={paymentModal.amount}
        properties={properties}
        organizationId={organizationId}
        onClose={() => setPaymentModal({ isOpen: false, client: null, amount: '' })}
        source={t('Quick collect from Reports')}
      />

      {paymentsListModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setPaymentsListModal(null)}
        >
          <div 
            className="stihl-card w-full max-w-2xl bg-bg-card rounded-2xl p-5 md:p-6 relative shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black text-main uppercase tracking-tight">
                  {t('Collections List')}
                </h3>
                <p className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mt-1">
                  {paymentsListModal.filterType === 'all' 
                    ? t('All') 
                    : paymentsListModal.filterType === 'maintenance' 
                      ? t('Maintenance') 
                      : t('One-time Projects')}
                  {paymentsListModal.paymentMethod === 'cash' && ` - Cash`}
                  {paymentsListModal.paymentMethod === 'cont' && ` - Card/Cont`}
                </p>
              </div>
              <button 
                onClick={() => setPaymentsListModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all group"
              >
                <X size={16} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[400px] no-scrollbar pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-color/60">
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">{t('Date')}</th>
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">{t('Client')}</th>
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 text-right">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentsForModal.length > 0 ? (
                    filteredPaymentsForModal.map((p) => (
                      <tr key={`${p.id}-${p.amount}-${p.details}`} className="border-b border-border-color/30 hover:bg-bg-main/30 transition-colors">
                        <td className="py-1 px-3 text-xs font-bold text-text-secondary">
                          {p.date?.toDate ? format(p.date.toDate(), 'dd.MM.yyyy') : ''}
                        </td>
                        <td className="py-1 px-3 text-xs font-bold text-main">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {p.preferredPayment === 'cash' ? (
                                <DollarSign size={12} className="text-green-600 dark:text-green-400 shrink-0" />
                              ) : (
                                <CreditCard size={12} className="text-blue-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[250px]">{p.clientName}</span>
                            </div>
                            {p.details && (
                              <span className="text-[10px] text-text-secondary/70 italic ml-[18px] mt-0.5">{p.details}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1 px-3 text-xs font-black text-main text-right">
                          {p.amount?.toLocaleString()} RON
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs font-bold text-text-secondary opacity-60">
                        {t('No payments in this period')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-color/60 bg-bg-main/20 font-black">
                    <td colSpan={2} className="py-1.5 px-3 text-[10px] uppercase tracking-widest text-text-secondary">{t('Total')}</td>
                    <td className="py-1.5 px-3 text-xs text-right text-main font-black">
                      {modalPaymentsTotal.toLocaleString()} RON
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={downloadPaymentsModalPDF}
                  className="px-3 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <FileDown size={14} /> PDF
                </button>
                <button
                  onClick={downloadPaymentsModalExcel}
                  className="px-3 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
              </div>
              <button
                onClick={() => setPaymentsListModal(null)}
                className="px-5 py-2.5 bg-bg-main text-main hover:bg-accent-color hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-sm"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportModalType && (
        <ExportFormatModal
          paymentMethod={exportModalType}
          onClose={() => setExportModalType(null)}
          onSelectFormat={(format) => {
            setExportModalType(null);
            if (exportModalType === 'financial') {
              executeFinancialReportExport(format);
            } else {
              executeInvoicesExport(exportModalType, format);
            }
          }}
        />
      )}

      {debtsListModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setDebtsListModal(null)}
        >
          <div 
            className="stihl-card w-full max-w-2xl bg-bg-card rounded-2xl p-5 md:p-6 relative shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black text-main uppercase tracking-tight">
                  {t('Outstanding Debts')}
                </h3>
                <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">
                  {debtsListModal.filterType === 'all' 
                    ? t('All') 
                    : debtsListModal.filterType === 'maintenance' 
                      ? t('Maintenance') 
                      : t('One-Time Works')}
                  {debtsListModal.paymentMethod && debtsListModal.paymentMethod !== 'all' && (
                    ` - ${debtsListModal.paymentMethod === 'cash' ? 'CASH' : 'CONT'}`
                  )}
                </p>
              </div>
              <button 
                onClick={() => setDebtsListModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all group"
              >
                <X size={16} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[400px] no-scrollbar pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-color/60">
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">{t('Client')}</th>
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 text-center">{t('Overdue Status')}</th>
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 text-right">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebtorsForModal.length > 0 ? (
                    filteredDebtorsForModal.map((c) => {
                      const isOverdue = c.ageDays > 0;
                      return (
                        <tr key={c.id} className="border-b border-border-color/30 hover:bg-bg-main/30 transition-colors">
                          <td className="py-1 px-3 text-xs font-bold text-main">
                            <div className="flex items-center gap-1.5">
                              {c.preferredPayment === 'cash' ? (
                                <DollarSign size={12} className="text-green-600 dark:text-green-400 shrink-0" />
                              ) : (
                                <CreditCard size={12} className="text-blue-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[220px]">{c.clientName}</span>
                            </div>
                          </td>
                          <td className="py-1 px-3 text-xs font-bold text-center">
                            {isOverdue ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                {c.ageDays} {t('days overdue')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                                {t('Within Term')}
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-3 text-xs font-black text-main text-right">
                            {c.sold?.toLocaleString()} RON
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs font-bold text-text-secondary opacity-60">
                        {t('No outstanding debts')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-color/60 bg-bg-main/20 font-black">
                    <td colSpan={2} className="py-1.5 px-3 text-[10px] uppercase tracking-widest text-text-secondary">{t('Total')}</td>
                    <td className="py-1.5 px-3 text-xs text-right text-main font-black">
                      {modalDebtsTotal.toLocaleString()} RON
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-border-color/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadDebtsPDF}
                  className="px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <FileDown size={14} /> PDF
                </button>
                <button
                  onClick={downloadDebtsExcel}
                  className="px-3 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
              </div>
              <button
                onClick={() => setDebtsListModal(null)}
                className="px-5 py-2.5 bg-bg-main text-main hover:bg-accent-color hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-sm"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {forecastListModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setForecastListModal(false)}
        >
          <div 
            className="stihl-card w-full max-w-2xl bg-bg-card rounded-2xl p-5 md:p-6 relative shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black text-main uppercase tracking-tight">
                  {i18n.language === 'ro' ? 'Listă Proiecție' : 'Forecast List'}
                </h3>
                <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1">
                  {i18n.language === 'ro' ? `Proiecție ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('ro-RO', { month: 'long' })}` : `${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('en-US', { month: 'short' })} Forecast`}
                </p>
              </div>
              <button 
                onClick={() => setForecastListModal(false)}
                className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-2xl hover:bg-red-500 hover:text-white transition-all group"
              >
                <X size={16} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[400px] no-scrollbar pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-color/60">
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">{t('Client')}</th>
                    <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 text-right">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastClientsList.length > 0 ? (
                    forecastClientsList.map((client, idx) => (
                      <tr key={idx} className="border-b border-border-color/30 hover:bg-bg-main/30 transition-colors">
                        <td className="py-2 px-3 text-sm font-bold text-main">{client.name}</td>
                        <td className="py-2 px-3 text-sm font-black text-emerald-600 dark:text-emerald-500 text-right">{client.sum?.toLocaleString()} RON</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-text-secondary">
                        <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold">{t('No data for selected period')}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-border-color/30 flex items-center justify-end">
              <button
                onClick={() => setForecastListModal(false)}
                className="px-5 py-2.5 bg-bg-main text-main hover:bg-accent-color hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-sm"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-[72px] md:bottom-0 left-0 md:left-64 right-0 h-8 bg-bg-card/95 border-t border-border-color/50 flex items-center overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-40 backdrop-blur-md">
         <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-card to-transparent z-10 pointer-events-none"></div>
         <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-card to-transparent z-10 pointer-events-none"></div>
         <div className="flex items-center whitespace-nowrap animate-scroll-x-slow text-[10px] font-black uppercase tracking-widest text-text-secondary/80">
            {latestPaymentsTicker.length > 0 ? (
               [...latestPaymentsTicker, ...latestPaymentsTicker].map((p, idx) => (
                 <div key={idx} className="flex items-center mx-6 gap-2">
                   <span className="text-emerald-500">🟩 ÎNCASARE:</span>
                   <span className="text-main">{p.clientName}</span>
                   <span className="opacity-50">{p.dateStr}</span>
                   <span className="text-emerald-600">(+{p.amount} RON)</span>
                 </div>
               ))
            ) : (
               <span className="mx-6">Se așteaptă primele încasări...</span>
            )}
         </div>
      </div>

      <div className="flex flex-col gap-4 mb-4">
        {/* Intelligence Terminal Header */}
        <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-accent-color/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-accent-color/10 shadow-sm animate-in slide-in-from-top-4 duration-700">
          
          <div className="flex flex-row justify-between items-center gap-4 w-full">
            {/* Title */}
            <div className="flex items-center gap-3 md:gap-5">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-xl shadow-accent-color/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
                <BarChart2 className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-accent-color uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-color text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">
                    {t('Intelligence Terminal')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                  <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">{t('Reports')} <span className="text-accent-color">& {t('Analytics')}</span></h1>
                </div>
                <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
                  {t('Real-time business performance')}
                </p>
              </div>
            </div>

            {/* Actions & KPIs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              
              {/* Clickable KPIs */}
              <div className="hidden sm:flex items-center gap-1 bg-bg-main/50 border border-border-color/30 p-1 rounded-xl shrink-0">
                  <div 
                    className="px-3 py-1.5 border-r border-border-color/30 cursor-pointer hover:bg-bg-card transition-colors rounded-l-lg group"
                    onClick={() => setPaymentsListModal({ filterType: 'all', paymentMethod: 'all' })}
                  >
                      <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest leading-none mb-1 group-hover:text-main transition-colors">{t('Collections')}</p>
                      <p className="text-sm font-black text-main leading-none">{totalCollected.toLocaleString()} RON</p>
                  </div>
                  <div 
                    className="px-3 py-1.5 border-r border-border-color/30 cursor-pointer hover:bg-red-500/10 transition-colors group"
                    onClick={() => setDebtsListModal({ filterType: 'all', paymentMethod: 'all' })}
                  >
                      <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest leading-none mb-1 group-hover:text-red-500 transition-colors">{t('Outstanding')}</p>
                      <p className="text-sm font-black text-red-500 leading-none">{totalOutstanding.toLocaleString()} RON</p>
                  </div>
                  <div 
                    className="px-3 py-1.5 cursor-pointer hover:bg-emerald-500/10 transition-colors rounded-r-lg group"
                    onClick={() => setForecastListModal(true)}
                  >
                      <p className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest leading-none mb-1 group-hover:text-emerald-500 transition-colors">
                          {i18n.language === 'ro' ? `Proiecție ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('ro-RO', { month: 'short' })}` : `${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('en-US', { month: 'short' })} Forecast`}
                      </p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-500 leading-none">
                          {forecastNextMonth.toLocaleString()} RON
                      </p>
                  </div>
              </div>

              {/* Export buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setExportModalType('financial')}
                  title={t('Complete Financial Report')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white transition-all active:scale-95 border border-blue-500/20 shadow-sm"
                >
                  <FileDown size={15} /> <span className="hidden sm:inline">{t('Financial Report')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-bg-card rounded-2xl border border-border-color/50 shadow-sm p-1.5">
          {/* Tabs */}
          <div className="relative flex bg-bg-main rounded-xl overflow-hidden p-0.5">
            <button
              onClick={() => setActiveTab('operational')}
              className={`relative flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-[10px] text-sm font-bold transition-all duration-200 ${
                activeTab === 'operational'
                  ? 'bg-bg-card text-main shadow-sm ring-1 ring-border-color/60'
                  : 'text-text-secondary hover:text-main'
              }`}
            >
              <CalendarCheck size={14} className={activeTab === 'operational' ? 'text-accent-color' : ''} />
              Operațional
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`relative flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-[10px] text-sm font-bold transition-all duration-200 ${
                activeTab === 'financial'
                  ? 'bg-bg-card text-main shadow-sm ring-1 ring-border-color/60'
                  : 'text-text-secondary hover:text-main'
              }`}
            >
              <TrendingUp size={14} className={activeTab === 'financial' ? 'text-emerald-500' : ''} />
              Financiar
            </button>
          </div>

          {/* Date Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Preset Buttons */}
            <div className="flex bg-bg-main rounded-xl p-0.5 border border-border-color/30">
              <button
                onClick={() => setDatePreset('thisMonth')}
                className={`px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all ${
                  startDate === format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd') && endDate === format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd')
                    ? 'bg-bg-card text-main shadow-sm ring-1 ring-border-color/60'
                    : 'text-text-secondary hover:text-main'
                }`}
              >
                Luna Curentă
              </button>
              <div className="relative group">
                <select
                  onChange={(e) => {
                     if (e.target.value === "") return;
                     const monthsAgo = parseInt(e.target.value, 10);
                     const d = new Date();
                     setStartDate(format(new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1), 'yyyy-MM-dd'));
                     setEndDate(format(new Date(d.getFullYear(), d.getMonth() - monthsAgo + 1, 0), 'yyyy-MM-dd'));
                  }}
                  className="appearance-none cursor-pointer px-3 py-1.5 rounded-[9px] text-xs font-bold text-text-secondary hover:text-main hover:bg-bg-card transition-colors bg-transparent outline-none pr-7"
                  value={selectedPastMonthValue}
                >
                   <option value="" disabled hidden>{i18n.language === 'ro' ? 'Luni Trecute' : 'Past Months'}</option>
                   {pastMonthsOptions.map(opt => (
                     <option key={opt.value} value={opt.value} className="text-main bg-bg-card text-xs">{opt.label}</option>
                   ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary" />
              </div>
              <button
                onClick={() => setDatePreset('thisYear')}
                className={`px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all ${
                  startDate === format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd') && endDate === format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd')
                    ? 'bg-bg-card text-main shadow-sm ring-1 ring-border-color/60'
                    : 'text-text-secondary hover:text-main'
                }`}
              >
                Anul Curent
              </button>
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2 bg-bg-main rounded-xl border border-border-color/30 px-3 py-1.5 focus-within:ring-2 ring-accent-color/20 transition-all">
              <CalendarDays size={14} className="text-accent-color shrink-0" />
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="bg-transparent border-none text-xs font-bold text-main outline-none w-auto min-w-[95px] [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100" 
              />
              <span className="text-text-secondary/30 font-black text-xs">—</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="bg-transparent border-none text-xs font-bold text-main outline-none w-auto min-w-[95px] [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:hover:opacity-100" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {activeTab === 'operational' && (
          <>
            {/* Row 1: Maintenance Visits Chart + Metrics */}
            <div id="anchor-rapoarte" className="lg:col-span-2 stihl-card rounded-2xl p-5 flex flex-col scroll-mt-6">

            <h2 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <CalendarCheck size={18} className="text-accent-color" />
                {t('Maintenance Visits Evolution')}
            </h2>
            <div className="h-[220px] w-full">
                {maintenanceChartData.some(d => d.TotalVizite > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart key={`maintenance-${startDate}-${endDate}-${visits.length}`} data={maintenanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="var(--border-color)" opacity={0.5} />
                        {maintenanceChartData.filter(d => d.fullDate.includes('duminică')).map(d => (
                            <ReferenceLine key={d.name} x={d.name} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
                        ))}
                        <Tooltip 
                            wrapperStyle={{ pointerEvents: 'auto' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-bg-card/90 backdrop-blur-md border border-border-color p-3 rounded-xl shadow-lg max-h-[350px] overflow-y-auto min-w-[320px] pointer-events-auto custom-scrollbar">
                                            <p className="text-text-secondary text-[11px] uppercase font-bold mb-2 sticky top-0 bg-bg-card/90 backdrop-blur-md pb-1 border-b border-border-color/30 z-10">{data.fullDate}</p>
                                            <p className="text-main font-black text-sm mb-2">{t('Total Visits')}: {data.TotalVizite} <span className="text-text-secondary font-normal text-xs ml-1">({t('Maintenance')}: {data.Vizite})</span></p>
                                            <div className="space-y-1">
                                                {data.visitDetails.map((v: any, i: number) => {
                                                    const hours = Math.floor(v.durationMinutes / 60);
                                                    const mins = Math.round(v.durationMinutes % 60);
                                                    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                                                    return (
                                                        <div key={i} className="text-[11px] text-main border-b border-border-color/30 pb-1 last:border-0 last:pb-0">
                                                            <div className="flex justify-between items-baseline gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-bold">{v.clientName}</span>
                                                                    {v.propertyAddress && (
                                                                        <span className="text-[11px] text-text-secondary italic ml-2 truncate"> - {v.propertyAddress}</span>
                                                                    )}
                                                                </div>
                                                                <span className="font-bold text-accent-color whitespace-nowrap text-[11px]">{durationText}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="Vizite" name="Vizite Mentenanță" fill={orgData?.contractTypeColors?.maintenance || '#f07d00'} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-60">
                        <CalendarCheck size={32} className="mb-2 opacity-50" />
                        <span className="text-sm font-bold">{t('No data for selected period')}</span>
                    </div>
                )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-border-color/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-text-secondary">
                    <TrendingUp size={14} className="text-accent-color" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('Weekly Visits')}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar pb-2">
                    {weeklyVisitsData.map((week, idx) => (
                        <div key={idx} className="flex-shrink-0 flex items-center gap-2 bg-bg-main px-3 py-1.5 rounded-lg border border-border-color min-w-[80px]">
                            <span className="text-[10px] text-text-secondary font-bold uppercase">{week.name}</span>
                            <span className="text-xs font-black text-main ml-auto">{week.Vizite}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="flex flex-col gap-3">
            <div className="stihl-card p-4 rounded-2xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500"><CalendarCheck size={16} /></div>
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Field Activity')}</span>
                </div>
                <div className="text-xl font-black text-main">{totalVisits} <span className="text-xs font-medium text-text-secondary">{i18n.language === 'ro' ? 'Vizite' : 'Visits'}</span></div>
                <div className="mt-1 text-[11px] font-medium text-text-secondary flex flex-col gap-0.5">
                    <span className="flex justify-between"><span>{i18n.language === 'ro' ? 'Clienți Unici' : 'Unique Clients'}:</span> <span className="font-bold text-main">{visitedClientsCount}</span></span>
                    <span className="flex justify-between"><span>{i18n.language === 'ro' ? 'Locații Unice' : 'Unique Locations'}:</span> <span className="font-bold text-main">{visitedPropertiesCount}</span></span>
                </div>
            </div>
            <div className="stihl-card p-4 rounded-2xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500"><Users size={16} /></div>
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('One-time Projects Portfolio')}</span>
                </div>
                <div className="text-xl font-black text-main">{totalOneTimeClients} <span className="text-xs font-medium text-text-secondary">{i18n.language === 'ro' ? 'Clienți' : 'Clients'}</span></div>
                <div className="mt-1 text-[11px] font-medium text-orange-500 flex flex-col gap-0.5">
                    <span className="flex justify-between"><span>{i18n.language === 'ro' ? 'Total Locații' : 'Total Locations'}:</span> <span className="font-bold text-main">{totalOneTimeProperties}</span></span>
                </div>
            </div>
            <div className="stihl-card p-4 rounded-2xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500"><Users size={16} /></div>
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Active Maintenance Clients')}</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                    <div className="text-xl font-black text-main">{activeClientsCount} <span className="text-xs font-medium text-text-secondary">{i18n.language === 'ro' ? 'Clienți' : 'Clients'}</span></div>
                    <div className="text-[11px] font-bold text-text-secondary uppercase">({activePropertiesCount} {i18n.language === 'ro' ? 'Locații' : 'Properties'})</div>
                </div>
                <div className="mt-1 text-[11px] font-medium text-blue-500 flex flex-col gap-1">
                    <div className="flex justify-between items-center bg-blue-500/5 p-1 rounded">
                        <span className="flex items-center gap-1 opacity-70"><Maximize size={10} /> {i18n.language === 'ro' ? 'Suprafață Totală' : 'Total Surface'}:</span> 
                        <span className="font-bold text-main">{totalActiveSurface.toLocaleString()} {i18n.language === 'ro' ? 'mp' : 'sqm'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-green-500/5 p-1 rounded">
                        <span className="flex items-center gap-1 text-green-600 opacity-70"><Sprout size={10} /> {t('Fertilizer Needed')}:</span> 
                        <span className="font-bold text-main">{fertilizerNeededKg.toLocaleString()} kg</span>
                    </div>
                </div>
            </div>

        </div>
          </>
        )}

        {activeTab === 'financial' && (
          <>
        {/* Row 2: Financial Evolution Charts + Metrics */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Maintenance Evolution */}
            <div className="stihl-card rounded-2xl p-6">
                <h2 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-500" />
                    {t('Maintenance Income')}
                </h2>
                <div className="h-[160px] w-full">
                    {isMounted && (
                        financialChartData.some(d => d.IncasariMentenanta > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                            <BarChart key={`income-maintenance-${startDate}-${endDate}-${paymentHistory.length}`} data={financialChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="var(--border-color)" opacity={0.5} />
                                {financialChartData.filter(d => d.fullDate.includes('duminică')).map(d => (
                                    <ReferenceLine key={d.name} x={d.name} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
                                ))}
                                <Tooltip content={<MaintenanceTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.2 }} />
                                <Bar dataKey="IncasariMentenanta" name={t('Recurring Income')} fill={orgData?.contractTypeColors?.maintenance || '#3b82f6'} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-60">
                                <TrendingUp size={32} className="mb-2 opacity-50 text-blue-500/50" />
                                <span className="text-sm font-bold">{t('No data for selected period')}</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Projects Evolution */}
            <div className="stihl-card rounded-2xl p-6">
                <h2 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-500" />
                    {t('Project Income')}
                </h2>
                <div className="h-[160px] w-full">
                    {financialChartData.some(d => d.IncasariProiecte > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart key={`income-projects-${startDate}-${endDate}-${paymentHistory.length}`} data={financialChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="var(--border-color)" opacity={0.5} />
                            {financialChartData.filter(d => d.fullDate.includes('duminică')).map(d => (
                                <ReferenceLine key={d.name} x={d.name} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
                            ))}
                             <Tooltip content={<ProjectsTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.2 }} />
                            <Bar dataKey="IncasariProiecte" name={t('Project Income')} fill={orgData?.contractTypeColors?.oneTime || '#10b981'} radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-60">
                            <TrendingUp size={32} className="mb-2 opacity-50 text-emerald-500/50" />
                            <span className="text-sm font-bold">{t('No data for selected period')}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="stihl-card p-5 rounded-2xl relative overflow-hidden group flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><TrendingUp size={20} /></div>
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        {i18n.language === 'ro' ? 'Evoluție Încasări' : 'Collections Trend'}
                    </span>
                </div>
                
                <div className="h-[160px] w-full -ml-3 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyCollectionsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="var(--border-color)" opacity={0.5} />
                            <Tooltip content={<MonthlyCollectionsTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.2 }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {monthlyCollectionsChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.isForecast ? '#10b981' : '#3b82f6'} fillOpacity={entry.isForecast ? 0.6 : 1} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>

        <div className="flex flex-col gap-6">
            <div className="stihl-card p-5 rounded-2xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-accent-color/10 rounded-lg text-accent-color"><DollarSign size={20} /></div>
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t('Income in Period')} ({format(parseISO(startDate), 'dd.MM')} - {format(parseISO(endDate), 'dd.MM')})</span>
                </div>
                <div className="text-2xl font-black text-main flex flex-wrap items-center gap-x-3 gap-y-1 select-none">
                  <div className="flex items-center gap-3">
                      <span 
                        className="cursor-pointer hover:text-accent-color transition-colors"
                        onClick={() => setPaymentsListModal({ filterType: 'all', paymentMethod: 'all' })}
                      >
                        {totalCollected.toLocaleString()} <span className="text-sm font-medium text-text-secondary">RON</span>
                      </span>
                      {(() => {
                        const growth = totalCollectedPrevPeriod ? ((totalCollected - totalCollectedPrevPeriod) / totalCollectedPrevPeriod) * 100 : 0;
                        if (totalCollectedPrevPeriod === 0) return null;
                        return (
                            <div className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 ${growth >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                            </div>
                        );
                      })()}
                  </div>
                  <span className="text-xs font-bold text-text-secondary/70">
                    (
                    <span 
                      className="cursor-pointer hover:text-accent-color hover:underline transition-colors inline-flex items-center"
                      onClick={() => setPaymentsListModal({ filterType: 'all', paymentMethod: 'cash' })}
                    >
                      {totalCollectedCash.toLocaleString()} cash
                      {(() => {
                        const growthCash = totalCollectedCashPrevPeriod ? ((totalCollectedCash - totalCollectedCashPrevPeriod) / totalCollectedCashPrevPeriod) * 100 : 0;
                        if (totalCollectedCashPrevPeriod === 0) return null;
                        return (
                            <span className={`ml-1 text-[10px] font-bold ${growthCash >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {growthCash > 0 ? '+' : ''}{growthCash.toFixed(1)}%
                            </span>
                        );
                      })()}
                    </span>
                    {' / '}
                    <span 
                      className="cursor-pointer hover:text-accent-color hover:underline transition-colors inline-flex items-center"
                      onClick={() => setPaymentsListModal({ filterType: 'all', paymentMethod: 'cont' })}
                    >
                      {totalCollectedCont.toLocaleString()} cont
                      {(() => {
                        const growthCont = totalCollectedContPrevPeriod ? ((totalCollectedCont - totalCollectedContPrevPeriod) / totalCollectedContPrevPeriod) * 100 : 0;
                        if (totalCollectedContPrevPeriod === 0) return null;
                        return (
                            <span className={`ml-1 text-[10px] font-bold ${growthCont >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {growthCont > 0 ? '+' : ''}{growthCont.toFixed(1)}%
                            </span>
                        );
                      })()}
                    </span>
                    )
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/10 flex flex-col justify-between transition-colors">
                        <div>
                            <div className="text-[11px] font-bold text-blue-500 uppercase tracking-tighter select-none">{t('Maintenance')}</div>
                            <div 
                              className="text-xs font-black text-main cursor-pointer hover:text-blue-500 transition-colors"
                              onClick={() => setPaymentsListModal({ filterType: 'maintenance', paymentMethod: 'all' })}
                            >
                              {totalCollectedMaintenance.toLocaleString()} <span className="text-[8px] font-medium opacity-50">RON</span>
                            </div>
                        </div>
                        <div className="text-[9px] font-bold text-text-secondary/70 mt-1 select-none">
                          (
                          <span 
                            className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                            onClick={() => setPaymentsListModal({ filterType: 'maintenance', paymentMethod: 'cash' })}
                          >
                            {totalCollectedMaintenanceCash.toLocaleString()} cash
                          </span>
                          {' / '}
                          <span 
                            className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                            onClick={() => setPaymentsListModal({ filterType: 'maintenance', paymentMethod: 'cont' })}
                          >
                            {totalCollectedMaintenanceCont.toLocaleString()} cont
                          </span>
                          )
                        </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between transition-colors">
                        <div>
                            <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-tighter select-none">{t('One-time Projects')}</div>
                            <div 
                              className="text-xs font-black text-main cursor-pointer hover:text-emerald-500 transition-colors"
                              onClick={() => setPaymentsListModal({ filterType: 'projects', paymentMethod: 'all' })}
                            >
                              {totalCollectedProjects.toLocaleString()} <span className="text-[8px] font-medium opacity-50">RON</span>
                            </div>
                        </div>
                        <div className="text-[9px] font-bold text-text-secondary/70 mt-1 select-none">
                          (
                          <span 
                            className="cursor-pointer hover:text-emerald-500 hover:underline transition-colors"
                            onClick={() => setPaymentsListModal({ filterType: 'projects', paymentMethod: 'cash' })}
                          >
                            {totalCollectedProjectsCash.toLocaleString()} cash
                          </span>
                          {' / '}
                          <span 
                            className="cursor-pointer hover:text-emerald-500 hover:underline transition-colors"
                            onClick={() => setPaymentsListModal({ filterType: 'projects', paymentMethod: 'cont' })}
                          >
                            {totalCollectedProjectsCont.toLocaleString()} cont
                          </span>
                          )
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-[11px] font-medium text-green-500 flex items-center gap-1">
                    <ArrowUpRight size={12} />
                    <span>{t('Total collected in selected period')}</span>
                </div>
            </div>
            <div className="stihl-card p-5 rounded-2xl relative overflow-hidden group flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><HandCoins size={20} /></div>
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        {i18n.language === 'ro' ? 'Încasări & Restanțe' : 'Collection & Outstanding'}
                    </span>
                </div>
                
                <div className="flex items-center gap-4 bg-bg-main/50 p-4 rounded-2xl border border-border-color/50 shadow-inner">
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-border-color/50"
                                strokeWidth="3"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className={`${periodCollectionPercentage >= 80 ? 'text-emerald-500' : periodCollectionPercentage >= 50 ? 'text-amber-500' : 'text-red-500'}`}
                                strokeDasharray={`${periodCollectionPercentage}, 100`}
                                strokeWidth="3"
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-sm font-black text-main leading-none">{periodCollectionPercentage}%</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-black text-main">{t('Collection Rate')}</div>
                        <div className="text-[10px] text-text-secondary font-medium leading-tight mt-1">{i18n.language === 'ro' ? 'Din total facturat/realizat în perioada selectată' : 'Out of total invoiced/realized in period'}</div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                        <div>
                            <div 
                              className="text-2xl font-black text-main cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => setDebtsListModal({ filterType: 'all', paymentMethod: 'all' })}
                            >
                              {totalOutstanding.toLocaleString()} <span className="text-sm font-medium text-text-secondary">RON</span>
                            </div>
                            <div className="text-[9px] font-bold text-text-secondary/70 mt-1 select-none">
                              (
                              <span 
                                className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                                onClick={() => setDebtsListModal({ filterType: 'all', paymentMethod: 'cash' })}
                              >
                                {totalOutstandingCash.toLocaleString()} cash
                              </span>
                              {' / '}
                              <span 
                                className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                                onClick={() => setDebtsListModal({ filterType: 'all', paymentMethod: 'cont' })}
                              >
                                {totalOutstandingCont.toLocaleString()} cont
                              </span>
                              )
                            </div>
                            <p className="text-[10px] text-text-secondary mt-1 select-none">
                                {i18n.language === 'ro' ? 'Total sumă de încasat' : 'Total outstanding balance'}
                            </p>
                        </div>
                        
                        {totalOutstanding > 0 && (
                            <div className="mt-1 bg-bg-main p-3 rounded-xl border border-border-color shadow-sm">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-3 pb-2 border-b border-border-color/50">
                                    {i18n.language === 'ro' ? 'Scadențar Restanțe' : 'Aging Report'}
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-text-secondary font-medium">0 - 15 {t('days')}</span>
                                        <span className="font-bold text-emerald-500">{agingReport.current.toLocaleString()} <span className="text-[9px] opacity-70">RON</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-text-secondary font-medium">16 - 30 {t('days')}</span>
                                        <span className="font-bold text-amber-500">{agingReport.days15to30.toLocaleString()} <span className="text-[9px] opacity-70">RON</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-text-secondary font-medium">31 - 60 {t('days')}</span>
                                        <span className="font-bold text-orange-500">{agingReport.days30to60.toLocaleString()} <span className="text-[9px] opacity-70">RON</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pt-2 border-t border-border-color/30">
                                        <span className="text-text-secondary font-medium">&gt; 60 {t('days')} <span className="text-[9px] text-red-500 bg-red-500/10 px-1 rounded ml-1">Risc</span></span>
                                        <span className="font-black text-red-600">{agingReport.daysOver60.toLocaleString()} <span className="text-[9px] opacity-70">RON</span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div 
                              className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex flex-col justify-between transition-colors"
                            >
                                <div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter select-none">{t('Maintenance')}</div>
                                    <div 
                                      className="text-sm font-black text-main cursor-pointer hover:text-blue-600 transition-colors"
                                      onClick={() => setDebtsListModal({ filterType: 'maintenance', paymentMethod: 'all' })}
                                    >
                                      {totalOutstandingMaintenance.toLocaleString()} <span className="text-[8px] font-medium opacity-50">RON</span>
                                    </div>
                                </div>
                                <div className="text-[9px] font-bold text-text-secondary/70 mt-1 select-none">
                                  (
                                  <span 
                                    className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                                    onClick={() => setDebtsListModal({ filterType: 'maintenance', paymentMethod: 'cash' })}
                                  >
                                    {totalOutstandingMaintenanceCash.toLocaleString()} cash
                                  </span>
                                  {' / '}
                                  <span 
                                    className="cursor-pointer hover:text-blue-500 hover:underline transition-colors"
                                    onClick={() => setDebtsListModal({ filterType: 'maintenance', paymentMethod: 'cont' })}
                                  >
                                    {totalOutstandingMaintenanceCont.toLocaleString()} cont
                                  </span>
                                  )
                                </div>
                            </div>
                            <div 
                              className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between transition-colors"
                            >
                                <div>
                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter select-none">{t('One-Time Works')}</div>
                                    <div 
                                      className="text-sm font-black text-main cursor-pointer hover:text-emerald-600 transition-colors"
                                      onClick={() => setDebtsListModal({ filterType: 'projects', paymentMethod: 'all' })}
                                    >
                                      {totalOutstandingProjects.toLocaleString()} <span className="text-[8px] font-medium opacity-50">RON</span>
                                    </div>
                                </div>
                                <div className="text-[9px] font-bold text-text-secondary/70 mt-1 select-none">
                                  (
                                  <span 
                                    className="cursor-pointer hover:text-emerald-500 hover:underline transition-colors"
                                    onClick={() => setDebtsListModal({ filterType: 'projects', paymentMethod: 'cash' })}
                                  >
                                    {totalOutstandingProjectsCash.toLocaleString()} cash
                                  </span>
                                  {' / '}
                                  <span 
                                    className="cursor-pointer hover:text-emerald-500 hover:underline transition-colors"
                                    onClick={() => setDebtsListModal({ filterType: 'projects', paymentMethod: 'cont' })}
                                  >
                                    {totalOutstandingProjectsCont.toLocaleString()} cont
                                  </span>
                                  )
                                </div>
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </div>
          </>
        )}
      </div>

      {/* Data Audit Section */}
      {maintenanceClientsWithoutProperties.length > 0 && (
        <div className="stihl-card rounded-2xl p-6 border-l-4 border-l-red-500 bg-red-500/5">
            <h2 className="text-lg font-black text-red-600 mb-4 flex items-center gap-2">
                <Trash2 size={20} />
                {t('Warning: Incomplete Data')}
            </h2>
            <p className="text-sm text-text-secondary mb-4">
                {t('The following maintenance clients have no defined locations:')} 
                {t('Without a location, you cannot correctly record the visit location or the work surface.')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {maintenanceClientsWithoutProperties.map(client => (
                    <div key={client.id} className="bg-bg-card p-3 rounded-xl border border-red-200 dark:border-red-900/30 flex justify-between items-center">
                        <span className="text-sm font-bold text-main">{client.nume}</span>
                        <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{t('Missing Location')}</span>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="stihl-card rounded-2xl p-6 overflow-hidden">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-main uppercase tracking-wider">{t('Payment History & Balance')}</h2>
              <div className="flex bg-bg-main p-0.5 rounded-lg border border-border-color/60">
                <button
                  type="button"
                  onClick={() => setBalanceFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    balanceFilter === 'all'
                      ? 'bg-accent-color text-accent-text shadow-sm'
                      : 'text-text-secondary hover:text-main'
                  }`}
                >
                  {t('All (Filter)')}
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceFilter('with_balance')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    balanceFilter === 'with_balance'
                      ? 'bg-accent-color text-accent-text shadow-sm'
                      : 'text-text-secondary hover:text-main'
                  }`}
                >
                  {t('With Balance')}
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceFilter('no_balance')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    balanceFilter === 'no_balance'
                      ? 'bg-accent-color text-accent-text shadow-sm'
                      : 'text-text-secondary hover:text-main'
                  }`}
                >
                  {t('Without Balance')}
                </button>
              </div>
              <div className="flex items-center gap-1.5 border-l border-border-color/60 pl-3">
                <button
                  type="button"
                  onClick={() => downloadInvoices('card')}
                  disabled={isDownloadingInvoices !== null}
                  className="p-1.5 rounded-lg border border-border-color bg-bg-card hover:bg-bg-main text-blue-500 hover:text-blue-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 relative flex items-center justify-center cursor-pointer group"
                  title={t('Download Invoices for Card Clients')}
                >
                  {isDownloadingInvoices === 'card' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CreditCard size={14} />
                  )}
                  <span className="absolute -bottom-1 -right-1 bg-accent-color text-accent-text text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow-sm scale-75 group-hover:scale-90 transition-transform">↓</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadInvoices('cash')}
                  disabled={isDownloadingInvoices !== null}
                  className="p-1.5 rounded-lg border border-border-color bg-bg-card hover:bg-bg-main text-green-600 hover:text-green-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 relative flex items-center justify-center cursor-pointer group"
                  title={t('Download Invoices for Cash Clients')}
                >
                  {isDownloadingInvoices === 'cash' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <DollarSign size={14} />
                  )}
                  <span className="absolute -bottom-1 -right-1 bg-accent-color text-accent-text text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow-sm scale-75 group-hover:scale-90 transition-transform">↓</span>
                </button>
              </div>
            </div>
            {/* Butoanele de export PDF/Excel și selectorul lună/an au fost eliminate conform cerințelor */}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead>
              <tr>
                <th className="py-2 px-4 text-left font-bold text-[11px] text-text-secondary uppercase tracking-widest">{t('Client')}</th>
                {Array.from({ length: 5 }).map((_, i) => {
                  const currentDate = new Date();
                  const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                  d.setMonth(d.getMonth() - i);
                  
                  const monthTotal = paymentHistory.reduce((acc, p) => {
                    if (!p.date || !p.date.toDate) return acc;
                    const pDate = p.date.toDate();
                    if (pDate.getMonth() === d.getMonth() && pDate.getFullYear() === d.getFullYear()) {
                      return acc + (p.amount || 0);
                    }
                    return acc;
                  }, 0);

                  return (
                    <th key={i} className={`w-[15%] py-3 px-4 border-b border-border-color/30 text-left whitespace-nowrap ${i > 0 ? 'border-l' : ''} ${i === 0 ? 'bg-accent-color/5' : ''}`}>
                      <div className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{d.toLocaleString(i18n.language, { month: 'long' })}</div>
                      <div className="text-[11px] font-bold text-accent-color/80 mt-0.5">{monthTotal > 0 ? `${monthTotal} RON` : ''}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {(() => {
                const filtered = [...augmentedClients].filter(client => {
                  if (balanceFilter === 'all') return true;
                  if (balanceFilter === 'with_balance') return (client.sold || 0) > 0;
                  if (balanceFilter === 'no_balance') return (client.sold || 0) <= 0;
                  return true;
                });

                const activeClients = filtered.filter(client => {
                  const status = (client.status || '').toLowerCase();
                  return status !== 'inactiv' && status !== 'inactive';
                }).sort((a, b) => (b.sold || 0) - (a.sold || 0));

                const inactiveClients = filtered.filter(client => {
                  const status = (client.status || '').toLowerCase();
                  return status === 'inactiv' || status === 'inactive';
                }).sort((a, b) => (b.sold || 0) - (a.sold || 0));

                const formatBillingMonth = (billingMonth: string, locale: string) => {
                  if (billingMonth === 'Istoric') return t('Istoric') || 'Istoric';
                  const parts = billingMonth.split('-');
                  if (parts.length === 2) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1; // 0-based month
                    const d = new Date(y, m, 1);
                    return d.toLocaleString(locale, { month: 'long', year: 'numeric' });
                  }
                  return billingMonth;
                };

                const renderClientRow = (client: any) => {
                  const soldValue = client.sold || 0;
                  const isOverdue = client.ziScadenta && client.ziScadenta < new Date().getDate();
                  const hasDebt = soldValue > 0;
                  const hasCredit = soldValue < 0;

                  const waMessage = t('WhatsApp Debtor Message', { 
                    userName: orgData?.name || t('Firma'), 
                    companyName: orgData?.name || '', 
                    sold: soldValue, 
                    date: format(new Date(), 'dd.MM.yyyy'),
                    portalLink: `${window.location.origin}/#client-portal/${client.id}`
                  });
                  const waLink = getWhatsAppLink(client.telefon, waMessage);

                  return (
                    <tr key={client.id} className={`hover:bg-bg-main/50 transition-colors group ${client.status === 'Inactiv' ? 'opacity-50' : ''}`}>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hasDebt ? (isOverdue ? 'bg-red-500 animate-pulse' : 'bg-orange-400') : hasCredit ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                          <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                  <div className="text-[13px] font-bold text-main leading-tight flex items-center gap-1.5">
                                      {client.preferredPayment === 'cash' ? (
                                          <span title="Cash" className="inline-flex items-center flex-shrink-0"><DollarSign size={14} className="text-green-600 dark:text-green-400" /></span>
                                      ) : (
                                          <span title="Card / Cont" className="inline-flex items-center flex-shrink-0"><CreditCard size={14} className="text-blue-500" /></span>
                                      )}
                                      {client.tip_persoana === 'PJ' 
                                          ? `${client.numeFirma || 'Firma Necunoscută'}${client.nume ? ` (${client.nume})` : ''}` 
                                          : client.nume}
                                  </div>
                                  {hasDebt && (
                                      waLink ? (
                                          <a
                                              href={waLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-green-600 hover:text-green-700 p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors inline-flex items-center justify-center"
                                              title={t('Send WhatsApp Notifications')}
                                          >
                                              <BellRing size={14} />
                                          </a>
                                      ) : (
                                          <button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  toast.error('Clientul nu are un număr de telefon valid salvat.');
                                              }}
                                              className="text-gray-400 p-1 hover:bg-gray-50 dark:hover:bg-gray-800/20 rounded transition-colors"
                                              title="Clientul nu are număr de telefon valid"
                                          >
                                              <BellRing size={14} />
                                          </button>
                                      )
                                  )}
                              </div>
                              {hasDebt && (
                                  <div className="flex items-center gap-2">
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setPaymentModal({ isOpen: true, client, amount: soldValue.toString() });
                                          }}
                                          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                          title={t('Collect')}
                                      >
                                          <HandCoins size={16} strokeWidth={1.2} className="opacity-70" />
                                      </button>
                                      <div className="text-[11px] font-bold text-red-500">{t('Balance')}: {soldValue} RON</div>
                                  </div>
                              )}
                              {hasCredit && (
                                  <div className="flex items-center gap-1.5">
                                      <div className="text-[11px] font-bold text-blue-500">{t('Credit')}: {Math.abs(soldValue)} RON</div>
                                      <span className="text-[8px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">{t('Advance')}</span>
                                  </div>
                              )}
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: 5 }).map((_, i) => {
                        const currentDate = new Date();
                        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                        d.setMonth(d.getMonth() - i);
                        const month = d.getMonth();
                        const year = d.getFullYear();

                        const cellPayments = paymentHistory.filter(p => {
                          if (!p.date || !p.date.toDate) return false;
                          if (p.clientId !== client.id) return false;
                          const pDate = p.date.toDate();
                          return pDate.getMonth() === month && pDate.getFullYear() === year;
                        }).map(p => ({
                          id: p.id,
                          amount: p.amount || 0,
                          date: p.date,
                          details: p.details || '',
                          allocations: p.allocations
                        }));

                        return (
                          <td key={i} className={`py-2 px-4 align-top border-border-color/20 ${i > 0 ? 'border-l' : ''} ${i === 0 ? 'bg-accent-color/5' : ''}`}>
                            {cellPayments.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {cellPayments.map(p => (
                                      <div key={`${p.id}-${p.amount}-${p.details}`} className="flex flex-col group/pay border-b border-border-color/20 last:border-0 pb-1 last:pb-0">
                                          <div className="flex items-center justify-between">
                                              <span className={`text-[11px] font-black ${
                                                  (client.contractType === 'maintenance') 
                                                      ? 'text-blue-600 dark:text-blue-400' 
                                                      : 'text-emerald-600 dark:text-emerald-400'
                                              }`}>{p.amount} RON</span>
                                              <button 
                                                  onClick={async () => {
                                                      try {
                                                          await handleDeletePayment(p.id);
                                                          toast.success(t('Payment deleted'));
                                                      } catch(err: any) {
                                                          toast.error(t('Error') + ': ' + err.message);
                                                      }
                                                  }}
                                                  disabled={isDeleting === p.id}
                                                  className="opacity-0 group-hover/pay:opacity-100 text-text-secondary hover:text-red-500 transition-opacity"
                                                  title={t('Delete')}
                                              >
                                                  <Trash2 size={10} />
                                              </button>
                                          </div>
                                          <div className="text-[8px] text-text-secondary font-bold tracking-tighter -mt-0.5 flex flex-wrap items-center gap-1">
                                              <span>{p.date?.toDate ? format(p.date.toDate(), 'dd.MM.yyyy') : '-'}</span>
                                              {p.allocations && p.allocations.length > 0 && (
                                                  <span className="text-[7.5px] text-accent-color/80 font-medium">
                                                      - {p.allocations.map((alloc: any) => {
                                                          const formattedMonth = formatBillingMonth(alloc.billingMonth, i18n.language);
                                                          const prop = properties?.find(pr => pr.id === alloc.propertyId);
                                                          const propName = prop ? (prop.name && prop.name !== 'Locație Principală' ? prop.name : prop.address) : '';
                                                          const forText = (i18n.language || '').startsWith('ro') ? 'pt.' : t('for');
                                                          return `${forText} ${formattedMonth}${propName ? ` (${propName})` : ''}`;
                                                      }).join(', ')}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                                </div>
                            ) : (
                                <div className="flex justify-center py-2">
                                  <span className="text-text-secondary/20 text-[11px] font-bold">-</span>
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                };

                const elements: React.ReactNode[] = [];

                if (activeClients.length > 0) {
                  elements.push(
                    <tr key="header-active" className="bg-accent-color/[0.02] border-b border-border-color/30">
                      <td colSpan={6} className="py-2 px-4 text-[10px] font-black text-accent-color/90 uppercase tracking-widest">
                        {t('Active Clients')} ({activeClients.length})
                      </td>
                    </tr>
                  );
                  activeClients.forEach(client => {
                    elements.push(renderClientRow(client));
                  });
                }

                if (inactiveClients.length > 0) {
                  elements.push(
                    <tr key="header-inactive" className="bg-accent-color/[0.02] border-b border-border-color/30">
                      <td colSpan={6} className="py-2 px-4 text-[10px] font-black text-text-secondary/90 uppercase tracking-widest">
                        {t('Inactive Clients')} ({inactiveClients.length})
                      </td>
                    </tr>
                  );
                  inactiveClients.forEach(client => {
                    elements.push(renderClientRow(client));
                  });
                }

                if (activeClients.length === 0 && inactiveClients.length === 0) {
                  elements.push(
                    <tr key="no-clients">
                      <td colSpan={6} className="py-8 text-center text-text-secondary text-[13px]">
                        {t('No clients found') || 'Nu s-au găsit clienți'}
                      </td>
                    </tr>
                  );
                }

                return elements;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ReportsPage;

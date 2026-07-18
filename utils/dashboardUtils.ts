import { Client } from '../src/types';
export { isDebtor } from './clientUtils';

export const getClientDisplayName = (clientId: string, fallbackName: string, clients: Client[]) => {
  const c = clients.find(c => c.id === clientId);
  if (c && c.tip_persoana === 'PJ') {
    return `${c.numeFirma || c.nume} (${c.nume})`;
  }
  return c ? c.nume : fallbackName;
};

export const formatVisitDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
};

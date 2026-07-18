import { Client } from '../src/types';

/**
 * Canonical isDebtor function — single source of truth.
 * Used across Dashboard, Reports, and Clients modules.
 *
 * @param client - The augmented client object (with sold/ziScadenta/dataScadenta)
 * @param forceAll - If true, returns true for any client with a positive sold balance
 */
export const isDebtor = (client: Pick<Client, 'sold' | 'ziScadenta' | 'dataScadenta'>, forceAll = false): boolean => {
  if (!client.sold || client.sold <= 0) return false;
  if (forceAll) return true;
  if (client.dataScadenta) {
    const today = new Date().toISOString().split('T')[0];
    return client.dataScadenta < today;
  }
  const dayOfMonth = new Date().getDate();
  return dayOfMonth > (client.ziScadenta || 15);
};


import { db, collection, addDoc, serverTimestamp } from './firebase';

export enum AuditAction {
  CREATE_CLIENT = 'CREATE_CLIENT',
  UPDATE_CLIENT = 'UPDATE_CLIENT',
  DELETE_CLIENT = 'DELETE_CLIENT',
  CREATE_VISIT = 'CREATE_VISIT',
  UPDATE_VISIT = 'UPDATE_VISIT',
  DELETE_VISIT = 'DELETE_VISIT',
  FINALIZE_VISIT = 'FINALIZE_VISIT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  DELETE_PRODUCT = 'DELETE_PRODUCT',
}

export interface AuditLogEntry {
  userId: string;
  userName: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
  organizationId: string;
}

export async function logAudit(entry: AuditLogEntry) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...entry,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

export function computeChanges(oldObj: any, newObj: any, ignoreFields: string[] = ['updatedAt', 'createdAt', 'id']): { field: string; oldValue: any; newValue: any }[] {
  if (!oldObj || !newObj) return [];
  const changes: { field: string; oldValue: any; newValue: any }[] = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  
  allKeys.forEach(key => {
    if (ignoreFields.includes(key)) return;
    
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  });
  
  return changes;
}

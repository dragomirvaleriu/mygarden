import React from 'react';
import { UserProfile } from '../src/types';

interface PermissionGateProps {
  userProfile: UserProfile | null | undefined;
  allowedTypes: Array<'PJ' | 'PF'>;
  allowedRoles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A highly reusable Permission Gate component that controls visibility of UI elements
 * based on the user's accountType (PF/PJ) and optional workspace roles.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  userProfile,
  allowedTypes,
  allowedRoles,
  fallback = null,
  children
}) => {
  if (!userProfile) {
    return <>{fallback}</>;
  }

  const accountType = userProfile.accountType || 'PJ';
  const role = userProfile.role;

  const hasTypeAccess = allowedTypes.includes(accountType);
  const hasRoleAccess = allowedRoles 
    ? allowedRoles.includes(role) 
    : true;

  if (!hasTypeAccess || !hasRoleAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

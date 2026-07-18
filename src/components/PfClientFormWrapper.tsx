import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import ClientForm from '../../pages/ClientForm';
import { Page, UserProfile } from '../types';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userRole: string;
  userProfile: UserProfile;
  accountType: 'PF' | 'PJ';
}

export const PfClientFormWrapper: React.FC<Props> = (props) => {
  const { clients } = useData();
  const pfClient = clients.length > 0 ? clients[0] : null;

  return (
    <ClientForm 
      id={pfClient ? pfClient.id : null} 
      {...props} 
    />
  );
};

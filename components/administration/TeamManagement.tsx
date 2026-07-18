import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { UserProfile, Invitation } from '@/src/types';
import { Trash2, Edit2, X, Save, Shield, Mail, UserPlus, Users, KeyRound, Loader2, Lock, MessageSquare } from 'lucide-react';
import { auth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, db, doc, updateDoc } from '../../services/firebase';
import TeamChat from './TeamChat';
import Timesheets from '../../pages/Timesheets';
import { Clock } from 'lucide-react';

interface Props {
  orgName: string;
  organizationId: string;
  userProfile: UserProfile;
  members: UserProfile[];
  invites: Invitation[];
  userRole: string;
  currentUserUid?: string;
  newEmail: string;
  setNewEmail: (email: string) => void;
  handleInvite: (e: React.FormEvent) => Promise<void>;
  cancelInvite: (id: string) => Promise<void>;
  handleToggleRole: (uid: string, currentRole: string, email: string) => Promise<void>;
  handleUpdateName: (uid: string, newName: string) => Promise<void>;
  handleUpdateMember: (uid: string, data: Partial<UserProfile>) => Promise<void>;
  setConfirmationModal: (modal: any) => void;
  isProcessing: boolean;
  addLog: (msg: string) => void;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
}

const TeamManagement: React.FC<Props> = ({
  orgName,
  organizationId,
  userProfile,
  members,
  invites,
  userRole,
  currentUserUid,
  newEmail,
  setNewEmail,
  handleInvite,
  cancelInvite,
  handleToggleRole,
  handleUpdateName,
  handleUpdateMember,
  setConfirmationModal,
  isProcessing,
  addLog,
  subscriptionTier
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'members' | 'chat' | 'timesheets'>(userProfile.teamManagementActiveTab || 'members');
  
  const handleTabChange = async (tab: 'members' | 'chat' | 'timesheets') => {
    setActiveTab(tab);
    if (userProfile?.uid) {
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          teamManagementActiveTab: tab
        });
      } catch (err) {
        console.error("Failed to save active tab", err);
      }
    }
  };
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [passwordModal, setPasswordModal] = useState<{isOpen: boolean, member: UserProfile | null}>({isOpen: false, member: null});
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal.member) return;
    
    if (passForm.new !== passForm.confirm) {
        toast.error(t('Passwords do not match'));
        return;
    }

    setIsUpdatingPass(true);
    try {
        const isSelf = passwordModal.member.uid === auth.currentUser?.uid;
        
        if (isSelf) {
            // Re-auth flow
            const user = auth.currentUser;
            if (!user || !user.email) throw new Error('No user authenticated');
            const credential = EmailAuthProvider.credential(user.email, passForm.current);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, passForm.new);
        }
        
        // Always update employeeCode in Firestore as well for compatibility
        await handleUpdateMember(passwordModal.member.uid, { employeeCode: passForm.new });
        
        toast.success(t('Password updated successfully'));
        setPasswordModal({ isOpen: false, member: null });
        setPassForm({ current: '', new: '', confirm: '' });
    } catch (error: any) {
        console.error('Password update error:', error);
        toast.error(error.message || t('Error updating password'));
    } finally {
        setIsUpdatingPass(false);
    }
  };

  const startEditing = (member: UserProfile) => {
    setEditingMember(member);
    setEditForm({
      displayName: member.displayName || '',
      email: member.email,
      role: member.role,
      employeeCode: member.employeeCode || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    
    try {
      await handleUpdateMember(editingMember.uid, editForm);
      setEditingMember(null);
      setEditForm({});
    } catch (error) {
      console.error("Error updating member:", error);
    }
  };

  return (
    <section className="stihl-card rounded-lg p-6 h-fit relative bg-bg-card border border-border-color min-h-[600px]">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border-color">
        <div className="flex items-center gap-6">
            <button 
                onClick={() => handleTabChange('members')}
                className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all pb-2 -mb-[17px] border-b-2 ${activeTab === 'members' ? 'text-accent-color border-accent-color' : 'text-text-secondary border-transparent opacity-50'}`}
            >
                <Users size={16} />
                {t('Team')} {orgName}
            </button>
            <button 
                onClick={() => handleTabChange('timesheets')}
                className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all pb-2 -mb-[17px] border-b-2 ${activeTab === 'timesheets' ? 'text-accent-color border-accent-color' : 'text-text-secondary border-transparent opacity-50'}`}
            >
                <Clock size={16} />
                {t('Timesheets')}
            </button>
            <button 
                onClick={() => handleTabChange('chat')}
                className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all pb-2 -mb-[17px] border-b-2 ${activeTab === 'chat' ? 'text-accent-color border-accent-color' : 'text-text-secondary border-transparent opacity-50'}`}
            >
                <MessageSquare size={16} />
                {t('Communication')}
            </button>
        </div>
        
        {activeTab === 'members' && (
            <div className="flex items-center gap-2">
               <span className="px-2 py-1 bg-accent-color/10 text-accent-color rounded text-[11px] font-bold uppercase">{members.length} {t('Members')}</span>
               {invites.length > 0 && <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-[11px] font-bold uppercase">{invites.length} {t('Invitations')}</span>}
            </div>
        )}
      </div>

      {activeTab === 'chat' ? (
          <TeamChat 
            organizationId={organizationId}
            currentUser={userProfile}
            members={members}
          />
      ) : activeTab === 'timesheets' ? (
          <Timesheets 
            organizationId={organizationId} 
            userRole={userRole} 
            members={members} 
            isEmbedded={true} 
          />
      ) : (
          <>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {members.map(m => (
          <div key={m.uid} className="group bg-bg-main hover:bg-bg-card rounded-lg p-4 flex flex-col border border-border-color transition-all hover:shadow-sm hover:border-accent-color/30 min-w-0 gap-3">
            <div className="flex items-center justify-between gap-3 min-w-0 w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0 transition-colors duration-300 ${m.role === 'admin' ? 'bg-gradient-to-br from-yellow-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-main leading-none truncate" title={m.email}>{m.displayName || t('No Name')}</p>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{m.email}</p>
                  <p className={`text-[11px] font-bold uppercase tracking-wider mt-1 transition-colors duration-300 ${m.role === 'admin' ? 'text-orange-500' : 'text-text-secondary'}`}>{m.role === 'admin' ? t('Administrator') : t('Employee')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {userRole === 'admin' && (
                  <>
                    <button 
                      onClick={() => startEditing(m)}
                      className="p-1.5 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-md transition-all"
                      title={t('Edit Member')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setPasswordModal({ isOpen: true, member: m })}
                      className="p-1.5 text-text-secondary hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-all"
                      title={t('Change Password')}
                    >
                      <KeyRound size={16} />
                    </button>
                    <button 
                      onClick={() => handleToggleRole(m.uid, m.role, m.email)}
                      className={`p-2 rounded-md transition-colors ${m.role === 'admin' ? 'text-orange-500 hover:bg-orange-500/10' : 'text-text-secondary hover:text-accent-color hover:bg-accent-color/10'}`}
                      title={m.role === 'admin' ? t('Demote to Employee') : t('Promote to Admin')}
                    >
                      <Shield size={18} />
                    </button>
                  </>
                )}
                {userRole === 'employee' && currentUserUid === m.uid && (
                  <>
                    <button 
                      onClick={() => startEditing(m)}
                      className="p-1.5 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-md transition-all"
                      title={t('Edit Member')}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setPasswordModal({ isOpen: true, member: m })}
                      className="p-1.5 text-text-secondary hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-all"
                      title={t('Change Password')}
                    >
                      <KeyRound size={16} />
                    </button>
                  </>
                )}
                {userRole === 'admin' && currentUserUid !== m.uid && (
                  <button 
                    onClick={() => setConfirmationModal({
                      type: 'removeMember',
                      title: t('Remove Member'),
                      message: `${t('Are you sure')} ${m.email}?`,
                      data: { uid: m.uid, email: m.email }
                    })}
                    className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                    title={t('Remove Member')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="stihl-card w-full max-w-md rounded-lg p-6 relative bg-bg-card animate-in zoom-in duration-200 border border-border-color shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-main flex items-center gap-2">
                <Edit2 size={20} className="text-accent-color" />
                {t('Edit Member')}
              </h3>
              <button onClick={() => setEditingMember(null)} className="text-text-secondary hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Full Name')}</label>
                <input 
                  type="text" 
                  value={editForm.displayName || ''}
                  onChange={e => setEditForm({...editForm, displayName: e.target.value})}
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Email (Informational)')}</label>
                <input 
                  type="email" 
                  value={editForm.email || ''}
                  readOnly
                  className="w-full bg-bg-main/50 border border-border-color rounded-md px-3 py-2 text-sm font-bold text-text-secondary outline-none cursor-not-allowed"
                />
                <p className="text-[11px] text-yellow-500 italic">{t('Email Change Info')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Password')}</label>
                <input 
                  type="text" 
                  value={editForm.employeeCode || ''}
                  onChange={e => setEditForm({...editForm, employeeCode: e.target.value})}
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all"
                  placeholder={t('Set New Password')}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Role')}</label>
                <select 
                  value={editForm.role}
                  onChange={e => setEditForm({...editForm, role: e.target.value as 'admin' | 'employee'})}
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all appearance-none"
                  disabled={userRole !== 'admin'}
                >
                  <option value="employee">{t('Employee')}</option>
                  <option value="admin">{t('Administrator')}</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-color mt-6">
                <button 
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-md font-bold uppercase text-xs text-text-secondary hover:bg-bg-main transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-md font-bold uppercase text-xs text-white bg-accent-color hover:bg-accent-color/90 shadow-md flex items-center gap-2"
                >
                  <Save size={16} />
                  {t('Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {userRole === 'admin' ? (
        <div className="mt-6 p-4 bg-bg-main rounded-lg border border-border-color">
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <label className="text-[11px] font-bold text-text-secondary uppercase ml-1 tracking-wider flex items-center gap-2">
              <Mail size={12} className="text-accent-color" />
              {t('Invite New Colleague')}
            </label>
            <div className="flex gap-2">
              <input 
                type="email" 
                required 
                placeholder="email@angajat.ro" 
                className="flex-1 bg-bg-card rounded-md px-4 py-2.5 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all text-sm" 
                value={newEmail} 
                onChange={e => setNewEmail(e.target.value)} 
              />
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="bg-accent-color hover:bg-accent-color/90 text-white px-4 h-10 rounded-md font-bold uppercase tracking-wider text-[11px] shadow-sm transition-all flex items-center justify-center shrink-0 gap-2 disabled:opacity-50"
                onClick={(e) => {
                  if ((!subscriptionTier || subscriptionTier === 'free') && members.length >= 1) {
                    e.preventDefault();
                    toast.error(t('Team limit reached. Upgrade to Pro to add employees.'));
                  }
                }}
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">{t('Send Invitation')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-600 dark:text-yellow-500 font-medium flex items-center gap-2">
            <Shield size={16} />
            {t('Only Admins Invite')}
          </p>
        </div>
      )}

            {invites.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border-color">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-500 ml-1 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  {t('Pending Invitations')}
                </h4>
                <div className="space-y-2">
                  {invites.map(i => (
                    <div key={i.id} className="bg-bg-main/50 border-l-2 border-red-500 rounded-r-lg p-3 flex items-center justify-between border-y border-r border-border-color">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                          <Mail size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-main leading-none">{i.email}</p>
                          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider italic mt-1">{t('Waiting Confirmation')}</p>
                        </div>
                      </div>
                      {userRole === 'admin' && (
                        <button onClick={() => cancelInvite(i.id)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-all" title={t('Cancel')}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
      )}

      {/* Password Change Modal */}
      {passwordModal.isOpen && passwordModal.member && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="stihl-card w-full max-w-md rounded-lg p-6 relative bg-bg-card animate-in zoom-in duration-200 border border-border-color shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-main flex items-center gap-2">
                <KeyRound size={20} className="text-accent-color" />
                {t('Change Password')}
              </h3>
              <button onClick={() => setPasswordModal({ isOpen: false, member: null })} className="text-text-secondary hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdatePass} className="space-y-4">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest bg-bg-main p-2 rounded-lg border border-border-color">
                {t('User')}: <span className="text-main">{passwordModal.member.email}</span>
              </p>

              {passwordModal.member.uid === auth.currentUser?.uid && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Current Password')}</label>
                  <input 
                    type="password" 
                    required
                    value={passForm.current}
                    onChange={e => setPassForm({...passForm, current: e.target.value})}
                    className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('New Password')}</label>
                <input 
                  type="password" 
                  required
                  value={passForm.new}
                  onChange={e => setPassForm({...passForm, new: e.target.value})}
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Confirm New Password')}</label>
                <input 
                  type="password" 
                  required
                  value={passForm.confirm}
                  onChange={e => setPassForm({...passForm, confirm: e.target.value})}
                  className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-color mt-6">
                <button 
                  type="button"
                  onClick={() => setPasswordModal({ isOpen: false, member: null })}
                  className="px-4 py-2 rounded-md font-bold uppercase text-xs text-text-secondary hover:bg-bg-main transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={isUpdatingPass}
                  className="px-4 py-2 rounded-md font-bold uppercase text-xs text-white bg-accent-color hover:bg-accent-color/90 shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingPass ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {t('Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default TeamManagement;

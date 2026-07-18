import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  db, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion
} from '../../services/firebase';
import { UserProfile } from '@/src/types';
import { Send, Users, User, MessageSquare, Bell, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  recipientId: string | null;
  createdAt: any;
  readBy: string[];
}

interface Props {
  organizationId: string;
  currentUser: UserProfile;
  members: UserProfile[];
}

const TeamChat: React.FC<Props> = ({ organizationId, currentUser, members }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipientId, setRecipientId] = useState<string | null>(null); // null = Team
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!organizationId) return;

    // Query messages for the organization where recipient is either null (team) or current user, or sent by current user
    const q = query(
      collection(db, 'team_messages'),
      where('organizationId', '==', organizationId),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      // Sort by createdAt client-side since we removed server-side orderBy
      const sorted = msgs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Descending, so latest is first
      });

      const filtered = sorted.filter(m => 
        m.recipientId === null || 
        m.recipientId === currentUser.uid || 
        m.senderId === currentUser.uid
      ).reverse();

      setMessages(filtered);
      
      // Mark as read
      msgs.forEach(m => {
        if (m.recipientId === currentUser.uid && !m.readBy.includes(currentUser.uid)) {
           updateDoc(doc(db, 'team_messages', m.id), {
             readBy: arrayUnion(currentUser.uid)
           });
        }
      });
    });

    return () => unsubscribe();
  }, [organizationId, currentUser.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'team_messages'), {
        organizationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        text: inputText.trim(),
        recipientId,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid]
      });
      setInputText('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t('Error sending message'));
    } finally {
      setIsSending(false);
    }
  };

  const getRecipientName = () => {
    if (!recipientId) return t('Whole Team');
    const member = members.find(m => m.uid === recipientId);
    return member ? (member.displayName || member.email) : t('User');
  };

  return (
    <div className="flex flex-col h-[500px] bg-bg-main rounded-2xl border border-border-color overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 bg-bg-card border-b border-border-color flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color shadow-inner">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-main uppercase tracking-tight">{t('Team Communication')}</h3>
            <p className="text-[11px] text-text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              {t('Online')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <select 
                value={recipientId || ''} 
                onChange={(e) => setRecipientId(e.target.value || null)}
                className="bg-bg-main border border-border-color rounded-lg px-3 py-1.5 text-[11px] font-black uppercase text-main outline-none focus:border-accent-color transition-all shadow-sm appearance-none"
            >
                <option value="">{t('Whole Team')}</option>
                {members.filter(m => m.uid !== currentUser.uid).map(m => (
                    <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                ))}
            </select>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[radial-gradient(var(--border-color)_1px,transparent_1px)] [background-size:20px_20px] [background-position:center]"
      >
        {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="w-16 h-16 rounded-full bg-border-color/20 flex items-center justify-center mb-4">
                    <MessageSquare size={32} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest">{t('No messages yet')}</p>
                <p className="text-[11px] mt-1">{t('Start a conversation with your team')}</p>
            </div>
        ) : (
            messages.map((msg) => {
                const isMine = msg.senderId === currentUser.uid;
                const time = msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : '--:--';
                
                return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
                        {msg.recipientId && !isMine && (
                            <span className="text-[8px] font-bold text-text-secondary uppercase px-1.5 py-0.5 bg-bg-card rounded-full border border-border-color mb-1">
                                {t('Direct Message')}
                            </span>
                        )}
                        <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm font-medium shadow-sm flex flex-col gap-1 ${
                            isMine 
                            ? 'bg-accent-color text-white rounded-br-sm' 
                            : 'bg-bg-card border border-border-color text-main rounded-bl-sm'
                        }`}>
                            <span className="leading-snug">{msg.text}</span>
                            
                            <div className={`flex items-center justify-end gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isMine ? 'text-white/70' : 'text-text-secondary/70'}`}>
                                <span>{!isMine ? msg.senderName : t('You')}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-current opacity-50"></span>
                                <span>{time}</span>
                                {isMine && msg.readBy.length > 1 && (
                                    <Bell size={8} className="animate-pulse ml-0.5" />
                                )}
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-bg-card border-t border-border-color">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder={`${t('Message to')} ${getRecipientName()}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-medium text-main outline-none focus:border-accent-color transition-all shadow-inner"
            />
            {recipientId && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-accent-color/10 text-accent-color rounded-md">
                    <User size={14} />
                </div>
            )}
          </div>
          <button 
            type="submit" 
            disabled={!inputText.trim() || isSending}
            className="w-12 h-12 bg-accent-color text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent-color/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isSending ? <Clock size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-[11px] text-text-secondary font-bold uppercase tracking-widest mt-3 text-center opacity-60">
            {recipientId ? t('Direct communication active') : t('Broadcast to whole team')}
        </p>
      </form>
    </div>
  );
};

export default TeamChat;

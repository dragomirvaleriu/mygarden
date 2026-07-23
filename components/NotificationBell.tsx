import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { db, collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from '../services/firebase';
import { AppNotification } from '../src/types';

interface Props {
  uid?: string;
}

const NotificationBell: React.FC<Props> = ({ uid }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!uid || notif.read) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'notifications', notif.id), { read: true });
    } catch (err) {
      // Non-critical — worst case it stays marked unread.
    }
  };

  if (!uid) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="relative w-9 h-9 rounded-xl bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-main hover:border-accent-color transition-all shadow-sm"
        title="Notificări"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse flex items-center justify-center text-[8px] font-black text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-bg-card border border-border-color rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200 z-[100]">
          <div className="p-3 border-b border-border-color">
            <p className="text-[11px] font-black text-main uppercase tracking-wider">Notificări</p>
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-xs text-text-secondary font-medium">Nicio notificare încă</p>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left p-3 border-b border-border-color/50 last:border-0 transition-colors ${
                    notif.read ? 'opacity-60' : 'bg-accent-color/5'
                  } hover:bg-bg-main`}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-color mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-main">{notif.title}</p>
                      <p className="text-[11px] text-text-secondary font-medium mt-0.5">{notif.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

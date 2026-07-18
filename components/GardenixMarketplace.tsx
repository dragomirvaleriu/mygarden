import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Store, Navigation, MessageCircle, MapPin, Package, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { marketService, MarketItem } from '../services/pf/marketService';
import { chatService, ChatMessage } from '../services/pf/chatService';
import { inventoryService, InventoryItem } from '../services/pf/inventoryService';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

const mapContainerStyle = { width: '100%', height: '300px', borderRadius: '1rem' };
const defaultCenter = { lat: 44.4268, lng: 26.1025 };
const libraries: any[] = ['geometry'];

export const GardenixMarketplace: React.FC = () => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const uid = auth.currentUser?.uid || 'pf_anonymous_user';
  
  // State
  const [items, setItems] = useState<MarketItem[]>([]);
  const [myInventory, setMyInventory] = useState<InventoryItem[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string>('');
  const [tradeType, setTradeType] = useState<'sale' | 'trade'>('sale');

  // Chat
  const [activeChat, setActiveChat] = useState<MarketItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // InfoWindow
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);

  // Load Data
  useEffect(() => {
    const unsubMarket = marketService.subscribeToMarket(setItems);
    const unsubInv = inventoryService.subscribeToInventory(uid, setMyInventory);
    
    // Get Location
    const unsubGarden = gardenService.subscribeToZones(uid, (zones) => {
      let found = false;
      for (const z of zones) {
        if (z.boundaryCoordinates && z.boundaryCoordinates.length > 0) {
          setUserLocation(z.boundaryCoordinates[0]);
          found = true;
          break;
        }
      }
      if (!found && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      }
    });

    return () => { unsubMarket(); unsubInv(); unsubGarden(); };
  }, [uid]);

  // Chat Subscription
  useEffect(() => {
    if (activeChat && activeChat.id) {
      const unsub = chatService.subscribeToMessages(activeChat.id, setMessages);
      return () => unsub();
    }
  }, [activeChat]);

  // Handle Post
  const handlePostItem = async () => {
    if (!selectedInventoryItem || !userLocation) {
      toast.error("Alege un produs și asigură-te că locația este activă.");
      return;
    }
    const invItem = myInventory.find(i => i.id === selectedInventoryItem);
    if (!invItem) return;

    try {
      await marketService.listItem({
        sellerId: uid,
        inventoryItemId: invItem.id!,
        productDetails: invItem,
        lat: userLocation.lat,
        lng: userLocation.lng,
        tradeType,
        status: 'active'
      });
      toast.success("Produs adăugat în Bazar!");
      setShowAddModal(false);
    } catch (err) {
      toast.error("Eroare la adăugarea produsului.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !activeChat.id) return;
    
    try {
      await chatService.sendMessage({
        marketItemId: activeChat.id,
        senderId: uid,
        receiverId: activeChat.sellerId,
        text: newMessage
      });
      setNewMessage('');
    } catch (err) {
      toast.error("Eroare la trimiterea mesajului.");
    }
  };

  const calculateDistance = (itemLat: number, itemLng: number) => {
    if (!isLoaded || !userLocation) return null;
    const p1 = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    const p2 = new window.google.maps.LatLng(itemLat, itemLng);
    return window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2) / 1000; // in km
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 text-orange-500">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Gardenix Marketplace</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Bazar Local Comunitar</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-sm shadow-orange-500/20"
        >
          + Adaugă Produs
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map Section */}
        <div className="lg:col-span-2">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              zoom={13}
              center={userLocation || defaultCenter}
              options={{ disableDefaultUI: true, zoomControl: true }}
            >
              {items.map(item => (
                <Marker 
                  key={item.id} 
                  position={{ lat: item.lat, lng: item.lng }}
                  onClick={() => setSelectedItem(item)}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: item.tradeType === 'sale' ? '#f97316' : '#3b82f6',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff'
                  }}
                />
              ))}

              {selectedItem && (
                <InfoWindow
                  position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
                  onCloseClick={() => setSelectedItem(null)}
                >
                  <div className="p-2 min-w-[150px]">
                    <h3 className="font-bold text-gray-900">{selectedItem.productDetails.name}</h3>
                    <p className="text-xs text-gray-500">{selectedItem.tradeType === 'sale' ? `${selectedItem.productDetails.price} RON` : 'La Schimb'}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-[300px] bg-gray-50 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {/* Items List */}
          <div className="mt-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Oferte Recente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map(item => {
                const dist = calculateDistance(item.lat, item.lng);
                return (
                  <div key={item.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${item.tradeType === 'sale' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        {item.tradeType === 'sale' ? 'Vânzare' : 'Schimb'}
                      </span>
                      {dist !== null && (
                        <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {dist.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 truncate" title={item.productDetails.name}>{item.productDetails.name}</h4>
                    <p className="text-sm font-black text-gray-700 mt-1">
                      {item.productDetails.quantity} {item.productDetails.unit} • {item.tradeType === 'sale' ? `${item.productDetails.price} RON` : 'Schimb'}
                    </p>
                    
                    <div className="flex gap-2 mt-4">
                      {item.sellerId !== uid && (
                        <button 
                          onClick={() => setActiveChat(item)}
                          className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Chat
                        </button>
                      )}
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Navighează
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5 flex flex-col h-[600px]">
          {activeChat ? (
            <>
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Discuție Produs</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase truncate max-w-[200px]">{activeChat.productDetails.name}</p>
                </div>
                <button onClick={() => setActiveChat(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderId === uid ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.senderId === uid ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleSendMessage} className="relative">
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Scrie un mesaj..." 
                  className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 pr-12 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
                <button type="submit" className="absolute right-2 top-2 w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center hover:bg-orange-600">
                  <Navigation className="w-4 h-4 rotate-90" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
              <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-bold text-sm text-gray-600 mb-1">Mesagerie Bazar</p>
              <p className="text-xs">Apasă pe Chat la un produs pentru a contacta proprietarul.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-gray-100 relative"
            >
              <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
              
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Store className="w-5 h-5 text-orange-500" /> Publică în Bazar
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Produs din Inventar</label>
                  <select 
                    value={selectedInventoryItem} onChange={e => setSelectedInventoryItem(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                  >
                    <option value="">Selectează un produs...</option>
                    {myInventory.map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Stoc: {i.quantity} {i.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Tip Ofertă</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTradeType('sale')}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${tradeType === 'sale' ? 'bg-orange-100 text-orange-600 border-2 border-orange-500' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}
                    >
                      Vânzare
                    </button>
                    <button 
                      onClick={() => setTradeType('trade')}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${tradeType === 'trade' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}
                    >
                      Schimb
                    </button>
                  </div>
                </div>

                {!userLocation && (
                  <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg">
                    ⚠️ Nu ți-am putut detecta locația. Ai nevoie de locație pentru a posta.
                  </p>
                )}

                <button 
                  onClick={handlePostItem}
                  className="w-full py-4 mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
                >
                  Publică Anunțul
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

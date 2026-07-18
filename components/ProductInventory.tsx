import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Bug, Leaf, Package, Search, Plus, X, Edit2, Trash2, Loader2 } from 'lucide-react';

import { inventoryService, InventoryItem } from '../services/pf/inventoryService';
import { auth } from '../services/firebase';

const ProductInventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<string>('Toate');
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsubscribe = inventoryService.subscribeToInventory(uid, (data) => {
      setInventory(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Îngrășământ');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('g');
  const [newPrice, setNewPrice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newQuantity || !newPrice) return;

    try {
      if (editingId) {
        await inventoryService.updateProduct(editingId, {
          name: newName,
          type: newType,
          quantity: parseFloat(newQuantity),
          unit: newUnit,
          price: parseFloat(newPrice)
        });
      } else {
        await inventoryService.addProduct(uid, {
          name: newName,
          type: newType,
          quantity: parseFloat(newQuantity),
          unit: newUnit,
          price: parseFloat(newPrice)
        });
      }
      closeForm();
    } catch (err) {
      console.error("Error saving inventory item:", err);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    if (item.id) setEditingId(item.id);
    setNewName(item.name);
    setNewType(item.type);
    setNewQuantity(item.quantity.toString());
    setNewUnit(item.unit);
    setNewPrice(item.price.toString());
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (confirm('Ești sigur că vrei să ștergi acest produs?')) {
      try {
        await inventoryService.deleteProduct(id);
        if (editingId === id) closeForm();
      } catch (err) {
        console.error("Error deleting product:", err);
      }
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setNewName('');
    setNewType('Îngrășământ');
    setNewQuantity('');
    setNewUnit('g');
    setNewPrice('');
  };

  const totalValue = inventory.reduce((sum, item) => sum + item.price, 0);

  const filteredInventory = inventory.filter(item => {
    if (filter === 'Toate') return true;
    return item.type === filter;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Îngrășământ': return <Leaf className="w-5 h-5 text-emerald-500" />;
      case 'Fungicid': return <ShieldAlert className="w-5 h-5 text-purple-500" />;
      case 'Erbicid': return <Bug className="w-5 h-5 text-amber-500" />;
      default: return <Package className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'Îngrășământ': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Fungicid': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Erbicid': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-4xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-center border border-gray-200">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Inventarul Meu</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              Produse & Soluții
            </p>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl px-5 py-3 text-white shadow-lg shadow-gray-900/20">
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Valoare Totală Stoc</p>
          <div className="font-black text-2xl flex items-baseline gap-1">
            {totalValue.toLocaleString('ro-RO')}
            <span className="text-sm font-bold text-gray-400">RON</span>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {['Toate', 'Îngrășământ', 'Fungicid', 'Erbicid'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === f 
                  ? 'bg-[#2D8C3C] text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/50'
              }`}
            >
              {f === 'Toate' && <Search className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />}
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if(isFormOpen && !editingId) closeForm(); 
            else { 
              setNewName(''); 
              setNewType('Îngrășământ'); 
              setIsFormOpen(true); 
            }
          }}
          className="bg-gray-900 hover:bg-black text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Adaugă Produs
        </button>
      </div>

      {/* Formular Adăugare/Editare */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 relative shadow-inner">
              <button onClick={closeForm} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-[#2D8C3C]" />}
                {editingId ? 'Editează Produs' : 'Adaugă Produs Nou'}
              </h3>
              
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">Nume Produs</label>
                  <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Alcupral 50 PU" className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#2D8C3C] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Categorie</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#2D8C3C] outline-none appearance-none">
                    <option value="Îngrășământ">Îngrășământ</option>
                    <option value="Fungicid">Fungicid</option>
                    <option value="Erbicid">Erbicid</option>
                    <option value="Altul">Altul</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Preț Total (RON)</label>
                  <input required type="number" min="0" step="0.1" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ex: 150" className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#2D8C3C] outline-none" />
                </div>
                <div className="lg:col-span-2 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Cantitate Stoc</label>
                    <input required type="number" min="0" step="0.1" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} placeholder="ex: 1000" className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#2D8C3C] outline-none" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-gray-600 mb-1">U.M.</label>
                    <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-[#2D8C3C] outline-none appearance-none">
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="buc">buc</option>
                    </select>
                  </div>
                </div>
                <div className="lg:col-span-2 flex items-end">
                  <button type="submit" className={`w-full text-white font-bold py-2.5 rounded-xl transition ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#2D8C3C] hover:bg-green-800'}`}>
                    {editingId ? 'Salvează Modificările' : 'Salvează Produs'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredInventory.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition relative group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getTypeStyles(item.type)}`}>
                  {getTypeIcon(item.type)}
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getTypeStyles(item.type)}`}>
                  {item.type}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg mb-4 truncate" title={item.name}>{item.name}</h3>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Stoc Rămas</p>
                  <p className="font-black text-gray-800 text-lg">
                    {item.quantity} <span className="text-sm text-gray-500 font-bold">{item.unit}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Preț Achiziție</p>
                  <p className="font-bold text-gray-800">{item.price} RON</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleEdit(item)} className="flex-1 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-gray-600 font-bold text-xs py-2.5 rounded-xl border border-gray-200 transition flex items-center justify-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Editează
                </button>
                <button onClick={() => handleDelete(item.id)} className="w-10 bg-gray-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-600 font-bold text-xs py-2.5 rounded-xl border border-gray-200 transition flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredInventory.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-bold">Nu s-au găsit produse în această categorie.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProductInventory;

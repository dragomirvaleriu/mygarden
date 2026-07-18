import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { db, doc, updateDoc, query, where, addDoc, collection, deleteDoc } from '../services/firebase';
import { Product, Client, Page } from '../src/types';
import { Package, Plus, Minus, Trash2, Search, AlertTriangle, TrendingDown, Edit2, X, ArrowLeft } from 'lucide-react';
import { logger } from '../services/logger';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { PageSkeleton } from '../components/ui/Skeleton';

interface Props {
  organizationId: string;
  onNavigate: (page: Page) => void;
}

const Registru: React.FC<Props> = ({ organizationId, onNavigate }) => {
  const { t } = useTranslation();
  const productsQuery = useMemo(() => {
    if (!organizationId) return null;
    return query(collection(db, 'products'), where('organizationId', '==', organizationId));
  }, [organizationId]);

  const clientsQuery = useMemo(() => {
    if (!organizationId) return null;
    return query(collection(db, 'clients'), where('organizationId', '==', organizationId));
  }, [organizationId]);

  const { data: products, loading: loadingProducts, loadMore: loadMoreProducts, hasMore: hasMoreProducts, loadingMore: loadingMoreProducts } = useFirestoreQuery<Product>(productsQuery, { pageSize: 0 });
  const { data: clients, loading: loadingClients } = useFirestoreQuery<Client>(clientsQuery, { pageSize: 0 });

  const loading = loadingProducts || loadingClients;

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{ title: string; message: string; onConfirm: () => void | Promise<void>; } | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', 
    category: 'consumable',
    stock: 0, 
    unit: 'litri', 
    dosagePerSqm: 0, 
    minStock: 10 
  });
  
  // Dosage Calculator State
  const [calcClientId, setCalcClientId] = useState('');
  const [calcProductId, setCalcProductId] = useState('');

  const handleUpdateStock = async (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newVal = Math.max(0, product.stock + delta);
    try {
      await updateDoc(doc(db, 'products', id), { stock: newVal });
    } catch (e) { logger.log(t('Error updating stock'), "error"); }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        ...newProduct,
        organizationId,
        unit: newProduct.category === 'equipment' ? 'buc' : newProduct.unit,
        dosagePerSqm: newProduct.category === 'equipment' ? 0 : newProduct.dosagePerSqm
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData);
        logger.log(t('Product updated'), "success");
      } else {
        await addDoc(collection(db, 'products'), productData);
        logger.log(t('Product added'), "success");
      }
      setShowAddModal(false);
      setEditingProductId(null);
      setNewProduct({ name: '', category: 'consumable', stock: 0, unit: 'litri', dosagePerSqm: 0, minStock: 10 });
    } catch (e) { logger.log(t('Error saving product'), "error"); }
  };

  const handleEditProduct = (product: Product) => {
    setNewProduct({
      name: product.name,
      category: product.category || 'consumable',
      stock: product.stock,
      unit: product.unit,
      dosagePerSqm: product.dosagePerSqm || 0,
      minStock: product.minStock || 10
    });
    setEditingProductId(product.id);
    setShowAddModal(true);
  };

  const handleDeleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    setConfirmationModal({
      title: t('Delete Product'),
      message: t('Are you sure you want to delete this product?'),
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', id));
          logger.log(t('Product deleted'), "warn");
        } catch (e: any) { 
          console.error("Error deleting product:", e);
          logger.log(t('Error deleting'), "error"); 
          alert(t('Error deleting product') + ': ' + e.message);
        }
      }
    });
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
  const lowStockProducts = products.filter(p => p.stock <= (p.minStock || 10));
  
  const consumables = filteredProducts.filter(p => !p.category || p.category === 'consumable');
  const equipment = filteredProducts.filter(p => p.category === 'equipment');

  const renderProductCard = (product: Product) => (
    <div key={product.id} className="stihl-card p-4 group hover:border-accent-color/50 transition-all duration-300 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-base font-bold text-main leading-tight line-clamp-1">{product.name}</h4>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">
            {product.category === 'equipment' ? t('Equipment') : `${product.dosagePerSqm} ${product.unit}/m²`}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }} className="p-1.5 text-text-secondary hover:text-accent-color transition-colors"><Edit2 size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-bg-main rounded-lg p-2 border border-border-color shadow-inner">
        <button onClick={() => handleUpdateStock(product.id, -1)} className="w-8 h-8 rounded-md bg-bg-card border border-border-color flex items-center justify-center hover:bg-accent-color hover:text-white transition-colors"><Minus size={14} /></button>
        <div className="text-center">
            <span className={`text-lg font-black tabular-nums ${product.stock <= (product.minStock || 10) ? 'text-red-500' : 'text-main'}`}>{product.stock}</span>
            <span className="text-[11px] font-bold text-text-secondary uppercase ml-1">{product.unit}</span>
        </div>
        <button onClick={() => handleUpdateStock(product.id, 1)} className="w-8 h-8 rounded-md bg-bg-card border border-border-color flex items-center justify-center hover:bg-accent-color hover:text-white transition-colors"><Plus size={14} /></button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate(Page.Administration)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-text-secondary"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-main uppercase tracking-tight">{t('Inventory')}</h1>
            <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em] opacity-60">{t('Inventory Description')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-accent-color text-white px-6 py-4 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg hover:shadow-accent-color/20 transition-all active:scale-95 whitespace-nowrap w-full md:w-auto justify-center"
        >
          <Plus size={18} />
          {t('Add Product')}
        </button>
        
        <div className="relative flex-1 w-full h-12">
            <input 
              type="text" 
              placeholder={t('Search...')}
              className="w-full h-full bg-bg-card border border-border-color rounded-xl px-4 pl-14 outline-none font-bold text-main focus:border-accent-color transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
            {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-main p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
            )}
        </div>
      </div>

      <div className="space-y-10">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-4">
                <h3 className="text-xl font-black text-main tracking-tight flex items-center gap-2">
                  <span className="w-2 h-8 bg-accent-color rounded-full"></span>
                  {t('Substances & Materials')}
                </h3>
                <div className="flex gap-6 text-sm font-bold text-text-secondary uppercase tracking-widest text-[11px]">
                    <span className="flex items-center gap-2">
                        <Package size={14} />
                        {t('Total')}: <span className="text-main">{products.length}</span>
                    </span>
                    <span className={`flex items-center gap-2 ${lowStockProducts.length > 0 ? 'text-red-500' : ''}`}>
                        <AlertTriangle size={14} />
                        {t('Critical')}: <span className={lowStockProducts.length > 0 ? 'text-red-500' : 'text-main'}>{lowStockProducts.length}</span>
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {consumables.length > 0 ? consumables.map(renderProductCard) : <p className="text-text-secondary text-sm italic col-span-full">{t('No products in this category')}</p>}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border-color pb-4">
              <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
              <h3 className="text-xl font-black text-main tracking-tight">{t('Parts & Equipment')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {equipment.length > 0 ? equipment.map(renderProductCard) : <p className="text-text-secondary text-sm italic col-span-full">{t('No products in this category')}</p>}
            </div>
          </div>

          {hasMoreProducts && (
            <div className="flex justify-center mt-8">
              <button 
                onClick={loadMoreProducts} 
                disabled={loadingMoreProducts}
                className="bg-bg-main border border-border-color text-text-secondary px-8 py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMoreProducts ? <span className="animate-pulse">{t('Loading...')}</span> : t('Load More')}
              </button>
            </div>
          )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => {
            setShowAddModal(false);
            setEditingProductId(null);
            setNewProduct({ name: '', category: 'consumable', stock: 0, unit: 'litri', dosagePerSqm: 0, minStock: 10 });
          }}></div>
          <div className="stihl-card w-full max-w-2xl p-0 relative animate-in zoom-in duration-300 bg-bg-card overflow-hidden rounded-2xl border border-border-color">
            
            <div className="bg-bg-main border-b border-border-color p-6">
                <h3 className="text-xl font-black mb-4 text-main uppercase tracking-tight">
                    {editingProductId ? t('Edit Product') : t('Add Product')}
                </h3>
                <div className="flex gap-4">
                    <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all text-center font-bold text-[11px] uppercase tracking-widest ${newProduct.category === 'consumable' ? 'border-accent-color bg-accent-color/5 text-accent-color' : 'border-border-color text-text-secondary hover:border-accent-color/50'}`}>
                        <input type="radio" name="category" value="consumable" checked={newProduct.category === 'consumable'} onChange={() => setNewProduct({...newProduct, category: 'consumable'})} className="hidden" />
                        {t('Substance (Dosable)')}
                    </label>
                    <label className={`flex-1 cursor-pointer p-4 rounded-xl border-2 transition-all text-center font-bold text-[11px] uppercase tracking-widest ${newProduct.category === 'equipment' ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-border-color text-text-secondary hover:border-blue-500/50'}`}>
                        <input type="radio" name="category" value="equipment" checked={newProduct.category === 'equipment'} onChange={() => setNewProduct({...newProduct, category: 'equipment'})} className="hidden" />
                        {t('Equipment (Pieces)')}
                    </label>
                </div>
            </div>

            <form onSubmit={handleAddProduct} className="p-6 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Product Name')}</label>
                <input required type="text" className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-accent-color" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              
              {newProduct.category === 'equipment' ? (
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Stock')}</label>
                          <input required type="number" className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-accent-color text-center" value={newProduct.stock || 0} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} />
                      </div>
                      <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Critical')}</label>
                          <input required type="number" className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-accent-color text-center" value={newProduct.minStock || 0} onChange={e => setNewProduct({...newProduct, minStock: parseInt(e.target.value)})} />
                      </div>
                      <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Unit')}</label>
                          <input disabled type="text" className="w-full bg-bg-main/50 border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none text-text-secondary text-center" value={t('Pcs')} />
                      </div>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Stock')}</label>
                          <input required type="number" className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-accent-color text-center" value={newProduct.stock || 0} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Unit')}</label>
                          <select className="w-full bg-bg-main border border-border-color rounded-xl px-2 py-3 text-sm font-bold outline-none focus:border-accent-color appearance-none" value={newProduct.unit || 'litri'} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                              <option value="litri">{t('Liters')}</option>
                              <option value="kg">{t('Kg')}</option>
                              <option value="plic">{t('Envelope')}</option>
                              <option value="flacon">{t('Bottle')}</option>
                              <option value="gram">{t('Grams')}</option>
                              <option value="sac">{t('Bag')}</option>
                          </select>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Critical')}</label>
                          <input required type="number" className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-accent-color text-center" value={newProduct.minStock || 0} onChange={e => setNewProduct({...newProduct, minStock: parseInt(e.target.value)})} />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t('Dosage')}</label>
                          <input required type="number" step="0.001" className="w-full bg-bg-main border border-border-color rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-accent-color text-center" value={newProduct.dosagePerSqm || 0} onChange={e => setNewProduct({...newProduct, dosagePerSqm: parseFloat(e.target.value)})} />
                      </div>
                  </div>
              )}

              <button type="submit" className="w-full stihl-button py-4 rounded-xl font-black uppercase text-xs tracking-widest text-white mt-4 shadow-lg shadow-accent-color/20 hover:shadow-accent-color/40 transition-all active:scale-95">
                {t('Save Product')}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmationModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setConfirmationModal(null)}></div>
          <div className="stihl-card w-full max-w-md rounded-2xl p-8 relative bg-bg-card animate-in zoom-in-95 duration-300 border border-border-color">
            <h3 className="text-xl font-black mb-4 text-main uppercase tracking-tight">{confirmationModal.title}</h3>
            <p className="text-sm text-text-secondary mb-8 leading-relaxed font-bold">{confirmationModal.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmationModal(null)} className="px-6 py-3 bg-bg-main border border-border-color rounded-xl font-bold uppercase tracking-widest text-[11px] text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors">{t('Cancel')}</button>
              <button 
                onClick={async () => {
                  if (confirmationModal.onConfirm) await confirmationModal.onConfirm();
                  setConfirmationModal(null);
                }} 
                className="px-8 py-3 bg-accent-color text-white rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-accent-color/20 hover:shadow-accent-color/40 transition-all active:scale-95"
              >
                {t('Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registru;

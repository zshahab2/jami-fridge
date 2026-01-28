import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, Package, Users, BarChart3, 
  Plus, RefreshCw, Clock, CheckCircle2, 
  Share2, UserPlus, Trash2, Edit3, AlertCircle, Sparkles
} from 'lucide-react';

// HARD-CODED CONFIGURATION
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhk4qwNQwuaPWLtME4k1b45Fj1YxK0pIzdVNw0GyhJd5d2l6dh9O8o3Bm-eYbulnzl/exec";

const apiKey = ""; // Gemini API Key provided by environment

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_INVENTORY = [
  { id: '1', name: 'Milk', category: 'Dairy', quantity: 8, unit: 'units', weightLbs: 2.0 },
  { id: '2', name: 'Eggs', category: 'Dairy', quantity: 12, unit: 'cartons', weightLbs: 1.5 },
  { id: '3', name: 'Bread', category: 'Bakery', quantity: 25, unit: 'loaves', weightLbs: 1.0 },
  { id: '4', name: 'Canned Beans', category: 'Pantry', quantity: 40, unit: 'cans', weightLbs: 0.9 },
  { id: '5', name: 'Apples', category: 'Produce', quantity: 30, unit: 'lbs', weightLbs: 1 },
];

const INITIAL_VOLUNTEERS = [
  { id: 'v1', name: 'Sarah Ahmed', phone: '555-0101', role: 'Coordinator' },
  { id: 'v2', name: 'Mike Chen', phone: '555-0102', role: 'Driver' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem('jami_inventory');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
    } catch (e) { return INITIAL_INVENTORY; }
  });

  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('jami_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [volunteers, setVolunteers] = useState(() => {
    try {
      const saved = localStorage.getItem('jami_volunteers');
      return saved ? JSON.parse(saved) : INITIAL_VOLUNTEERS;
    } catch (e) { return INITIAL_VOLUNTEERS; }
  });

  const [shifts, setShifts] = useState(() => {
    try {
      const saved = localStorage.getItem('jami_shifts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('jami_last_sync') || null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isVolModalOpen, setIsVolModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  
  const [txType, setTxType] = useState('out'); 
  const [selectedItem, setSelectedItem] = useState('');
  const [txQty, setTxQty] = useState(1);

  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({ name: '', unit: '', weightLbs: '', category: 'Produce' });
  
  const [newVol, setNewVol] = useState({ name: '', phone: '', role: 'Volunteer' });
  const [newShift, setNewShift] = useState({ volId: '', date: '', time: '6:00 PM - 7:00 PM' });

  useEffect(() => {
    localStorage.setItem('jami_inventory', JSON.stringify(inventory));
    localStorage.setItem('jami_transactions', JSON.stringify(transactions));
    localStorage.setItem('jami_volunteers', JSON.stringify(volunteers));
    localStorage.setItem('jami_shifts', JSON.stringify(shifts));
  }, [inventory, transactions, volunteers, shifts]);

  const stats = useMemo(() => {
    const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
    const weeklyOut = transactions.filter(t => t.type === 'out');
    const lbsDistributed = weeklyOut.reduce((acc, curr) => {
      const item = inventory.find(i => i.id === curr.itemId);
      const weight = item ? Number(item.weightLbs) : 1;
      return acc + (Number(curr.qty) * weight);
    }, 0);
    return { totalItems, lbsDistributed };
  }, [inventory, transactions]);

  // AI Weight Estimation Function
  const estimateWeight = async (name, unit) => {
    if (!name || !unit) return;
    setIsEstimating(true);
    
    const systemPrompt = "You are a food logistics expert for a community fridge. Your goal is to provide a single numerical estimate of the weight in pounds (lbs) for one unit of a specific food item. Respond ONLY with a JSON object: { \"weight\": number, \"category\": \"Produce\"|\"Dairy\"|\"Pantry\"|\"Bakery\" }.";
    const userQuery = `How much does one "${unit}" of "${name}" weigh in pounds? Provide the typical weight and the best category fit.`;

    let retries = 0;
    const maxRetries = 5;

    const attemptFetch = async () => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!response.ok) throw new Error('API Error');

        const result = await response.json();
        const data = JSON.parse(result.candidates[0].content.parts[0].text);
        
        setItemFormData(prev => ({
          ...prev,
          weightLbs: data.weight || prev.weightLbs,
          category: data.category || prev.category
        }));
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          await new Promise(res => setTimeout(res, Math.pow(2, retries) * 500));
          return attemptFetch();
        }
        console.error("AI estimation failed after retries:", error);
      } finally {
        setIsEstimating(false);
      }
    };

    await attemptFetch();
  };

  const syncWithGoogleSheets = useCallback(async (customInventory, customTransactions) => {
    setIsSyncing(true);
    const inv = customInventory || inventory;
    const txs = customTransactions || transactions;

    try {
      const payload = {
        timestamp: new Date().toISOString(),
        inventory: inv.map(i => ({ name: i.name, qty: i.quantity, unit: i.unit })),
        stats: stats,
        recentTransactions: txs.slice(0, 5)
      };
      
      await fetch(APPS_SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload) 
      });
      
      const now = new Date().toLocaleString();
      setLastSync(now);
      localStorage.setItem('jami_last_sync', now);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [inventory, transactions, stats]);

  const handleTransaction = () => {
    if (!selectedItem || txQty <= 0) return;
    const itemIndex = inventory.findIndex(i => i.id === selectedItem);
    const item = inventory[itemIndex];
    let newQty = Number(item.quantity);
    
    if (txType === 'in') newQty += Number(txQty);
    else if (txType === 'out') newQty -= Number(txQty);
    else if (txType === 'adjust') newQty = Number(txQty);
    
    const newInventory = [...inventory];
    newInventory[itemIndex] = { ...item, quantity: Math.max(0, newQty) };
    
    const newTx = {
      id: generateId(), 
      type: txType, 
      itemId: item.id, 
      itemName: item.name,
      qty: Number(txQty), 
      timestamp: new Date().toISOString()
    };
    const newTransactions = [newTx, ...transactions];

    setInventory(newInventory);
    setTransactions(newTransactions);
    syncWithGoogleSheets(newInventory, newTransactions);
    setIsTxModalOpen(false);
    setSelectedItem('');
    setTxQty(1);
  };

  const saveItemDefinition = (e) => {
    e.preventDefault();
    const updatedInv = editingItem?.id 
      ? inventory.map(i => i.id === editingItem.id ? { ...i, ...itemFormData } : i)
      : [...inventory, { ...itemFormData, id: generateId(), quantity: 0 }];

    setInventory(updatedInv);
    syncWithGoogleSheets(updatedInv, transactions);
    setIsItemEditorOpen(false);
    setEditingItem(null);
  };

  const deleteItem = (id) => {
    if (window.confirm("Delete this item definition?")) {
      const updatedInv = inventory.filter(i => i.id !== id);
      setInventory(updatedInv);
      syncWithGoogleSheets(updatedInv, transactions);
    }
  };

  const addVolunteer = () => {
    if (!newVol.name) return;
    setVolunteers([...volunteers, { ...newVol, id: generateId() }]);
    setNewVol({ name: '', phone: '', role: 'Volunteer' });
    setIsVolModalOpen(false);
  };

  const addShift = () => {
    if (!newShift.volId || !newShift.date) return;
    setShifts([...shifts, { ...newShift, id: generateId() }]);
    setIsShiftModalOpen(false);
  };

  const openItemEditor = (item = null) => {
    setEditingItem(item);
    setItemFormData(item ? { ...item } : { name: '', unit: '', weightLbs: '', category: 'Produce' });
    setIsItemEditorOpen(true);
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${
        activeTab === id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      <nav className="bg-white border-b sticky top-0 z-20 px-2 sm:px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-100">
            <Package className="text-white" size={20} />
          </div>
          <span className="font-bold text-lg hidden md:block tracking-tight">Jami Fridge</span>
        </div>
        <div className="flex gap-1">
          <TabButton id="dashboard" label="Home" icon={LayoutDashboard} />
          <TabButton id="inventory" label="Stock" icon={Package} />
          <TabButton id="volunteers" label="Team" icon={Users} />
          <TabButton id="reports" label="Sync" icon={BarChart3} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Impact (Lbs)</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600">{stats.lbsDistributed.toFixed(1)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Items In Fridge</p>
                <p className="text-xl sm:text-2xl font-black text-purple-600">{stats.totalItems}</p>
              </div>
            </div>

            <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl shadow-emerald-100">
                <h3 className="text-lg font-bold mb-1">Stock Activity</h3>
                <p className="text-emerald-100 text-sm mb-6">Log today's movements</p>
                <div className="flex gap-3">
                  <button onClick={() => { setTxType('in'); setIsTxModalOpen(true); }} className="flex-1 bg-white text-emerald-900 py-3 rounded-xl font-bold">Check In</button>
                  <button onClick={() => { setTxType('out'); setIsTxModalOpen(true); }} className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-bold">Distribute</button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <h4 className="font-bold mb-4 flex items-center gap-2"><Clock size={18} className="text-slate-400"/> Recent Team Activity</h4>
              {shifts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-xl">No shifts scheduled.</div>
              ) : (
                <div className="space-y-3">
                  {shifts.slice(0,3).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                          {volunteers.find(v => v.id === s.volId)?.name.charAt(0)}
                        </div>
                        <p className="text-sm font-bold">{volunteers.find(v => v.id === s.volId)?.name}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{s.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-bold">Current Inventory</h2>
              <div className="flex gap-2">
                <button onClick={() => openItemEditor()} className="text-xs font-bold text-slate-600 bg-white border px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <Plus size={12}/> New Item
                </button>
                <button onClick={() => { setTxType('adjust'); setIsTxModalOpen(true); }} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <RefreshCw size={12}/> Adjust Stock
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-4 font-bold text-slate-500 uppercase text-[10px]">Item</th>
                      <th className="p-4 font-bold text-center text-slate-500 uppercase text-[10px]">Stock</th>
                      <th className="p-4 text-right text-slate-500 uppercase text-[10px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventory.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category} • {item.weightLbs} lbs/{item.unit}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-black text-lg ${item.quantity <= 3 ? 'text-red-500' : 'text-emerald-600'}`}>{item.quantity}</span>
                          <span className="text-[10px] block text-slate-400 font-medium">{item.unit}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => openItemEditor(item)} className="p-2 text-slate-400"><Edit3 size={16} /></button>
                          <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'volunteers' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-bold">Volunteer Team</h2>
              <button onClick={() => setIsVolModalOpen(true)} className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <UserPlus size={14}/> Add Member
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {volunteers.map(v => (
                <div key={v.id} className="bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
                  <div className="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-400">{v.name.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-sm">{v.name}</p>
                    <p className="text-xs text-slate-500">{v.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIsShiftModalOpen(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-50">
              Schedule New Shift
            </button>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-2xl border shadow-sm p-6 text-center">
              <div className="mx-auto p-4 bg-emerald-50 rounded-full text-emerald-600 w-fit mb-4"><Share2 size={32} /></div>
              <h3 className="font-bold text-lg mb-2">Google Sheets Cloud</h3>
              <p className="text-xs text-slate-500 mb-6 max-w-xs mx-auto">
                Syncing directly to the Jami Fridge central database.
              </p>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-4 text-left border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Cloud Status</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Connected
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 break-all font-mono">
                  {APPS_SCRIPT_URL.substring(0, 50)}...
                </p>
              </div>

              <button 
                onClick={() => syncWithGoogleSheets()}
                disabled={isSyncing}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-xl disabled:opacity-50"
              >
                {isSyncing ? 'Synchronizing...' : 'Sync Data Now'}
              </button>
              
              {lastSync && (
                <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase">
                  Last successful sync: {lastSync}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tight">
              {txType === 'out' ? 'Distribute' : txType === 'in' ? 'Check In' : 'Adjust Stock'}
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Select Item</label>
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
                  <option value="">Choose item...</option>
                  {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} left)</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ({inventory.find(i=>i.id===selectedItem)?.unit || 'units'})</label>
                <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl text-2xl font-black text-emerald-600" value={txQty} onChange={(e) => setTxQty(e.target.value)} />
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsTxModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400">Cancel</button>
                <button onClick={handleTransaction} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl">Complete & Sync</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isItemEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-black mb-6">Item Settings</h3>
            <form onSubmit={saveItemDefinition} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Item Name</label>
                <input 
                  required 
                  placeholder="e.g. Red Apples" 
                  value={itemFormData.name} 
                  onChange={e => setItemFormData({...itemFormData, name: e.target.value})}
                  className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Category</label>
                  <select 
                    value={itemFormData.category} 
                    onChange={e => setItemFormData({...itemFormData, category: e.target.value})}
                    className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"
                  >
                    <option>Produce</option><option>Dairy</option><option>Pantry</option><option>Bakery</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Unit</label>
                  <input 
                    required 
                    placeholder="e.g. lbs, tray" 
                    value={itemFormData.unit} 
                    onChange={e => setItemFormData({...itemFormData, unit: e.target.value})}
                    onBlur={() => !itemFormData.weightLbs && estimateWeight(itemFormData.name, itemFormData.unit)}
                    className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Weight (Lbs per {itemFormData.unit || 'unit'})</label>
                <input 
                  step="0.1" 
                  required 
                  type="number" 
                  placeholder="0.0" 
                  value={itemFormData.weightLbs} 
                  onChange={e => setItemFormData({...itemFormData, weightLbs: e.target.value})}
                  className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-600" 
                />
                <button 
                  type="button"
                  onClick={() => estimateWeight(itemFormData.name, itemFormData.unit)}
                  disabled={isEstimating || !itemFormData.name || !itemFormData.unit}
                  className="absolute right-2 top-[34px] px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black flex items-center gap-1.5 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={12} className={isEstimating ? "animate-pulse" : ""} />
                  {isEstimating ? "Calculating..." : "AI Estimate"}
                </button>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsItemEditorOpen(false)} className="flex-1 py-4 font-bold text-slate-400">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg">Save Definition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVolModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-black mb-6">New Member</h3>
            <div className="space-y-4">
              <input placeholder="Full Name" className="w-full p-4 bg-slate-50 border rounded-2xl" value={newVol.name} onChange={e => setNewVol({...newVol, name: e.target.value})} />
              <input placeholder="Role" className="w-full p-4 bg-slate-50 border rounded-2xl" value={newVol.role} onChange={e => setNewVol({...newVol, role: e.target.value})} />
              <button onClick={addVolunteer} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl">Add to Team</button>
              <button onClick={() => setIsVolModalOpen(false)} className="w-full text-slate-400 text-xs font-bold pt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-black mb-6">Schedule Shift</h3>
            <div className="space-y-4">
              <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={newShift.volId} onChange={e => setNewShift({...newShift, volId: e.target.value})}>
                <option value="">-- Member --</option>
                {volunteers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input type="date" className="w-full p-4 bg-slate-50 border rounded-2xl" value={newShift.date} onChange={e => setNewShift({...newShift, date: e.target.value})} />
              <button onClick={addShift} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl">Save Shift</button>
              <button onClick={() => setIsShiftModalOpen(false)} className="w-full text-slate-400 text-xs font-bold pt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

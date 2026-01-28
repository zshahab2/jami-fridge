

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Calendar, 
  BarChart3, 
  Plus, 
  Minus, 
  RefreshCw, 
  Search,
  ChevronRight,
  Clock,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

// --- Mock Data Generators ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_INVENTORY = [
  { id: '1', name: 'Milk (Gallon)', category: 'Dairy', quantity: 8, unit: 'jugs', weightLbs: 8.6 },
  { id: '2', name: 'Eggs (Dozen)', category: 'Dairy', quantity: 12, unit: 'cartons', weightLbs: 1.5 },
  { id: '3', name: 'Bread Loaves', category: 'Bakery', quantity: 25, unit: 'loaves', weightLbs: 1.0 },
  { id: '4', name: 'Canned Beans', category: 'Pantry', quantity: 40, unit: 'cans', weightLbs: 0.9 },
  { id: '5', name: 'Apples', category: 'Produce', quantity: 30, unit: 'lbs', weightLbs: 1 },
];

const INITIAL_VOLUNTEERS = [
  { id: 'v1', name: 'Sarah Ahmed', phone: '555-0101', role: 'Coordinator' },
  { id: 'v2', name: 'Mike Chen', phone: '555-0102', role: 'Driver' },
  { id: 'v3', name: 'Fatima Jamil', phone: '555-0103', role: 'Distributor' },
];

const INITIAL_SHIFTS = [
  { id: 's1', volunteerId: 'v1', date: '2023-10-24', day: 'Tuesday', time: '6:00 PM - 7:00 PM', status: 'confirmed' },
  { id: 's2', volunteerId: 'v3', date: '2023-10-27', day: 'Friday', time: '6:00 PM - 7:00 PM', status: 'pending' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- Core State ---
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [transactions, setTransactions] = useState([]); // { id, type, itemId, itemName, qty, familiesServed, timestamp }
  const [volunteers, setVolunteers] = useState(INITIAL_VOLUNTEERS);
  const [shifts, setShifts] = useState(INITIAL_SHIFTS);

  // --- Modal States ---
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState('out'); // 'in', 'out', 'adjust'
  const [selectedItem, setSelectedItem] = useState('');
  const [txQty, setTxQty] = useState(1);
  const [txFamilies, setTxFamilies] = useState(1);
  
  // --- Volunteer Modal State ---
  const [isVolModalOpen, setIsVolModalOpen] = useState(false);
  const [newVolName, setNewVolName] = useState('');
  const [newVolPhone, setNewVolPhone] = useState('');

  // --- Shift Modal State ---
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState('');
  const [shiftVolId, setShiftVolId] = useState('');

  // --- Derived Stats ---
  const stats = useMemo(() => {
    const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
    
    // Filter transactions for "This Week" (Mock logic: just taking all for demo)
    const weeklyOut = transactions.filter(t => t.type === 'out');
    const familiesServed = weeklyOut.reduce((acc, curr) => acc + (curr.familiesServed || 0), 0);
    
    const lbsDistributed = weeklyOut.reduce((acc, curr) => {
      const item = inventory.find(i => i.id === curr.itemId) || { weightLbs: 1 }; // Fallback weight
      return acc + (curr.qty * item.weightLbs);
    }, 0);

    return { totalItems, familiesServed, lbsDistributed };
  }, [inventory, transactions]);

  // --- Handlers ---

  const handleTransaction = () => {
    if (!selectedItem || txQty <= 0) return;

    const itemIndex = inventory.findIndex(i => i.id === selectedItem);
    if (itemIndex === -1) return;

    const item = inventory[itemIndex];
    let newQty = item.quantity;

    if (txType === 'in') newQty += parseInt(txQty);
    if (txType === 'out') newQty -= parseInt(txQty);
    if (txType === 'adjust') newQty = parseInt(txQty);

    // Update Inventory
    const newInventory = [...inventory];
    newInventory[itemIndex] = { ...item, quantity: Math.max(0, newQty) };
    setInventory(newInventory);

    // Log Transaction
    const newTx = {
      id: generateId(),
      type: txType,
      itemId: item.id,
      itemName: item.name,
      qty: parseInt(txQty),
      familiesServed: txType === 'out' ? parseInt(txFamilies) : 0,
      timestamp: new Date().toISOString(),
      weightDistributed: txType === 'out' ? (parseInt(txQty) * item.weightLbs) : 0
    };
    setTransactions([newTx, ...transactions]);

    // Reset & Close
    setIsTxModalOpen(false);
    setTxQty(1);
    setTxFamilies(1);
  };

  const handleAddVolunteer = () => {
    if (!newVolName) return;
    const newVol = { id: generateId(), name: newVolName, phone: newVolPhone, role: 'Volunteer' };
    setVolunteers([...volunteers, newVol]);
    setIsVolModalOpen(false);
    setNewVolName('');
    setNewVolPhone('');
  };

  const handleAddShift = () => {
    if (!shiftDate || !shiftVolId) return;
    
    const dateObj = new Date(shiftDate);
    const dayNum = dateObj.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue...
    
    // Simple check for Tue(2), Fri(5), Sat(6)
    // Note: getUTCDay depends on timezone input, for this demo we assume input is local aligned
    // Ideally we use a library like date-fns for robust handling
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dateObj.getDay()];

    const isValidDay = [2, 5, 6].includes(dateObj.getDay());

    if (!isValidDay) {
      alert("We only operate on Tuesday, Friday, and Saturday!");
      return;
    }

    const newShift = {
      id: generateId(),
      volunteerId: shiftVolId,
      date: shiftDate,
      day: dayName,
      time: '6:00 PM - 7:00 PM',
      status: 'scheduled'
    };

    setShifts([...shifts, newShift]);
    setIsShiftModalOpen(false);
  };

  // --- Components ---

  const StatCard = ({ title, value, sub, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
        {sub && <p className="text-xs text-slate-400 mt-2">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  );

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
          ? 'bg-emerald-600 text-white shadow-md' 
          : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Package className="text-white" size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-800">Jami Fridge</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <TabButton id="dashboard" label="Overview" icon={LayoutDashboard} />
              <TabButton id="inventory" label="Inventory" icon={Package} />
              <TabButton id="schedule" label="Volunteers" icon={Users} />
              <TabButton id="reports" label="Reports" icon={BarChart3} />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Weekly Snapshot</h1>
              <p className="text-slate-500">Real-time metrics for the community fridge.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Current Stock" 
                value={stats.totalItems} 
                sub="Items across all categories"
                icon={Package} 
                color="bg-blue-500" 
              />
              <StatCard 
                title="Families Served" 
                value={stats.familiesServed} 
                sub="Since Monday"
                icon={Users} 
                color="bg-emerald-500" 
              />
              <StatCard 
                title="Impact" 
                value={`${stats.lbsDistributed.toFixed(1)} lbs`} 
                sub="Food distributed this week"
                icon={CheckCircle2} 
                color="bg-purple-500" 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quick Actions */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { setTxType('in'); setIsTxModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border-2 border-dashed border-emerald-200 hover:bg-emerald-100 transition-colors group"
                  >
                    <div className="bg-emerald-200 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="text-emerald-700" size={24} />
                    </div>
                    <span className="font-semibold text-emerald-800">Check In Items</span>
                    <span className="text-xs text-emerald-600 mt-1">Donations & Restock</span>
                  </button>

                  <button 
                    onClick={() => { setTxType('out'); setIsTxModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-6 bg-amber-50 rounded-xl border-2 border-dashed border-amber-200 hover:bg-amber-100 transition-colors group"
                  >
                    <div className="bg-amber-200 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                      <Minus className="text-amber-700" size={24} />
                    </div>
                    <span className="font-semibold text-amber-800">Distribute</span>
                    <span className="text-xs text-amber-600 mt-1">Track items going out</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                  {transactions.length === 0 && <p className="text-slate-400 text-sm italic">No activity yet.</p>}
                  {transactions.slice(0, 5).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${tx.type === 'in' ? 'bg-emerald-500' : tx.type === 'out' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{tx.itemName}</p>
                          <p className="text-xs text-slate-400">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${tx.type === 'in' ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {tx.type === 'in' ? '+' : tx.type === 'out' ? '-' : ''}{tx.qty}
                        </span>
                        {tx.type === 'out' && (
                          <p className="text-xs text-slate-400">{tx.familiesServed} fams</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY VIEW */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Live Inventory</h2>
                <p className="text-slate-500">Manage stock levels and weights.</p>
              </div>
              <button 
                onClick={() => { setTxType('adjust'); setIsTxModalOpen(true); }}
                className="text-sm flex items-center gap-2 text-slate-500 hover:text-slate-800 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm"
              >
                <RefreshCw size={14} />
                Reconcile / Adjust Count
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-center">In Stock</th>
                    <th className="p-4 text-center">Unit</th>
                    <th className="p-4 text-right">Est. Weight (lbs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{item.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-bold ${item.quantity < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-500 text-sm">{item.unit}</td>
                      <td className="p-4 text-right text-slate-500 text-sm">{(item.quantity * item.weightLbs).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCHEDULE VIEW */}
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Volunteer Hub</h2>
                <p className="text-slate-500">Manage shifts for Tue, Fri, Sat (6-7 PM).</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsVolModalOpen(true)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Add Volunteer
                </button>
                <button 
                  onClick={() => setIsShiftModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2"
                >
                  <Plus size={16} /> Schedule Shift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Upcoming Shifts */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                  <Calendar size={20} className="text-emerald-600"/> Upcoming Shifts
                </h3>
                {shifts.length === 0 ? (
                  <div className="p-8 bg-slate-100 rounded-xl text-center text-slate-500">No shifts scheduled.</div>
                ) : (
                  shifts.sort((a,b) => new Date(a.date) - new Date(b.date)).map(shift => {
                    const vol = volunteers.find(v => v.id === shift.volunteerId);
                    return (
                      <div key={shift.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-100 text-emerald-800 font-bold p-3 rounded-lg text-center min-w-[60px]">
                            <div className="text-xs uppercase">{shift.day.substring(0,3)}</div>
                            <div className="text-xl">{new Date(shift.date).getDate()}</div>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{vol ? vol.name : 'Unknown'}</h4>
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                              <Clock size={14} /> {shift.time}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          shift.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {shift.status}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Volunteer List */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Team Members</h3>
                <div className="space-y-3">
                  {volunteers.map(vol => (
                    <div key={vol.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {vol.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{vol.name}</p>
                          <p className="text-xs text-slate-400">{vol.phone}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS VIEW */}
        {activeTab === 'reports' && (
          <div className="space-y-8 animate-in fade-in">
            <header>
              <h2 className="text-2xl font-bold text-slate-800">Weekly Impact Report</h2>
              <p className="text-slate-500">Summary of distribution and reach.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl text-white shadow-lg">
                <p className="opacity-80 mb-2 font-medium">Total Distributed</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold">{stats.lbsDistributed.toFixed(1)}</h3>
                  <span className="text-emerald-100">lbs</span>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 mb-2 font-medium">Families Served</p>
                <h3 className="text-4xl font-bold text-slate-800">{stats.familiesServed}</h3>
                <p className="text-xs text-slate-400 mt-2">Unique interactions logged</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <p className="text-slate-500 mb-2 font-medium">Items Given Out</p>
                 <h3 className="text-4xl font-bold text-slate-800">
                   {transactions.filter(t => t.type === 'out').reduce((acc, c) => acc + c.qty, 0)}
                 </h3>
                 <p className="text-xs text-slate-400 mt-2">Individual units</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4">Distribution Log (Export Ready)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="pb-3">Time</th>
                      <th className="pb-3">Item</th>
                      <th className="pb-3 text-center">Type</th>
                      <th className="pb-3 text-right">Qty</th>
                      <th className="pb-3 text-right">Impact (lbs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="py-3 text-slate-500">{new Date(tx.timestamp).toLocaleString()}</td>
                        <td className="py-3 font-medium text-slate-800">{tx.itemName}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${
                            tx.type === 'out' ? 'bg-amber-100 text-amber-700' : 
                            tx.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 text-right">{tx.qty}</td>
                        <td className="py-3 text-right text-slate-500">{tx.weightDistributed ? tx.weightDistributed.toFixed(1) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* TRANSACTION MODAL */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4 capitalize">
              {txType === 'in' ? 'Check In Items' : txType === 'out' ? 'Distribute Items' : 'Adjust Inventory'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Item</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                >
                  <option value="">-- Choose Item --</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Cur: {i.quantity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {txType === 'adjust' ? 'New Total Quantity' : 'Quantity'}
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                  />
                </div>
                {txType === 'out' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Families Served</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={txFamilies}
                      onChange={(e) => setTxFamilies(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setIsTxModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleTransaction}
                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-transform active:scale-95 ${
                   txType === 'out' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOLUNTEER MODAL */}
      {isVolModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">Add New Volunteer</h3>
            <div className="space-y-4">
              <input 
                placeholder="Full Name"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={newVolName}
                onChange={(e) => setNewVolName(e.target.value)}
              />
              <input 
                placeholder="Phone / Contact"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                value={newVolPhone}
                onChange={(e) => setNewVolPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsVolModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleAddVolunteer} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT MODAL */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-2">Schedule Shift</h3>
            <p className="text-sm text-slate-500 mb-4">Operating Hours: Tue, Fri, Sat (6-7 PM)</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Volunteer</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  value={shiftVolId}
                  onChange={(e) => setShiftVolId(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {volunteers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  type="date"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsShiftModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleAddShift} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Schedule</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

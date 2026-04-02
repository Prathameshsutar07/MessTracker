import React, { useState, useEffect } from 'react';
import { getDashboardData, today } from '../../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function DashboardTab({ onToast }) {
  const [startDate, setStartDate] = useState(() => {
     const d = new Date();
     d.setMonth(d.getMonth() - 1);
     return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      // Validate 1 month limit
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > 31) {
         onToast("Date range cannot exceed 31 days (1 month)", "err");
         return;
      }
      if (d1 > d2) {
         onToast("Start date must be before end date", "err");
         return;
      }

      setLoading(true);
      try {
        const res = await getDashboardData(startDate, endDate);
        setData(res);
      } catch (err) {
        onToast('Failed to load data: ' + err.message, 'err');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [startDate, endDate, onToast]);

  const generatePDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Mess Tracker Report", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 30);

    const totalRevenue = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const lunchCount = data.entries.filter(e => e.meal === 'lunch').length;
    const dinnerCount = data.entries.filter(e => e.meal === 'dinner').length;

    doc.text(`Summary:`, 14, 40);
    doc.setFontSize(10);
    doc.text(`Total Collections: Rs. ${totalRevenue}`, 14, 48);
    doc.text(`New Customers: ${data.customers.length}`, 14, 54);
    doc.text(`Lunches Served: ${lunchCount}`, 14, 60);
    doc.text(`Dinners Served: ${dinnerCount}`, 14, 66);

    let startY = 76;

    if (data.payments.length > 0) {
      doc.setFontSize(14);
      doc.text("Payments Collected", 14, startY);
      doc.autoTable({
        startY: startY + 4,
        head: [['Date', 'Customer', 'Method', 'Amount']],
        body: data.payments.map(p => [p.date, p.customerName || '—', p.method, `Rs. ${p.amount}`]),
      });
      startY = doc.lastAutoTable.finalY + 14;
    }

    if (data.entries.length > 0) {
      doc.setFontSize(14);
      doc.text("Meals Served", 14, startY);
      doc.autoTable({
        startY: startY + 4,
        head: [['Date', 'Meal', 'Customer']],
        body: data.entries.map(e => [e.date, e.meal, e.customerName || '—']),
      });
      startY = doc.lastAutoTable.finalY + 14;
    }

    if (data.customers.length > 0) {
       doc.setFontSize(14);
       doc.text("New Customers Registered", 14, startY);
       doc.autoTable({
         startY: startY + 4,
         head: [['Date', 'Name', 'Mobile', 'Plan Amount']],
         body: data.customers.map(c => [c.createdAt, c.name, c.mobile, `Rs. ${c.paymentAmount}`]),
       });
    }

    doc.save(`Mess_Report_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="px-4 mb-4 flex flex-col gap-3">
         <div className="bg-[#18181c] border border-[#2e2e38] p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2">
               <label className="text-[12px] text-[#8a8a9a] font-semibold uppercase">From</label>
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={(e) => setStartDate(e.target.value)}
                 className="bg-[#222228] text-white border border-[#2e2e38] rounded-lg px-3 py-2 outline-none focus:border-[#f0c040]"
               />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-[12px] text-[#8a8a9a] font-semibold uppercase">To</label>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={(e) => setEndDate(e.target.value)}
                 className="bg-[#222228] text-white border border-[#2e2e38] rounded-lg px-3 py-2 outline-none focus:border-[#f0c040]"
               />
            </div>
            <button 
               onClick={generatePDF}
               disabled={!data || loading}
               className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50"
            >
               Generate Report (PDF)
            </button>
         </div>
      </div>

      {loading && (
        <div className="flex justify-center p-8 gap-2">
           <Spinner /> Loading Dashboard...
        </div>
      )}

      {data && !loading && (
        <div className="px-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <StatCard title="Revenue" value={`₹${data.payments.reduce((s,p) => s+p.amount, 0)}`} color="text-green-400" />
             <StatCard title="New Customers" value={data.customers.length} color="text-blue-400" />
             <StatCard title="Lunches" value={data.entries.filter(e => e.meal === 'lunch').length} color="text-[#f0c040]" />
             <StatCard title="Dinners" value={data.entries.filter(e => e.meal === 'dinner').length} color="text-[#e8794a]" />
           </div>

           <div className="mt-6 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-[#f0ede8]">Recent Payments</h2>
              <div className="bg-[#18181c] rounded-xl border border-[#2e2e38] overflow-hidden">
                 {data.payments.length === 0 ? (
                    <div className="p-4 text-center text-[#8a8a9a] text-[13px]">No payments in this range</div>
                 ) : (
                    <table className="w-full text-left text-[13px]">
                       <thead className="bg-[#222228] text-[#8a8a9a] uppercase text-[10px]">
                          <tr>
                             <th className="px-4 py-2 font-medium">Date</th>
                             <th className="px-4 py-2 font-medium">Customer</th>
                             <th className="px-4 py-2 font-medium text-right">Amount</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[#2e2e38]">
                          {data.payments.slice(0, 10).map((p, i) => (
                             <tr key={i} className="hover:bg-[#222228]/50">
                                <td className="px-4 py-3">{p.date}</td>
                                <td className="px-4 py-3">{p.customerName || 'Unknown'}</td>
                                <td className="px-4 py-3 text-right font-semibold text-green-400">₹{p.amount}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl px-4 py-4 text-center">
      <p className="text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-2xl font-bold overflow-hidden text-ellipsis ${color}`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5 text-[#8a8a9a]" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../utils/firebase";
import { getHotels, addHotel, updateHotel } from "../../utils/api";

export default function AdminDashboard({ onToast }) {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [form, setForm] = useState({
    hotelName: "", email: "", password: "", expiryDays: 45,
  });
  const [plans, setPlans] = useState([{ meals: 30, price: 1500 }]);
  const [isSaving, setIsSaving] = useState(false);

  const loadHotels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHotels();
      setHotels(data);
    } catch (err) {
      console.error(err);
      if (onToast) onToast("Failed to load hotels", "err");
      else alert("Failed to load hotels: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAddPlan = () => {
    setPlans([...plans, { meals: 60, price: 2800 }]);
  };

  const updatePlan = (index, key, val) => {
    const newPlans = [...plans];
    newPlans[index][key] = Number(val);
    setPlans(newPlans);
  };

  const removePlan = (index) => {
    setPlans(plans.filter((_, i) => i !== index));
  };

  const handleEdit = (h) => {
    setEditingHotel(h);
    setForm({
      hotelName: h.hotelName || "",
      email: h.email || "",
      password: h.password || "",
      expiryDays: h.expiryDays || 45,
    });
    setPlans(h.plans && h.plans.length > 0 ? h.plans : [{ meals: 30, price: 1500 }]);
    setAdding(true);
  };

  const closeForm = () => {
    setAdding(false);
    setEditingHotel(null);
    setForm({ hotelName: "", email: "", password: "", expiryDays: 45 });
    setPlans([{ meals: 30, price: 1500 }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.hotelName || !form.email || !form.password) return;
    setIsSaving(true);
    try {
      if (editingHotel) {
        const res = await updateHotel(editingHotel.id, editingHotel.email, editingHotel.password, { ...form, plans });
        if (res === "AUTH_SKIPPED") {
          const msg = "Profile updated! However, Auth credentials were not updated since the system doesn't have their original password on file. Please reset their password in the Firebase Console if needed.";
          if (onToast) onToast(msg, "warn");
          else alert(msg);
        } else {
          if (onToast) onToast("Hotel updated successfully!", "ok");
          else alert("Hotel updated successfully!");
        }
      } else {
        await addHotel({ ...form, plans });
        if (onToast) onToast("Hotel added successfully!", "ok");
        else alert("Hotel added successfully!");
      }
      closeForm();
      loadHotels();
    } catch (err) {
      if (onToast) onToast(err.message, "err");
      else alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white p-4">
      <div className="flex items-center justify-between mb-8">
        <div className="text-[22px] font-semibold tracking-tight">
          <span className="text-[#f0c040]">Super</span>Admin
        </div>
        <button
          onClick={handleLogout}
          className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-yellow-600 transition"
        >
          Logout
        </button>
      </div>

      {!adding ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Manage Hotels (SaaS Tenants)</h1>
            <button
              onClick={() => {
                setEditingHotel(null);
                setAdding(true);
                setForm({ hotelName: "", email: "", password: "", expiryDays: 45 });
                setPlans([{ meals: 30, price: 1500 }]);
              }}
              className="bg-[#f0c040] text-black px-4 py-2 rounded-lg font-bold"
            >
              + Add Hotel
            </button>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotels.map((h) => (
                <div key={h.id} className="bg-[#18181c] border border-[#2e2e38] p-4 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-[#f0ede8]">{h.hotelName}</h2>
                      <p className="text-sm text-gray-400 mb-2">{h.email}</p>
                    </div>
                    <button onClick={() => handleEdit(h)} className="text-xs bg-[#2e2e38] px-3 py-1 rounded-md text-gray-300 hover:text-white hover:bg-[#3e3e48] transition">Edit</button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Expiry: {h.expiryDays} days</p>
                  <div className="space-y-1">
                    {h.plans?.map((p, i) => (
                      <div key={i} className="text-xs bg-[#222228] p-2 rounded flex justify-between">
                        <span>{p.meals} Meals</span>
                        <span className="text-[#f0c040]">₹{p.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {hotels.length === 0 && <p className="text-gray-400">No hotels added yet.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-[#18181c] p-6 rounded-xl border border-[#2e2e38]">
          <h2 className="text-xl font-bold mb-4">{editingHotel ? "Edit Hotel" : "Add New Hotel"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Hotel Name</label>
              <input required className="w-full bg-[#222228] border border-[#2e2e38] rounded-lg p-2 text-white outline-none focus:border-[#f0c040]"
                value={form.hotelName} onChange={e => setForm({ ...form, hotelName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Login Email</label>
              <input type="email" required className="w-full bg-[#222228] border border-[#2e2e38] rounded-lg p-2 text-white outline-none focus:border-[#f0c040]"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Login Password</label>
              <input type="password" required minLength={6} className="w-full bg-[#222228] border border-[#2e2e38] rounded-lg p-2 text-white outline-none focus:border-[#f0c040]"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Plan Expiry (Days)</label>
              <input type="number" required min={1} className="w-full bg-[#222228] border border-[#2e2e38] rounded-lg p-2 text-white outline-none focus:border-[#f0c040]"
                value={form.expiryDays} onChange={e => setForm({ ...form, expiryDays: Number(e.target.value) })} />
            </div>

            <div className="border border-[#2e2e38] p-4 rounded-lg bg-[#0f0f11]">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-xs uppercase tracking-wider text-gray-400">Subscription Plans</label>
                <button type="button" onClick={handleAddPlan} className="text-xs bg-[#f0c040]/20 text-[#f0c040] px-2 py-1 rounded hover:bg-[#f0c040]/30">+ Add Plan</button>
              </div>
              {plans.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2 items-center">
                  <input type="number" placeholder="Meals" className="w-1/3 bg-[#222228] border border-[#2e2e38] rounded p-2 text-white text-sm outline-none"
                    value={p.meals} onChange={e => updatePlan(i, 'meals', e.target.value)} required />
                  <input type="number" placeholder="Price (₹)" className="w-1/3 bg-[#222228] border border-[#2e2e38] rounded p-2 text-white text-sm outline-none"
                    value={p.price} onChange={e => updatePlan(i, 'price', e.target.value)} required />
                  {plans.length > 1 && (
                    <button type="button" onClick={() => removePlan(i)} className="text-red-400 text-sm p-2">✕</button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={closeForm} className="flex-1 py-3 rounded-lg bg-[#222228] text-gray-400 border border-[#2e2e38]">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex-1 py-3 rounded-lg bg-[#f0c040] text-black font-bold disabled:opacity-50">
                {isSaving ? "Saving..." : editingHotel ? "Update Hotel" : "Save Hotel"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

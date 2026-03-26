import React, { useState } from 'react'
import { FaPlusCircle } from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import { FaList } from "react-icons/fa6";
import AddCustomer from './AddCustomer';
import CustomersTab from './CustomersTab';
import ScanTab from './SacnTab';
import Toast from './Toast';
import { signOut } from "firebase/auth";
import { auth } from "../../utils/firebase";

function MainPage() {
  const [active, setActive] = useState("add");
  const [toast, setToast] = useState(null)

  const handleToast = (msg, type) => {
    setToast({ msg, type })
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Logged out");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className='bg-black min-h-screen text-white'>

      {/* 🔥 App Name
      <div className='text-center py-4 text-xl  tracking-wide border-b border-gray-800 font-Nunito'>
        Mess Tracker
      </div> */}
      <div className="flex items-center justify-between p-4">

        {/* Logo */}
        <div className="text-[22px] font-semibold tracking-tight">
          <span className="text-[#f0c040]">Mess</span>Track
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition"
        >
          Logout
        </button>

      </div>

      {/* 🔥 Navbar */}
      <nav className="  fixed bottom-0 left-0 w-full z-50  bg-[#0f172a] border-t border-gray-800  md:static md:border-none">
        <ul className="flex justify-around items-center text-xs md:text-base font-medium py-3 md:py-4">

          <li
            onClick={() => setActive("add")}
            className={`flex flex-col items-center gap-1 cursor-pointer transition
        ${active === "add"
                ? "text-yellow-400"
                : "text-gray-400 hover:text-white"}`}
          >
            <FaPlusCircle className="text-lg md:text-xl" />
            <span>ADD</span>
          </li>

          <li
            onClick={() => setActive("scan")}
            className={`flex flex-col items-center gap-1 cursor-pointer transition
        ${active === "scan"
                ? "text-yellow-400"
                : "text-gray-400 hover:text-white"}`}
          >
            <MdOutlineQrCodeScanner className="text-lg md:text-xl" />
            <span>SCAN</span>
          </li>

          <li
            onClick={() => setActive("customers")}
            className={`flex flex-col items-center gap-1 cursor-pointer transition
        ${active === "customers"
                ? "text-yellow-400"
                : "text-gray-400 hover:text-white"}`}
          >
            <FaList className="text-lg md:text-xl" />
            <span>CUSTOMERS</span>
          </li>

        </ul>
      </nav>
      <div className='p-4'>
        {active === "add" && <AddCustomer onToast={handleToast} />}
        {active === "scan" && <ScanTab onToast={handleToast} />}
        {active === "customers" && <CustomersTab onToast={handleToast} />}
      </div>

      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

    </div>
  )
}

export default MainPage
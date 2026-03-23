import React, { useState } from 'react'
import { FaPlusCircle } from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import { FaList } from "react-icons/fa6";
import AddCustomer from './AddCustomer';
import CustomersTab from './CustomersTab';
import ScanTab from './SacnTab';
import Toast from './Toast';

function MainPage() {
  const [active, setActive] = useState("add");
  const [toast, setToast]   = useState(null)

  const handleToast = (msg, type) => {
    setToast({ msg, type })
  }

  return (
    <div className='bg-black min-h-screen text-white'>

      {/* 🔥 App Name
      <div className='text-center py-4 text-xl  tracking-wide border-b border-gray-800 font-Nunito'>
        Mess Tracker
      </div> */}

      {/* 🔥 Navbar */}
      <nav className='bg-[#0f172a]'>
        <ul className='flex justify-around items-center text-sm md:text-base font-medium py-4'>

          <li 
            onClick={() => setActive("add")}
            className={`flex flex-col items-center gap-1 cursor-pointer pb-2 border-b-2 transition
              ${active === "add" 
                ? "text-yellow-400 border-yellow-400" 
                : "text-gray-400 border-transparent hover:text-white"}`}
          >
            <FaPlusCircle className='text-xl' />
            <span>ADD</span>
          </li>

          <li 
            onClick={() => setActive("scan")}
            className={`flex flex-col items-center gap-1 cursor-pointer pb-2 border-b-2 transition
              ${active === "scan" 
                ? "text-yellow-400 border-yellow-400" 
                : "text-gray-400 border-transparent hover:text-white"}`}
          >
            <MdOutlineQrCodeScanner className='text-xl' />
            <span>SCAN</span>
          </li>

          <li 
            onClick={() => setActive("customers")}
            className={`flex flex-col items-center gap-1 cursor-pointer pb-2 border-b-2 transition
              ${active === "customers" 
                ? "text-yellow-400 border-yellow-400" 
                : "text-gray-400 border-transparent hover:text-white"}`}
          >
            <FaList className='text-xl' />
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
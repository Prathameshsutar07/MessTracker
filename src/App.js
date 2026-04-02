import React, { useEffect, useState } from "react";
import MainPage from "./component/layout/MainPage";
import Login from "./component/layout/Login";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import CustomerDashboard from "./component/layout/CustomerDashboard";
import AdminDashboard from "./component/layout/AdminDashboard";
import { getHotelConfig, setHotelContext } from "./utils/api";

const ADMIN_EMAIL = 'admin@test1.com';

function App({ onToast }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let logoutTimer;
    const resetTimer = () => {
      clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        signOut(auth);
        onToast("Session expired. Logged out automatically.");
      }, 2 * 60 * 60 * 1000);
    };

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (u.email === ADMIN_EMAIL) {
          setIsAdmin(true);
          setUser(u);
          setLoading(false);
          resetTimer();
          window.addEventListener("click", resetTimer);
          window.addEventListener("keypress", resetTimer);
        } else {
          setIsAdmin(false);
          const config = await getHotelConfig(u.uid);
          if (config) {
            setHotelContext(u.uid, config);
            setUser(u);
            resetTimer();
            window.addEventListener("click", resetTimer);
            window.addEventListener("keypress", resetTimer);
          } else {
            signOut(auth);
            setUser(null);
            if (onToast) onToast("Access Denied. You are not a registered hotel.", "err");
            else alert("Access Denied. You are not a registered hotel.");
          }
          setLoading(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setHotelContext(null, null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("keypress", resetTimer);
    };
  }, [onToast]);

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <Router>
      <Routes>

        {/* Redirect Root to user login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* User Login Page */}
        <Route
          path="/login"
          element={!user ? <Login onLogin={() => { }} adminMode={false} /> : <Navigate to={isAdmin ? "/admin" : "/main"} replace />}
        />

        {/* Admin Login Page */}
        <Route
          path="/admin/login"
          element={!user ? <Login onLogin={() => { }} adminMode={true} /> : <Navigate to={isAdmin ? "/admin" : "/main"} replace />}
        />

        {/* Admin Route */}
        <Route
          path="/admin"
          element={user && isAdmin ? <AdminDashboard onToast={onToast} /> : <Navigate to="/" />}
        />

        {/* Protected Route for Hotels */}
        <Route
          path="/main"
          element={user && !isAdmin ? <MainPage /> : <Navigate to="/" />}
        />

        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/dashboard/:customerId" element={<CustomerDashboard />} />


      </Routes>
    </Router>
  );
}

export default App;
import React, { useEffect, useState } from "react";
import MainPage from "./component/layout/MainPage";
import Login from "./component/layout/Login";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./utils/firebase";
import { onAuthStateChanged ,signOut} from "firebase/auth";
import Toast from "./component/layout/Toast";

function App({onToast}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  let logoutTimer;

  const resetTimer=()=>{
    clearTimeout(logoutTimer);

    logoutTimer=setTimeout(()=>{

      signOut(auth);
       onToast("Session expired. Logged out automatically.");
    },2 * 60 * 60 * 1000);
  
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
       if (u) {
        resetTimer();

        // Track user activity
        window.addEventListener("click", resetTimer);
        window.addEventListener("keypress", resetTimer);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <Router>
      <Routes>

        {/* Login Page */}
        <Route
          path="/"
          element={!user ? <Login onLogin={setUser} /> : <Navigate to="/main" />}
        />

        {/* Protected Route */}
        <Route
          path="/main"
          element={user ? <MainPage /> : <Navigate to="/" />}
        />

      </Routes>
    </Router>
  );
}

export default App;
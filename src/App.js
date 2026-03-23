import React from 'react'
import MainPage from './component/layout/MainPage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/main" element={<MainPage />} />
      </Routes>
    </Router>
  );
}

export default App;

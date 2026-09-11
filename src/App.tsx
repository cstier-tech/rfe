import { Routes, Route } from 'react-router-dom'

import Nav from '@/components/Nav'
import RfeForm from './pages/RfeForm'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<RfeForm />} />
        <Route path="/rfe/:rfeId/:mode" element={<RfeForm />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  )
}

export default App

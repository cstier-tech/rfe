import { Routes, Route, useLocation } from 'react-router-dom'

import Nav from '@/components/Nav'
import RfeForm from './pages/RfeForm'
import RfeView from './pages/RfeView'
import Dashboard from './pages/Dashboard'

function App() {
  // "/" and "/rfe/:rfeId/:mode" both render RfeForm, so navigating between
  // them (e.g. new -> edit, or edit -> new via the Nav link) would otherwise
  // reuse the same component instance rather than remounting it — leaving
  // stale state in any child input that keeps its own local state (like the
  // date picker's typed text) instead of purely mirroring form values. Keying
  // by pathname forces a clean remount whenever the RFE/mode actually changes
  // (stepping through the wizard doesn't touch the URL, so it doesn't
  // trigger this).
  const { pathname } = useLocation()

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<RfeForm key={pathname} />} />
        {/* Static "view" segment ranks above the dynamic :mode route below,
            so this one wins for that exact path. Not linked from Nav —
            reachable only via the dashboard's Actions menu. */}
        <Route path="/rfe/:rfeId/view" element={<RfeView />} />
        <Route path="/rfe/:rfeId/:mode" element={<RfeForm key={pathname} />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  )
}

export default App

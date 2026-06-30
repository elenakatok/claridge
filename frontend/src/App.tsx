import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { auth, functions } from './firebase'
import Play from './pages/Play'
import InstructorDashboard from './pages/InstructorDashboard'
import Configure from './pages/Configure'
import Reports from './pages/Reports'
import { SettingsPage } from '@mygames/game-ui'

const claridgeRoleLabels: Record<string, string> = {
  claridge: 'Claridge',
  tolemite: 'Tolemite',
  bard:     'BARD',
}

const claridgeInfoLinks = [
  { roleKey: 'claridge', links: [
    { key: 'claridge_sheet_url', label: 'Case document' },
  ]},
  { roleKey: 'tolemite', links: [
    { key: 'tolemite_sheet_url', label: 'Case document' },
  ]},
  { roleKey: 'bard', links: [
    { key: 'bard_sheet_url', label: 'Case document' },
  ]},
]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Play />} />
        <Route path="/dashboard" element={<InstructorDashboard />} />
        <Route path="/configure" element={<Configure />} />
        <Route path="/reports"   element={<Reports />} />
        <Route path="/settings"  element={
          <SettingsPage
            title="Settings — Claridge"
            functions={functions}
            auth={auth}
            roleLabels={claridgeRoleLabels}
            roleInfoLinks={claridgeInfoLinks}
          />
        } />
      </Routes>
    </BrowserRouter>
  )
}

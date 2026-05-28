import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Pages
import Home from './pages/Home'
import Auth from './pages/Auth'
import Orcamento from './pages/Orcamento'
import Contrato from './pages/Contrato'
import Biometria from './pages/Biometria'
import PortalPrestador from './pages/PortalPrestador'
import PortalContratante from './pages/PortalContratante'
import Admin from './pages/Admin'

// Auth guard
const PrivateRoute = ({ children, tipo }) => {
  const key = tipo === 'prestador' ? 'ss_prestador' : 
               tipo === 'contratante' ? 'ss_contratante' : 
               tipo === 'admin' ? 'ss_admin' : null
  
  if (key && !localStorage.getItem(key)) {
    return <Navigate to="/auth" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/orcamento" element={<Orcamento />} />
        <Route path="/contrato" element={<Contrato />} />
        <Route path="/biometria" element={<Biometria />} />

        {/* Prestador */}
        <Route path="/prestador/*" element={
          <PrivateRoute tipo="prestador">
            <PortalPrestador />
          </PrivateRoute>
        } />

        {/* Contratante */}
        <Route path="/contratante/*" element={
          <PrivateRoute tipo="contratante">
            <PortalContratante />
          </PrivateRoute>
        } />

        {/* Admin */}
        <Route path="/admin/*" element={<Admin />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { initMercadoPago } from '@mercadopago/sdk-react'

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: 'es-CO' })

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import WhatsAppButton from './components/WhatsAppButton'

import Home from './pages/Home'
import Catalog from './pages/Catalog'
import ProductPage from './pages/ProductPage'
import Confirmacion from './pages/Confirmacion'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import ReturnsPolicy from './pages/ReturnsPolicy'

function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <WhatsAppButton />
      <Routes>
        {/* Rutas públicas con Navbar + Footer */}
        <Route path="/" element={
          <>
            <Navbar />
            <Home />
            <Footer />
          </>
        } />
        <Route path="/catalogo" element={
          <>
            <Navbar />
            <Catalog />
            <Footer />
          </>
        } />

        <Route path="/catalogo/:id" element={
          <>
            <Navbar />
            <ProductPage />
            <Footer />
          </>
        } />

        <Route path="/confirmacion" element={
          <>
            <Navbar />
            <Confirmacion />
            <Footer />
          </>
        } />

        {/* Páginas legales */}
        <Route path="/politica-de-privacidad" element={<><Navbar /><PrivacyPolicy /><Footer /></>} />
        <Route path="/terminos-de-servicio" element={<><Navbar /><TermsOfService /><Footer /></>} />
        <Route path="/politica-de-devoluciones" element={<><Navbar /><ReturnsPolicy /><Footer /></>} />

        {/* Admin — sin Navbar pública */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  )
}

export default App

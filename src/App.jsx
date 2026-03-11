import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { initMercadoPago } from '@mercadopago/sdk-react'

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: 'es-CO' })

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// Componentes que siempre se cargan (layout)
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import WhatsAppButton from './components/WhatsAppButton'

// Lazy-loaded pages
const Home          = lazy(() => import('./pages/Home'))
const Catalog       = lazy(() => import('./pages/Catalog'))
const ProductPage   = lazy(() => import('./pages/ProductPage'))
const Confirmacion  = lazy(() => import('./pages/Confirmacion'))
const Login         = lazy(() => import('./pages/admin/Login'))
const Dashboard     = lazy(() => import('./pages/admin/Dashboard'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const ReturnsPolicy = lazy(() => import('./pages/ReturnsPolicy'))

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="page-spinner" />
  </div>
)

function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <WhatsAppButton />
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </div>
  )
}

export default App

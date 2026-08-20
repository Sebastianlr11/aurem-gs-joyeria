import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { initMercadoPago } from '@mercadopago/sdk-react'
import { iniciarPixeles, pixelPagina } from './lib/pixeles'
import { capturarClic } from './lib/atribucion'

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
const ResetPassword = lazy(() => import('./pages/admin/ResetPassword'))
const Dashboard     = lazy(() => import('./pages/admin/Dashboard'))
const ChatPanel     = lazy(() => import('./pages/admin/ChatPanel'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const ReturnsPolicy = lazy(() => import('./pages/ReturnsPolicy'))
const RingSizeGuide = lazy(() => import('./pages/RingSizeGuide'))

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="page-spinner" />
  </div>
)

/* Cuenta una vista por cada cambio de ruta. En una app de una sola página
   el píxel no se entera solo: sin esto, sólo contaría la primera. */
function ContadorDePaginas() {
  const { pathname } = useLocation();
  useEffect(() => { pixelPagina(); }, [pathname]);
  return null;
}

function App() {
  /* El clic se captura antes de cargar los píxeles: el identificador viene
     en la URL de esta visita y hay que guardarlo aunque la compra sea otro
     día. */
  useEffect(() => { capturarClic(); iniciarPixeles(); }, []);

  return (
    <div className="app">
      <ScrollToTop />
      <ContadorDePaginas />
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

          {/* La ficha va sin navbar: es la pantalla donde se decide la
              compra y la píldora de navegación le quitaba sitio a la pieza
              sin ofrecer nada que haga falta ahí. El camino de vuelta es el
              botón "Volver al catálogo" sobre la foto. */}
          <Route path="/catalogo/:id" element={
            <>
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
          <Route path="/guia-de-tallas" element={<><Navbar /><RingSizeGuide /><Footer /></>} />

          {/* Admin — sin Navbar pública */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/chat" element={
            <ProtectedRoute>
              <ChatPanel />
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App

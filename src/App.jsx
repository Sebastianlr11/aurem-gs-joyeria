import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { iniciarPixeles, pixelPagina } from './lib/pixeles'
import { capturarClic } from './lib/atribucion'


/* Los píxeles arrancan aquí, al evaluar el módulo, y no dentro de un efecto
   de App.

   React ejecuta los efectos de los hijos ANTES que los del padre. Con la
   carga metida en el efecto de App, <ContadorDePaginas /> llamaba a
   pixelPagina() cuando window.fbq y window.ttq todavía no existían: la
   llamada se descartaba en silencio y la primera vista de cada carga de
   página se perdía, en Meta y en TikTok a la vez. Sólo se contaban las
   vistas de los cambios de ruta posteriores, y las páginas a las que se
   entra directo —/confirmacion viniendo de Mercado Pago, una pieza abierta
   desde un anuncio— no contaban ninguna.

   Acá no hay orden que respetar: las dos funciones se protegen solas si no
   hay window, e iniciarPixeles() es idempotente.

   El clic va primero porque el identificador viene en la URL de esta visita
   y hay que guardarlo aunque la compra sea otro día. */
capturarClic()
iniciarPixeles()

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// Componentes que siempre se cargan (layout)
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'

// Lazy-loaded pages
/* ProtectedRoute va aquí abajo y no arriba con Navbar y Footer, aunque no sea
   una página. Importa: **arrastra el cliente entero de Supabase** —auth,
   realtime, storage, postgrest— y sólo lo usan las dos rutas de /admin.
   Importado de forma normal, cada visitante de la portada se bajaba unos
   120 KB para no usarlos, y la portada no consulta la base ni una vez. */
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'))

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
const NoEncontrado  = lazy(() => import('./pages/NoEncontrado'))

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

          {/* Va la última, y con Navbar y Footer como cualquier página pública:
              quien cae aquí llegó por un enlace roto y lo que necesita es poder
              seguir navegando, no un callejón. Sin esta ruta, una URL inválida
              renderizaba la página en blanco. */}
          <Route path="*" element={
            <>
              <Navbar />
              <NoEncontrado />
              <Footer />
            </>
          } />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App

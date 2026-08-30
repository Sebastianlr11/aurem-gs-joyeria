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

/* La portada NO va perezosa, y es la única página que no lo va.

   Medido el 30 de agosto de 2026: en 4G lenta la ruta `/` costaba un viaje de
   red entero de más, y en serie —bajar el bundle, ejecutarlo, recién ahí pedir
   `Home-*.js`, esperarlo, ejecutarlo, y sólo entonces pintar—. Son unos 250 ms
   en los que la pantalla está en blanco, en la ruta que recibe casi todo el
   tráfico y a la que se llega desde un anuncio.

   El precio son 9,3 KB comprimidos que ahora se baja también quien entra
   directo a /admin o al catálogo. Es un mal canje sólo para ellos, y ellos son
   el joyero y una minoría; la portada es la puerta. */
import Home from './pages/Home'

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

/* El armazón de las páginas públicas: navbar arriba, pie abajo, y la página
   en medio.
   
   Existe por una medida concreta. El elemento LCP de la portada es el texto
   del logo del navbar —no la foto—, y Lighthouse lo desglosaba así:
   
       TTFB 696 ms · descarga 0 ms · **espera a renderizar 4.771 ms**
   
   Casi cinco segundos esperando, sin nada que bajar. El motivo era que
   `<Navbar />` vivía DENTRO del mismo `<Suspense>` que la página perezosa:
   aunque el navbar estuviera listo desde el primer instante, React no pintaba
   nada de ese bloque hasta que bajaba y se ejecutaba el chunk de la página.
   
   Con el Suspense aquí dentro, envolviendo sólo a la página, el armazón se
   pinta en cuanto corre el bundle y el contenido llega después.
   
   El hueco del cargador reserva 60vh a propósito: sin esa altura el pie
   nacería pegado al navbar y saltaría hacia abajo al llegar la página, y eso
   es layout shift — la única métrica que ya estaba en cero perfecto. */
const ConNavbar = ({ children }) => (
  <>
    <Navbar />
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
    <Footer />
  </>
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
          <Route path="/" element={<ConNavbar><Home /></ConNavbar>} />
          <Route path="/catalogo" element={<ConNavbar><Catalog /></ConNavbar>} />

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

          <Route path="/confirmacion" element={<ConNavbar><Confirmacion /></ConNavbar>} />

          {/* Páginas legales */}
          <Route path="/politica-de-privacidad" element={<ConNavbar><PrivacyPolicy /></ConNavbar>} />
          <Route path="/terminos-de-servicio" element={<ConNavbar><TermsOfService /></ConNavbar>} />
          <Route path="/politica-de-devoluciones" element={<ConNavbar><ReturnsPolicy /></ConNavbar>} />
          <Route path="/guia-de-tallas" element={<ConNavbar><RingSizeGuide /></ConNavbar>} />

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
          <Route path="*" element={<ConNavbar><NoEncontrado /></ConNavbar>} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App

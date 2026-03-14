# 💎 Aurem GS — E-commerce de Joyeria Artesanal

Plataforma e-commerce completa para una joyeria artesanal. Incluye catalogo de productos, carrito de compras, pasarela de pagos con Mercado Pago, guia de tallas, y un panel de administracion con dashboard, gestion de pedidos y chat en tiempo real con clientes via WhatsApp.

---

## ✨ Features

- 🛍️ **Catalogo de productos** — Colecciones, categorias, paginas de producto con galeria de imagenes
- 🛒 **Carrito de compras** — Agregar, eliminar, seleccionar tallas y cantidades
- 💳 **Pagos con Mercado Pago** — Checkout integrado con SDK oficial
- 📏 **Guia de tallas de anillos** — Herramienta interactiva para el cliente
- 📱 **Diseño responsive** — Optimizado para movil y escritorio
- 🎨 **Animaciones fluidas** — Transiciones y efectos con Framer Motion
- 🔐 **Panel de administracion** — Login protegido con autenticacion Supabase
- 📊 **Dashboard** — Metricas de ventas, pedidos y clientes
- 💬 **Chat en tiempo real** — Comunicacion directa con clientes de WhatsApp
- 📦 **Gestion de pedidos** — Estados, tracking, notificaciones
- 📄 **Paginas legales** — Politica de privacidad, devoluciones, terminos de servicio
- ❓ **FAQ y contacto** — Seccion de preguntas frecuentes y formulario

---

## 🛠️ Stack

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Mercado Pago](https://img.shields.io/badge/Mercado_Pago-00B1EA?style=flat-square&logo=mercadopago&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

---

## 📁 Estructura del Proyecto

```
src/
├── pages/
│   ├── Home.jsx              # Landing page
│   ├── Catalog.jsx           # Catalogo de productos
│   ├── ProductPage.jsx       # Detalle de producto
│   ├── Confirmacion.jsx      # Confirmacion de compra
│   ├── RingSizeGuide.jsx     # Guia de tallas
│   ├── PrivacyPolicy.jsx     # Politica de privacidad
│   ├── ReturnsPolicy.jsx     # Politica de devoluciones
│   ├── TermsOfService.jsx    # Terminos de servicio
│   └── admin/
│       ├── Login.jsx         # Autenticacion admin
│       ├── Dashboard.jsx     # Metricas y reportes
│       └── ChatPanel.jsx     # Chat WhatsApp en tiempo real
├── components/
│   ├── Hero.jsx              # Banner principal
│   ├── Navbar.jsx            # Navegacion
│   ├── Footer.jsx            # Pie de pagina
│   ├── Collections.jsx       # Colecciones destacadas
│   ├── Contact.jsx           # Formulario de contacto
│   ├── Reviews.jsx           # Resenas de clientes
│   ├── Faq.jsx               # Preguntas frecuentes
│   └── WhatsAppButton.jsx    # Boton flotante de WhatsApp
└── lib/                      # Utilidades y configuracion
```

---

## 🚀 Instalacion

```bash
# Clonar el repositorio
git clone https://github.com/Sebastianlr11/aurem-gs-joyeria.git
cd aurem-gs-joyeria

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar en desarrollo
npm run dev
```

---

## 🔑 Variables de Entorno

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MERCADOPAGO_PUBLIC_KEY=
```

---

## 📄 Licencia

MIT

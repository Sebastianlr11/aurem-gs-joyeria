import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { waUrl } from '../lib/whatsapp';
import { Wallet } from '@mercadopago/sdk-react';
import ProductCard from '../components/catalog/ProductCard';
import { pixelVerPieza, pixelIniciarPago } from '../lib/pixeles'
import { ponerMeta, ponerProductoJsonLd } from '../lib/meta'
import { datosDeAtribucion } from '../lib/atribucion';

/* ── Countdown hook: 24 h rolling, persiste en localStorage ─────── */
const pad = (n) => String(n).padStart(2, '0');

const useCountdown = (storageKey) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        if (!storageKey) return;
        let endTime = parseInt(localStorage.getItem(storageKey) || '0');
        if (!endTime || endTime < Date.now()) {
            endTime = Date.now() + 24 * 60 * 60 * 1000;
            localStorage.setItem(storageKey, String(endTime));
        }

        const tick = () => {
            const diff = endTime - Date.now();
            if (diff <= 0) {
                endTime = Date.now() + 24 * 60 * 60 * 1000;
                localStorage.setItem(storageKey, String(endTime));
            }
            const d = Math.max(0, endTime - Date.now());
            setTimeLeft({
                hours:   Math.floor(d / 3600000),
                minutes: Math.floor((d % 3600000) / 60000),
                seconds: Math.floor((d % 60000) / 1000),
                /* Qué fracción del plazo queda, para el filete de oro. Un
                   número diciendo "quedan 3 horas" se lee; una barra que se
                   vacía se entiende sin leer. */
                fraccion: d / (24 * 60 * 60 * 1000),
            });
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [storageKey]);

    return timeLeft;
};

const fmt = (price) => price?.toLocaleString('es-CO');

/* Los logos de los medios de pago, para la ficha del joyero. */
const PAYMENT_LOGOS = [
  { name: 'Visa',        src: '/assets/payment/visa.svg' },
  { name: 'Mastercard',  src: '/assets/payment/mastercard.svg' },
  { name: 'Amex',        src: '/assets/payment/amex.svg' },
  { name: 'PSE',         src: '/assets/payment/pse.svg' },
  { name: 'Nequi',       src: '/assets/payment/nequi.svg' },
  { name: 'Daviplata',   src: '/assets/payment/daviplata.svg' },
  { name: 'Efecty',      src: '/assets/payment/efecty.svg' },
  { name: 'Bancolombia', src: '/assets/payment/bancolombia.svg' },
];

/* El contraentrega sólo se hace en Bogotá: el taller despacha a domicilio con
   cobro únicamente en la capital. Al resto del país se le cobra por
   anticipado, y el envío por Interrapidísimo sí llega a todas partes. */
/* En contraentrega no se pregunta ni ciudad ni departamento: sólo hay una
   respuesta posible. Estos dos valores se ponen solos al enviar. */
const COD_CIUDAD = 'Bogotá';
const COD_DEPARTAMENTO = 'Bogotá D.C.';

/* Los 32 departamentos más el distrito capital. Escrito a mano y no en un
   campo libre: "bogota", "Bogotá D.C.", "Cund" y "cundinamarca" son cuatro
   filas distintas en la base para el mismo lugar, y después no hay forma de
   contar a dónde se está vendiendo. */
const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar',
  'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
];

/* Los municipios que más pesan de cada departamento. NO es la lista completa
   —Colombia tiene 1.103— y a propósito: sirven como sugerencia, no como
   candado. Quien viva en un pueblo que no está lo escribe igual y compra.
   Bloquear una venta real por no tener su municipio en una lista es peor que
   guardar un nombre con una tilde de menos.
   
   Lo que sí resuelven: el 90% de los pedidos queda con el municipio escrito
   como lo espera la transportadora, y una guía con el municipio mal escrito es
   un paquete que rebota. */
const CIUDADES = {
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'La Estrella', 'Copacabana', 'Girardota', 'Caldas', 'Rionegro', 'Marinilla', 'La Ceja', 'Guarne', 'Apartadó', 'Turbo', 'Carepa', 'Chigorodó', 'Caucasia', 'Necoclí', 'Santa Fe de Antioquia'],
  'Arauca': ['Arauca', 'Saravena', 'Tame', 'Arauquita'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Puerto Colombia', 'Galapa', 'Baranoa', 'Sabanalarga'],
  'Bogotá D.C.': ['Bogotá'],
  'Bolívar': ['Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar', 'Mompós'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva'],
  'Caldas': ['Manizales', 'Villamaría', 'Chinchiná', 'La Dorada', 'Riosucio', 'Anserma'],
  'Caquetá': ['Florencia', 'San Vicente del Caguán', 'Puerto Rico'],
  'Casanare': ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena'],
  'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Piendamó', 'Guapi'],
  'Cesar': ['Valledupar', 'Aguachica', 'Bosconia', 'Agustín Codazzi', 'La Jagua de Ibirico'],
  'Chocó': ['Quibdó', 'Istmina', 'Acandí', 'Bahía Solano'],
  'Córdoba': ['Montería', 'Lorica', 'Cereté', 'Sahagún', 'Montelíbano', 'Planeta Rica', 'Tierralta'],
  'Cundinamarca': ['Soacha', 'Fusagasugá', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid', 'Funza', 'Cajicá', 'Girardot', 'Sibaté', 'Tocancipá', 'Cota', 'Tenjo', 'La Calera', 'Villeta', 'Ubaté', 'Anapoima'],
  'Guainía': ['Inírida'],
  'Guaviare': ['San José del Guaviare'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'Fonseca', 'San Juan del Cesar'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'San Martín'],
  'Nariño': ['Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'La Unión'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios'],
  'Putumayo': ['Mocoa', 'Puerto Asís', 'Orito', 'Villagarzón'],
  'Quindío': ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Quimbaya', 'Circasia', 'Salento'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Barbosa', 'Málaga'],
  'Sucre': ['Sincelejo', 'Corozal', 'San Marcos', 'Sampués', 'Santiago de Tolú'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Honda', 'Líbano', 'Chaparral', 'San Sebastián de Mariquita', 'Flandes'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo', 'Candelaria', 'Florida', 'Zarzal', 'Roldanillo'],
  'Vaupés': ['Mitú'],
  'Vichada': ['Puerto Carreño', 'La Primavera'],
};

const MP_DISCOUNT = 0.02; // 2% descuento pagando con Mercado Pago

/* ── BuyModal ───────────────────────────────────────────────────── */
const BuyModal = ({ product, onClose }) => {
  const mpPrice = Math.round(product.price * (1 - MP_DISCOUNT));
  const mpSaving = product.price - mpPrice;
  const [step, setStep] = useState('method'); // method | form | loading | wallet | error
  /* Arranca en Mercado Pago. El diseño muestra un total desde el primer
     segundo, y un total sin método elegido no existe. */
  const [paymentMethod, setPaymentMethod] = useState('mp'); // 'mp' | 'cod'
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', address: '', department: '' });
  const [errors, setErrors] = useState({});
  const [preferenceId, setPreferenceId] = useState(null);
  const [abono, setAbono] = useState(null);
  /* El abono se pide al abrir, no al pagar. Tiene que estar anunciado en la
     primera pantalla: descubrirlo después de llenar el formulario se lee como
     un cobro escondido, y es la forma más rápida de perder una venta que ya
     estaba decidida. */
  const [abonoEnvio, setAbonoEnvio] = useState(null);

  /* Cada paso arranca desde arriba. La caja es un solo contenedor con scroll y
     se lo queda entre pantallas: como en el selector de método hay que bajar
     hasta el botón, el formulario aparecía ya desplazado y el título quedaba
     fuera de vista. */
  const cajaRef = useRef(null);
  useEffect(() => { if (cajaRef.current) cajaRef.current.scrollTop = 0; }, [step]);
  const [initPoint, setInitPoint] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.from('envio_publico').select('abono_envio').maybeSingle()
      .then(({ data }) => { if (vivo && data?.abono_envio) setAbonoEnvio(Number(data.abono_envio)); });
    return () => { vivo = false; };
  }, []);

  const selectMethod = (method) => {
    setPaymentMethod(method);
    setStep('form');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Ingresa tu nombre';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ingresa un email válido';
    if (!form.address.trim()) e.address = 'Ingresa tu dirección de entrega';
    /* En contraentrega el destino es siempre Bogotá, así que no se pide ni se
       valida: se pone solo al enviar. */
    if (paymentMethod !== 'cod') {
      if (!form.department.trim()) e.department = 'Elige tu departamento';
      if (!form.city.trim()) e.city = 'Ingresa tu ciudad';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setStep('loading');

    try {
      const finalPrice = paymentMethod === 'mp' ? mpPrice : product.price;

      /* Antes de la llamada y no después: si create-preference falla, el
         intento de compra igual ocurrió y es lo que este evento mide. */
      pixelIniciarPago({ id: product.id, nombre: product.name, precio: finalPrice });

      const { data, error } = await supabase.functions.invoke('create-preference', {
        body: {
          paymentMethod,
          product: { id: product.id, name: product.name, price: finalPrice },
          buyer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            city: (paymentMethod === 'cod' ? COD_CIUDAD : form.city) || undefined,
            address: form.address.trim() || undefined,
            department: (paymentMethod === 'cod' ? COD_DEPARTAMENTO : form.department.trim()) || undefined,
          },
          /* De qué anuncio vino. Se guarda con el pedido para que el webhook
             de Mercado Pago pueda decirle a TikTok y a Meta qué clic terminó
             en venta — para entonces el navegador ya no está. */
          atribucion: datosDeAtribucion(),
        },
      });

      if (error || !data) throw new Error(data?.error || error?.message || 'Error desconocido');

      if (!data.preferenceId) throw new Error(data?.error || 'Error desconocido');
      setPreferenceId(data.preferenceId);
      setInitPoint(data.initPoint);
      /* El contraentrega también pasa por la pasarela, pero sólo por el abono.
         El servidor devuelve cuánto es y cuánto queda, para no calcularlo dos
         veces con el riesgo de que no coincidan. */
      setAbono(data.isCod ? { abono: data.abono, saldo: data.saldo } : null);
      setStep('wallet');
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo procesar tu pedido. Intenta de nuevo.');
      setStep('error');
    }
  };

  const handleChange = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => { const n = { ...er }; delete n[field]; return n; });
  };

  /* El error aparece al salir del campo, no al enviar. Enterarse de cinco
     errores de golpe después de darle al botón obliga a subir y releer todo;
     enterarse de uno al pasar al siguiente se corrige en el momento. */
  const handleBlur = (field) => () => {
    const e = validate();
    if (e[field]) setErrors(er => ({ ...er, [field]: e[field] }));
  };

  return (
    <div className="buy-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="buy-modal-box" ref={cajaRef}>
        {/* Cabecera de la pieza. El cierre va DENTRO de la fila y no flotando
            encima: sobre el nombre de la pieza tapaba texto, y con el modal
            angosto obligaba a dejarle un hueco al titular. */}
        <header className="pago-pieza">
          {product.image_url && <img src={product.image_url} alt={product.name} />}
          <div className="pago-pieza-info">
            <span className="pago-eyebrow">Tu pieza</span>
            <h3 className="pago-pieza-nombre">{product.name}</h3>
            <span className="pago-pieza-cat">
              {/* La ley junto al nombre, en el momento de pagar. Es el dato que
                  más tranquiliza en joyería, y hasta ahora no se guardaba. */}
              {product.metal ? `${product.category} · ${product.metal}` : product.category}
            </span>
          </div>
          <button type="button" className="pago-cerrar" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        {/* Selector de método de pago */}
        {step === 'method' && (
          <div className="pago-metodos">
            <div className="pago-titulo">
              <h2>¿Cómo quieres</h2>
              <em>pagar?</em>
            </div>

            <div className="pago-opciones" role="radiogroup" aria-label="Medio de pago">
              <div
                role="radio"
                tabIndex={0}
                aria-checked={paymentMethod === 'mp'}
                className={`pago-op ${paymentMethod === 'mp' ? 'pago-op--on' : ''}`}
                onClick={() => setPaymentMethod('mp')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPaymentMethod('mp'); } }}
              >
                <span className="pago-radio"><span /></span>
                <div className="pago-op-cuerpo">
                  <div className="pago-op-fila">
                    <span className="pago-op-nombre">Mercado Pago</span>
                    <span className="punzon">2% menos</span>
                  </div>
                  <span className="pago-op-sub">Tarjeta, PSE o Nequi · pago inmediato</span>
                  <div className="pago-op-precio">
                    <span className="pago-op-valor">${fmt(mpPrice)}</span>
                    <span className="pago-op-tachado">${fmt(product.price)}</span>
                  </div>
                </div>
              </div>

              <div
                role="radio"
                tabIndex={0}
                aria-checked={paymentMethod === 'cod'}
                className={`pago-op ${paymentMethod === 'cod' ? 'pago-op--on' : ''}`}
                onClick={() => setPaymentMethod('cod')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPaymentMethod('cod'); } }}
              >
                <span className="pago-radio"><span /></span>
                <div className="pago-op-cuerpo">
                  <div className="pago-op-fila">
                    <span className="pago-op-nombre">Contraentrega</span>
                    <span className="pago-op-solo">Sólo Bogotá</span>
                  </div>
                  <span className="pago-op-sub">
                    {abonoEnvio ? (
                      <>Abonas <strong>${fmt(abonoEnvio)}</strong> del envío hoy y pagas el resto al recibir</>
                    ) : 'Pagas en efectivo al recibir'}
                  </span>
                  <div className="pago-op-precio">
                    <span className="pago-op-valor">${fmt(product.price)}</span>
                    <span className="pago-op-nota">sin descuento</span>
                  </div>
                </div>
              </div>
            </div>

            {paymentMethod === 'mp' ? (
              <div className="pago-total">
                <div>
                  <span className="pago-total-l">Total a pagar ahora</span>
                  <div className="pago-total-v">
                    <span>${fmt(mpPrice)}</span>
                    <small>COP</small>
                  </div>
                </div>
                <span className="pago-total-nota">Ahorras ${fmt(mpSaving)}</span>
              </div>
            ) : (
              <div className="pago-cuenta">
                <div className="pago-cuenta-cabeza">
                  <span className="pago-cuenta-l">Abonas hoy</span>
                  <div className="pago-total-v">
                    <span>${fmt(abonoEnvio ?? 0)}</span>
                    <small>COP</small>
                  </div>
                  <span className="pago-cuenta-porque">Es el envío — sin este abono no se despacha</span>
                </div>
                <div className="pago-cuenta-fila">
                  <span>Pagas al recibir la pieza</span>
                  <span>${fmt(Math.max(product.price - (abonoEnvio ?? 0), 0))} COP</span>
                </div>
                <div className="pago-cuenta-fila pago-cuenta-fila--total">
                  <span>Total de tu pedido</span>
                  <span>${fmt(product.price)} COP</span>
                </div>
              </div>
            )}

            <button type="button" className="pago-cta" onClick={() => selectMethod(paymentMethod)}>
              {paymentMethod === 'mp'
                ? 'Pagar con Mercado Pago'
                : abonoEnvio ? `Abonar $${fmt(abonoEnvio)} del envío` : 'Continuar'}
            </button>

            {/* Lo que se promete acá se cumple SIEMPRE. El certificado no
                entra: tiene un costo aparte y vive en la ficha, con su
                precio. */}
            <div className="pago-confianza">
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <span>Envío 24 a 48 h en Bogotá</span>
              </div>
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v6h6"/><path d="M4 22V4a2 2 0 0 1 2-2h8l6 6v14a2 2 0 0 1-2 2z"/><path d="M9 13h6M9 17h4"/></svg>
                <span>Taller propio, piezas a medida</span>
              </div>
              <div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Garantía de por vida en el metal</span>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        {step === 'form' && (
          <form className="buy-modal-form" onSubmit={handleSubmit} noValidate>
            <div className="buy-modal-form-header">
              <button type="button" className="pago-volver" onClick={() => setStep('method')} aria-label="Volver">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h2 className="buy-modal-title">
                {paymentMethod === 'cod' ? 'Datos de entrega' : 'Datos del comprador'}
              </h2>
            </div>

            <div className="buy-modal-field">
              <label>Nombre completo <span className="req">*</span></label>
              <input type="text" placeholder="Ej. María García" value={form.name}
                onChange={handleChange('name')} onBlur={handleBlur('name')} className={errors.name ? 'buy-modal-input--error' : ''} />
              {errors.name && <span className="buy-modal-field-error">{errors.name}</span>}
            </div>
            <div className="buy-modal-field">
              <label>Correo electrónico <span className="req">*</span></label>
              <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                onChange={handleChange('email')} onBlur={handleBlur('email')} className={errors.email ? 'buy-modal-input--error' : ''} />
              {errors.email && <span className="buy-modal-field-error">{errors.email}</span>}
            </div>
            {/* Se llama WhatsApp y no teléfono porque es lo que es: ahí llega la
                confirmación del pago, la guía del despacho y ahí responde
                Valentina. Pedir "teléfono" hace que alguien ponga un fijo, y
                un fijo en este negocio es un cliente incomunicado. */}
            <div className="buy-modal-field">
              <label>WhatsApp {paymentMethod === 'cod' ? <span className="req">*</span> : '(opcional)'}</label>
              <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="Ej. 3001234567" value={form.phone}
                onChange={handleChange('phone')} onBlur={handleBlur('phone')} className={errors.phone ? 'buy-modal-input--error' : ''} />
              {errors.phone
                ? <span className="buy-modal-field-error">{errors.phone}</span>
                : <span className="buy-modal-city-note">Ahí te confirmamos el pedido y te mandamos la guía del envío.</span>}
            </div>

            <div className="buy-modal-field">
              <label>Dirección de entrega <span className="req">*</span></label>
              <input type="text" placeholder="Ej. Calle 123 # 45-67, Apto 301" value={form.address}
                onChange={handleChange('address')} onBlur={handleBlur('address')} className={errors.address ? 'buy-modal-input--error' : ''} />
              {errors.address && <span className="buy-modal-field-error">{errors.address}</span>}
            </div>

            {paymentMethod === 'mp' && (
              <>
                <div className="buy-modal-field">
                  <label>Departamento <span className="req">*</span></label>
                  <select value={form.department}
                    onChange={(e) => {
                      const dep = e.target.value;
                      /* Cambiar de departamento vacía la ciudad. Si no, queda
                         "Medellín" bajo "Santander" y la guía sale a un lugar
                         que no existe. */
                      setForm(f => ({ ...f, department: dep, city: '' }));
                      if (errors.department) setErrors(er => { const n = { ...er }; delete n.department; return n; });
                    }}
                    className={errors.department ? 'buy-modal-input--error' : ''}>
                    <option value="">Selecciona tu departamento</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <span className="buy-modal-field-error">{errors.department}</span>}
                </div>
                <div className="buy-modal-field">
                  <label>Ciudad <span className="req">*</span></label>
                  <input type="text" list="ciudades-sugeridas" autoComplete="address-level2"
                    placeholder={form.department ? `Ej. ${(CIUDADES[form.department] || ['tu municipio'])[0]}` : 'Elige primero el departamento'}
                    value={form.city}
                    onChange={handleChange('city')} onBlur={handleBlur('city')}
                    className={errors.city ? 'buy-modal-input--error' : ''} />
                  <datalist id="ciudades-sugeridas">
                    {(CIUDADES[form.department] || []).map(c => <option key={c} value={c} />)}
                  </datalist>
                  {errors.city && <span className="buy-modal-field-error">{errors.city}</span>}
                  {form.department && (
                    <span className="buy-modal-city-note">
                      Escribe y te sugerimos. Si tu municipio no aparece, escríbelo igual — llegamos a todo el país.
                    </span>
                  )}
                </div>
              </>
            )}

            {/* En contraentrega no hay nada que elegir: el destino es Bogotá y
                punto. Se muestra para que quede claro a dónde va, pero no se
                pregunta — dos campos menos entre el cliente y el pago. */}
            {paymentMethod === 'cod' && (
              <div className="buy-modal-field">
                <label>Ciudad de entrega</label>
                <div className="buy-modal-fijo">{COD_CIUDAD}</div>
                <span className="buy-modal-city-note">
                  El pago contraentrega por ahora solo está disponible en Bogotá. Si estás en otra ciudad te lo enviamos igual, pagando con{' '}
                  <button type="button" className="buy-modal-city-note-link" onClick={() => { setPaymentMethod('mp'); }}>
                    Mercado Pago
                  </button>
                  {' '}— aceptamos tarjetas, PSE, Nequi y más.
                </span>
              </div>
            )}

            {paymentMethod === 'cod' && (
              <div className="buy-cod-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {abonoEnvio ? (
                  <span>
                    Para confirmar abonas <strong>${fmt(abonoEnvio)} COP</strong> del envío,
                    que se descuentan del total. Al recibir pagas{' '}
                    <strong>${fmt(product.price - abonoEnvio)} COP</strong> en efectivo.
                  </span>
                ) : (
                  <span>Pagarás <strong>${fmt(product.price)} COP</strong> en efectivo al recibir tu pedido.</span>
                )}
              </div>
            )}

            <button type="submit" className="buy-modal-submit">
              {paymentMethod === 'cod'
                ? (abonoEnvio ? `Continuar y abonar $${fmt(abonoEnvio)}` : 'Continuar al abono')
                : 'Continuar al pago'}
            </button>
          </form>
        )}

        {step === 'loading' && (
          <div className="buy-modal-loading">
            <div className="buy-modal-spinner" />
            <p>{paymentMethod === 'cod' ? 'Registrando tu pedido…' : 'Preparando tu pago…'}</p>
          </div>
        )}


        {step === 'wallet' && initPoint && (
          <div className="abono-paso">
            <div className="abono-cuerpo">
                {abono ? (
                  <>
                    <p className="abono-lead">
                      Confirmas el pedido abonando el envío. El resto lo pagas cuando
                      tengas la pieza en tus manos.
                    </p>

                    {/* Los dos pagos como una línea de tiempo. En una tabla de
                        cifras se leen como un total partido; acá se lee que son
                        dos momentos distintos, que es lo que son. */}
                    <ol className="abono-linea">
                      <li>
                        <span className="abono-hito">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        </span>
                        <div>
                          <span className="abono-cuando">Hoy</span>
                          <span className="abono-que">Abonas el envío</span>
                          <span className="abono-detalle">Se descuenta del total. Despachamos al día siguiente.</span>
                        </div>
                        <span className="abono-monto">${fmt(abono.abono)}</span>
                      </li>
                      <li>
                        <span className="abono-hito">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.8"/><path d="M5 9.5v5M19 9.5v5"/></svg>
                        </span>
                        <div>
                          <span className="abono-cuando">Al recibir</span>
                          <span className="abono-que">Pagas el resto</span>
                          <span className="abono-detalle">En efectivo, cuando te entreguen la pieza.</span>
                        </div>
                        <span className="abono-monto">${fmt(abono.saldo)}</span>
                      </li>
                    </ol>

                    <div className="abono-total">
                      <span>Total</span>
                      <span>${fmt(abono.abono + abono.saldo)} <small>COP</small></span>
                    </div>
                  </>
                ) : (
                  <p className="abono-lead">
                    Tu pedido está listo. Al confirmar te llevamos a Mercado Pago para
                    completar el pago de forma segura.
                  </p>
                )}

                {/* Sin target="_blank". Una pestaña nueva en el móvil es lo peor
                    de los dos mundos: el cliente pierde de vista dónde estaba y
                    tiene que ir a buscar la pestaña original para volver.
                    Mercado Pago se lleva la página y la devuelve sola a
                    /confirmacion cuando termina, que es el recorrido que la
                    gente ya conoce de cualquier tienda. */}
                <a href={initPoint} className="abono-cta">
                  {abono ? `Abonar $${fmt(abono.abono)}` : 'Pagar con Mercado Pago'}
                </a>

                {abono && (
                  /* La condición del abono, antes de pagar y no en un enlace que
                     nadie abre. Si el cliente rechaza la entrega, la transportadora
                     igual cobra el servicio prestado: decirlo acá evita el reclamo
                     después, y es lo que hace que el cobro sea justo y no una
                     sorpresa. */
                  <p className="abono-condicion">
                    Si rechazas la entrega, el abono no se devuelve: la transportadora
                    cobra el envío igual por haberlo despachado. Si la recibes, se
                    descuenta del total.
                  </p>
                )}
            </div>

            <footer className="abono-pie">
              <span className="abono-seguro">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Pago seguro procesado por Mercado Pago
              </span>
              <div className="abono-logos">
                {PAYMENT_LOGOS.slice(0, 5).map(({ name, src }) => (
                  <div key={name} title={name}><img src={src} alt={name} /></div>
                ))}
              </div>
            </footer>
          </div>
        )}

        {step === 'error' && (
          <div className="buy-modal-error">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{errorMsg}</p>
            <button className="buy-modal-retry" onClick={() => setStep('method')}>Intentar de nuevo</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Loading skeleton ──────────────────────────────────────────── */
const Skeleton = () => (
    <div className="product-page">
        <div className="container">
            <div className="product-page-back-wrap" />
            <div className="product-page-hero">
                <div className="product-page-skeleton-img" />
                <div className="product-page-skeleton-info">
                    <div className="product-page-skeleton-line" style={{ width: '30%', height: '12px' }} />
                    <div className="product-page-skeleton-line" style={{ width: '80%', height: '52px', marginTop: '1rem' }} />
                    <div className="product-page-skeleton-line" style={{ width: '65%', height: '52px' }} />
                    <div className="product-page-skeleton-line" style={{ width: '90%', height: '16px', marginTop: '1.5rem' }} />
                    <div className="product-page-skeleton-line" style={{ width: '70%', height: '16px' }} />
                    <div className="product-page-skeleton-line" style={{ width: '40%', height: '48px', marginTop: '2rem' }} />
                    <div className="product-page-skeleton-line" style={{ width: '100%', height: '52px', marginTop: '2rem' }} />
                </div>
            </div>
        </div>
    </div>
);

/* ── Gallery ───────────────────────────────────────────────────── */
const Gallery = ({ images, badges, volver, referencia }) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const [fading, setFading] = useState(false);
    const [lightbox, setLightbox] = useState(false);
    const [lbClosing, setLbClosing] = useState(false);

    const goTo = (idx) => {
        if (idx === activeIdx) return;
        setFading(true);
        setTimeout(() => { setActiveIdx(idx); setFading(false); }, 220);
    };

    const prev = () => goTo((activeIdx - 1 + images.length) % images.length);
    const next = () => goTo((activeIdx + 1) % images.length);

    /* Deslizar entre fotos. Los puntos prometen que hay más de una y que se
       pasa con el dedo; sin esto la promesa es falsa y el único modo de ver
       la segunda foto es acertarle a un punto de 6px.
       Solo cuenta como deslizamiento si el movimiento es más horizontal que
       vertical: si no, bajar la página cambiaría la foto sin querer. */
    const toque = useRef(null);
    const UMBRAL = 45;

    const alTocar = (e) => {
        const t = e.changedTouches[0];
        toque.current = { x: t.clientX, y: t.clientY, deslizo: false };
    };

    const alSoltar = (e) => {
        if (!toque.current) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - toque.current.x;
        const dy = t.clientY - toque.current.y;
        if (Math.abs(dx) > UMBRAL && Math.abs(dx) > Math.abs(dy)) {
            toque.current.deslizo = true;
            dx < 0 ? next() : prev();
        }
    };

    /* El toque en la foto abre el visor, pero un deslizamiento también acaba
       en click: sin esto, pasar de foto abre el visor encima. */
    const alPulsar = () => {
        if (toque.current?.deslizo) { toque.current = null; return; }
        setLightbox(true);
    };

    const closeLightbox = () => {
        setLbClosing(true);
        setTimeout(() => { setLightbox(false); setLbClosing(false); }, 280);
    };

    useEffect(() => {
        if (!lightbox) return;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
    }, [lightbox, activeIdx]);

    if (images.length === 0) {
        return (
            <div className="pg-gallery hero-anim" style={{ '--hero-delay': '0s' }}>
                <div className="pg-gallery-main">
                    <div className="product-page-placeholder"><span>✦</span></div>
                    {volver}
                </div>
                {badges}
            </div>
        );
    }

    return (
        <>
            <div className="pg-gallery hero-anim" style={{ '--hero-delay': '0s' }}>
                <div
                    className="pg-gallery-main"
                    onClick={alPulsar}
                    onTouchStart={alTocar}
                    onTouchEnd={alSoltar}
                    style={{ cursor: 'zoom-in' }}
                >
                    <img
                        src={images[activeIdx]}
                        alt={`Imagen ${activeIdx + 1}`}
                        style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.22s ease' }}
                    />
                    {badges}
                    {volver}
                    {/* Las miniaturas van encima de la foto, en fila abajo a
                        la izquierda, con el contador en la esquina opuesta.
                        Sobre su propia barra clara partían el fondo oscuro en
                        dos y le quitaban a la pieza el único sitio donde tiene
                        toda la luz. Las flechas sobran con tres a la vista. */}
                    {/* La referencia arriba a la derecha, sobre la foto. En el
                        celular la columna de texto empieza debajo de la imagen
                        y ahí la referencia le robaría un renglón al nombre. */}
                    {referencia && <span className="pg-gallery-ref">{referencia}</span>}

                    {images.length > 1 && (
                        <span className="pg-gallery-contador">{activeIdx + 1} / {images.length}</span>
                    )}

                    {/* Puntos para el celular: tres miniaturas de 58px se comen
                        el borde de la foto en una pantalla de 390, y ahí no
                        hace falta ver qué hay en cada una — basta saber
                        cuántas son y en cuál vas. */}
                    {images.length > 1 && (
                        <div className="pg-gallery-puntos">
                            {images.map((_, i) => (
                                <button
                                    key={i}
                                    className={`pg-gallery-punto ${i === activeIdx ? 'pg-gallery-punto--on' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); goTo(i); }}
                                    aria-label={`Imagen ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                    {images.length > 1 && (
                        <div className="pg-gallery-thumbs">
                            {images.map((url, i) => (
                                <button
                                    key={i}
                                    className={`pg-gallery-thumb ${i === activeIdx ? 'pg-gallery-thumb--active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); goTo(i); }}
                                    aria-label={`Imagen ${i + 1}`}
                                >
                                    <img src={url} alt="" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox modal */}
            {lightbox && (
                <div className={`pg-lightbox${lbClosing ? ' lb-closing' : ''}`} onClick={closeLightbox}>
                    <button className="pg-lightbox-close" onClick={closeLightbox} aria-label="Cerrar">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>

                    <img
                        className="pg-lightbox-img"
                        src={images[activeIdx]}
                        alt={`Imagen ${activeIdx + 1}`}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={alTocar}
                        onTouchEnd={alSoltar}
                        style={{ opacity: fading ? 0 : 1 }}
                    />

                    {images.length > 1 && (
                        <>
                            <button className="pg-lightbox-nav pg-lightbox-nav--prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Anterior">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <button className="pg-lightbox-nav pg-lightbox-nav--next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Siguiente">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                            <div className="pg-lightbox-counter">{activeIdx + 1} / {images.length}</div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

/* ── Product Page ──────────────────────────────────────────────── */
const ProductPage = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [product, setProduct] = useState(null);
    const timeLeft = useCountdown(id ? `offer_end_${id}` : null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [talla, setTalla] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchData = async () => {
            setLoading(true);
            setNotFound(false);

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            setProduct(data);

            /* Vio la pieza. Va acá y no al montar el componente: hasta que
               no cargó, no se sabe qué está mirando ni cuánto vale. */
            pixelVerPieza({ id: data.id, nombre: data.name, precio: data.price });

            const { data: rel } = await supabase
                .from('products')
                .select('*')
                .eq('category', data.category)
                .neq('id', id)
                .limit(3);

            setRelated(rel || []);
            setLoading(false);
        };

        fetchData();
    }, [id]);

    /* El <head> de esta pieza. Sin esto las cinco fichas se titulan igual que
       la home, y para Google —que sí ejecuta JavaScript antes de indexar— son
       cinco páginas idénticas.

       La limpieza que devuelve importa: al volver al catálogo hay que soltar
       el título del anillo, o se queda puesto. */
    useEffect(() => {
        if (!product) return;
        const pesos = `$${Math.round(Number(product.price) || 0).toLocaleString('es-CO')}`;
        const ficha = [product.metal, product.piedra].filter(Boolean).join(' · ');
        const soltarMeta = ponerMeta({
            titulo: `${product.name} — ${pesos} | Aurem Gs Joyería`,
            descripcion: (product.description || '').trim().replace(/\s+/g, ' ').slice(0, 155)
                || `${product.name} en ${ficha || 'plata 925'}. Estuche incluido y garantía de por vida en el metal.`,
            imagen: (Array.isArray(product.images) && product.images[0]) || product.image_url,
            ruta: `/catalogo/${product.id}`,
            tipo: 'product',
        });
        const soltarJsonLd = ponerProductoJsonLd(product);
        return () => { soltarMeta(); soltarJsonLd(); };
    }, [product]);

    useEffect(() => {
        if (!loading && product && searchParams.get('buy') === '1') {
            setShowBuyModal(true);
        }
    }, [loading, product, searchParams]);

    /* La barra de compra solo aparece cuando el botón de verdad ya salió de
       pantalla. Con los dos a la vez había dos "Comprar ahora" compitiendo a
       diez centímetros uno del otro, y el de abajo tapando parte de la foto
       sin necesidad: la barra existe para cuando el botón se pierde al bajar
       a leer la ficha, no para acompañarlo. */
    const accionesRef = useRef(null);
    const [barraVisible, setBarraVisible] = useState(false);

    useEffect(() => {
        /* Sin IntersectionObserver la barra se queda fija y visible. Es un
           botón de compra: vale más que estorbe un poco a que desaparezca
           para siempre porque el navegador no soporta la API. */
        if (typeof IntersectionObserver === 'undefined') { setBarraVisible(true); return; }
        const el = accionesRef.current;
        if (!el) return;
        /* rootMargin recorta el borde de abajo por la altura de la propia
           barra: sin eso la barra aparece cuando el botón toca el filo de la
           pantalla, o sea justo cuando ella misma lo está tapando. */
        const obs = new IntersectionObserver(
            ([e]) => setBarraVisible(!e.isIntersecting),
            { rootMargin: '0px 0px -88px 0px' },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [loading, product]);

    if (loading) return <Skeleton />;

    if (notFound) return (
        <div className="product-page">
            <div className="container">
                <div className="product-page-notfound">
                    <span className="product-page-notfound-icon">✦</span>
                    <h2>Pieza no encontrada</h2>
                    <p>Es posible que esta pieza ya no esté disponible.</p>
                    <Link to="/catalogo" className="product-page-back-btn">← Volver al catálogo</Link>
                </div>
            </div>
        </div>
    );

    const allImages = product.images?.length > 0
        ? product.images
        : product.image_url ? [product.image_url] : [];

    const notaTalla = talla ? `\n- Talla: ${talla}` : '';

    const waLink = waUrl({
        mobile: `Hola! 😊 Vi la pieza *${product.name}* en su tienda y me encantó.\n\n💰 Precio: $${fmt(product.price)} COP${notaTalla}\n\nMe gustaría comprarla, está disponible? 💎`,
        desktop: `Hola! Vi la pieza *${product.name}* en su tienda y me encantó.\n\n- Precio: $${fmt(product.price)} COP${notaTalla}\n\nMe gustaría comprarla, está disponible?`,
    });

    const badges = (
        <div className="product-page-badges">
            {product.is_new      && <span className="product-badge product-badge--new">Nuevo</span>}
            {product.is_featured && <span className="product-badge product-badge--featured">✦ Destacado</span>}
        </div>
    );

    /* La talla solo tiene sentido en anillos y es un dato del cliente,
       no del producto: viaja en el mensaje de WhatsApp y se confirma antes
       de enviar, porque el checkout todavía no la captura. */
    const esAnillo = product.category === 'Anillos';
    /* Sin el botón "No sé mi talla": ocupaba el ancho de tres tallas para
       decir algo que se dice mejor en una línea de texto. La talla nunca fue
       obligatoria para comprar, así que quien no la sepa sigue pudiendo. */
    const TALLAS = ['5', '6', '7', '8', '9', '10', '11', '12'];

    const enOferta = product.compare_price && product.compare_price > product.price;
    const referencia = `REF. AG-${String(product.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

    /* El punzón de ley: la marca que un orfebre golpea dentro de la pieza. Sale
       del metal escrito en el catálogo, recortado a la ley sola —"Plata 925"
       se muestra como 925— porque eso es lo que dice el punzón real. Si la
       pieza no tiene metal cargado, no hay punzón: uno inventado es peor que
       ninguno. */
    const ley = (product.metal || '').match(/\b(925|750|18\s?k|14\s?k|PT\s?950|950)\b/i);
    const punzonLey = ley ? ley[0].replace(/\s/g, '').toUpperCase() : null;

    /* "Anillo Majestuosa" se parte en "Anillo" y "MAJESTUOSA": la primera
       palabra dice qué es, el resto es el nombre propio. Un nombre de una sola
       palabra no se parte. */
    const partes = product.name.trim().split(/\s+/);
    const nombrePartido = partes.length > 1
        ? { primero: partes[0], resto: partes.slice(1).join(' ') }
        : { primero: product.name, resto: null };

    const resumenFinal = (product.description || '').trim();

    /* La línea de datos del celular. En una pantalla de 390 la descripción de
       cuatro renglones empuja el precio fuera de vista, así que arriba van
       solo los cuatro datos que deciden —de qué es, qué piedra, cómo se paga
       y cuándo llega— y la descripción se lee al bajar.
       "Contraentrega en Bogotá" y no "pagas al recibir" a secas: el
       contraentrega solo llega a Bogotá y la versión corta promete de más. */
    const piedraCorta = (product.piedra || '').split(',')[0].trim().toLowerCase();
    const resumenCorto = [
        product.metal,
        piedraCorta || null,
        'contraentrega en Bogotá',
        'envío 1 a 3 días',
    ].filter(Boolean).join(' · ');

    /* Sin "Categoría" —ya lo dice el antetítulo del hero— y sin "Referencia",
       que sube al punzón de la cabecera junto a la ley. */
    const ficha = [
        product.metal ? ['Metal', product.metal + (punzonLey ? ' con punzón de ley' : '')] : null,
        product.piedra ? ['Piedra', product.piedra] : null,
        product.engaste ? ['Engaste', product.engaste] : null,
        esAnillo ? ['Talla', `${product.talla_rango || '5 a 12'} · ajuste en taller sin costo`] : null,
        ['Envío', 'Bogotá en 24 a 48 h · resto del país, 2 a 3 días'],
        /* Una línea, no un párrafo: el detalle de las dos formas de pagar se
           lee entero en la franja de abajo. Aquí solo el titular, y con el
           límite dicho —el contraentrega no sale de Bogotá—. */
        ['Pago', 'Contraentrega en Bogotá · o en línea'],
        /* Lo hace un laboratorio gemológico: dice de dónde viene la piedra
           —y si es sintética—, la ley del metal y las medidas, y lleva un
           código que se comprueba en la web del laboratorio. Decir solo
           "Opcional · $50.000" era vender un recibo en vez de una prueba. */
        ['Certificado', 'Opcional · $50.000 · laboratorio gemológico, con código verificable'],
        ['Garantía', 'De por vida en el metal'],
        product.stock !== null && product.stock !== undefined
            ? ['Disponibilidad', product.stock === 0 ? 'Agotada' : `${product.stock} unidad${product.stock !== 1 ? 'es' : ''}`]
            : null,
    ].filter(Boolean);

    /* Qué incluye el precio. Antes describía la pieza —piedra, metal,
       engaste— repitiendo lo que la tabla de arriba ya dice con más
       precisión. Ahora describe la compra: qué recibes además de la joya.
       Cada frase se queda en lo que el taller sí hace: nada de "envío
       asegurado" ni plazos que no hemos confirmado. */
    const incluye = [
        ['estuche', 'Estuche y envío', 'Caja de joyería y guía con seguimiento.'],
        ['taller', 'Ajuste de talla en taller', 'Una modificación sin costo.'],
        ['garantia', 'Garantía de por vida', 'Pulido y reparación por defectos del metal, sin vencimiento.'],
    ];

    return (
        <div className="ficha">
            {showBuyModal && <BuyModal product={product} onClose={() => setShowBuyModal(false)} />}

            <section className="ficha-hero">
                <div className="ficha-grid">

                    <div className="ficha-galeria">
                        <Gallery
                            images={allImages}
                            badges={badges}
                            referencia={referencia.replace('REF. ', '')}
                            volver={
                                <Link to="/catalogo" className="pg-volver" onClick={(e) => e.stopPropagation()}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="19" y1="12" x2="5" y2="12" />
                                        <polyline points="11 6 5 12 11 18" />
                                    </svg>
                                    {/* En span y no suelto: en el celular el botón
                                        se reduce a un círculo y el texto hay que
                                        poder apagarlo. */}
                                    <span className="pg-volver-txt">Volver al catálogo</span>
                                </Link>
                            }
                        />
                    </div>

                    <div className="ficha-info">

                        <div className="ficha-encabezado">
                            <span className="eyebrow">{product.category}</span>
                            <span className="ficha-ref">{referencia}</span>
                        </div>

                        {/* El nombre partido en dos, como el resto de los
                            titulares del sitio: el tipo de pieza en la romana y
                            el nombre propio en versalitas espaciadas debajo. */}
                        <h1 className="ficha-nombre">
                            {nombrePartido.primero}
                            {nombrePartido.resto && <em>{nombrePartido.resto}.</em>}
                        </h1>

                        {/* La descripción, tal cual está escrita en el panel. Se
                            arma en dos frases —qué es la pieza y qué recibes—
                            y así cabe entera antes del precio. Antes eran siete
                            líneas de copy de redes con emojis, y empujaban el
                            precio y la talla debajo del pliegue. */}
                        {resumenFinal && <p className="ficha-desc">{resumenFinal}</p>}

                        <p className="ficha-resumen-corto">{resumenCorto}</p>

                        <div className="ficha-precio-bloque">
                            <div className="ficha-precio">
                                <span className="ficha-precio-valor">${fmt(product.price)}</span>
                                <span className="ficha-precio-moneda">COP</span>
                            </div>
                            <div className="ficha-precio-envio">
                                <span>Pagas al recibir o en línea</span>
                                <span>Envío 24 a 48 h Bogotá · 2 a 3 días</span>
                            </div>
                        </div>

                        {enOferta && (
                            <div className="ficha-oferta">
                                <div className="ficha-oferta-fila">
                                    <div className="ficha-oferta-ahorro">
                                        <span className="ficha-oferta-label">Precio de lanzamiento</span>
                                        <div className="ficha-oferta-cifra">
                                            {/* El ahorro primero y en grande: "antes $1.600.000"
                                                obliga a restar, y nadie resta mirando un anuncio. */}
                                            <strong>Ahorras ${fmt(product.compare_price - product.price)}</strong>
                                            <span className="ficha-oferta-moneda">COP</span>
                                            <span className="ficha-oferta-sep" aria-hidden="true" />
                                            <span className="ficha-oferta-antes">
                                                antes <s>${fmt(product.compare_price)}</s>
                                            </span>
                                        </div>
                                    </div>

                                    {timeLeft && (
                                        <div className="ficha-oferta-reloj">
                                            <span className="ficha-oferta-label">Termina en</span>
                                            <div className="ficha-oferta-digitos">
                                                <b>{pad(timeLeft.hours)}</b><span>h</span>
                                                <b>{pad(timeLeft.minutes)}</b><span>m</span>
                                                <b>{pad(timeLeft.seconds)}</b><span>s</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* El filete mide lo que queda del plazo. Va a ras del
                                    borde inferior, de lado a lado. */}
                                <div className="ficha-oferta-plazo">
                                    <span style={{ width: `${Math.round((timeLeft?.fraccion ?? 1) * 100)}%` }} />
                                </div>
                            </div>
                        )}

                        {esAnillo && (
                            <div className="ficha-tallas">
                                <div className="ficha-tallas-head">
                                    <span className="ficha-tallas-titulo">Talla</span>
                                    <Link to="/guia-de-tallas" className="ficha-tallas-guia">
                                        Ver guía de tallas
                                    </Link>
                                </div>
                                <div className="ficha-tallas-lista">
                                    {TALLAS.map(t => (
                                        <button
                                            key={t}
                                            className={`ficha-talla ${talla === t ? 'ficha-talla--on' : ''} ${t.length > 2 ? 'ficha-talla--ancha' : ''}`}
                                            onClick={() => setTalla(talla === t ? null : t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <p className="ficha-tallas-nota">
                                    {talla
                                        ? `Talla ${talla} · la confirmamos por WhatsApp antes de enviar`
                                        : '¿No la sabes? La medimos por WhatsApp en dos minutos.'}
                                </p>
                            </div>
                        )}

                        <div className="ficha-acciones" ref={accionesRef}>
                            <button className="ficha-btn-comprar" onClick={() => setShowBuyModal(true)}>
                                Comprar ahora
                            </button>
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="ficha-btn-wa">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                                    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" />
                                </svg>
                                WhatsApp
                            </a>
                        </div>

                        {/* Las cuatro garantías en una sola línea de texto. En
                            rejilla de dos por dos con iconos ocupaban un tercio
                            de la pantalla para decir cuatro datos cortos, y
                            empujaban los botones contra el borde de abajo.
                            Cada uno dice hasta dónde llega: la contraentrega es
                            solo Bogotá y la garantía cubre el metal. */}
                        <ul className="ficha-promesas">
                            {['Envío 24 a 48 h en Bogotá',
                              'Contraentrega en Bogotá',
                              'Certificado opcional',
                              'Garantía de por vida en el metal'].map(t => <li key={t}>{t}</li>)}
                        </ul>

                    </div>
                </div>
            </section>

            {/* La ficha del joyero sale de la columna y pasa a ser una tarjeta
                de ancho completo sobre marfil. Es el documento que respalda la
                compra, y leerlo apretado contra el botón de comprar lo hacía
                parecer letra chica. */}
            <section className="joyero">
              <div className="container">
                {/* Sin tarjeta blanca: la ficha se apoya en el marfil y la
                    ordenan las líneas de pelo. La caja con borde y sombra
                    encerraba un documento que ya se sostiene solo.
                    Sin isotipo tampoco: sobre marfil y sin caja que firmar,
                    quedaba como una marca de agua suelta ocupando un renglón
                    entero. La marca ya la lleva el pie de página. */}
                <header className="joyero-cabeza">
                  <div>
                    <span className="eyebrow">Lo verificable</span>
                    <h2>Ficha del<em>joyero.</em></h2>
                  </div>
                  {/* La ley y la referencia, juntas: las dos son marcas que
                      identifican esta pieza y no etiquetas de catálogo. */}
                  <div className="joyero-punzones">
                    {punzonLey && product.metal && (
                      <span className="punzon">
                        {`${product.metal.replace(/\s*\b(925|750|18\s?k|14\s?k|PT\s?950|950)\b/i, '').trim()} ley ${punzonLey}`}
                      </span>
                    )}
                    <span className="punzon">{referencia.replace('REF. ', 'Ref. ')}</span>
                  </div>
                </header>

                <dl className="joyero-lista">
                  {ficha.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="incluye">
                  <span className="eyebrow">Qué incluye el precio</span>
                  <div className="incluye-grid">
                    {incluye.map(([id, titulo, detalle]) => (
                      <div key={id}>
                        {id === 'estuche' && (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        )}
                        {id === 'taller' && (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                        )}
                        {id === 'garantia' && (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                        )}
                        <h3 className="incluye-t">{titulo}</h3>
                        <p className="incluye-s">{detalle}</p>
                      </div>
                    ))}
                  </div>

                  {/* Lo que NO incluye, dicho de frente. El certificado cuesta
                      aparte y esconderlo es el tipo de sorpresa que tumba una
                      venta en la puerta. */}
                  <p className="incluye-no">
                    <span>No incluye</span>
                    Certificado gemológico, que se pide aparte por $50.000. Lo emite un
                    laboratorio: acredita la procedencia de la piedra —y si es sintética—,
                    la ley del metal y las medidas, con un código verificable en su web.
                  </p>
                </div>

                {/* El pie de la tarjeta. Antes era la etiqueta pegada al borde
                    izquierdo y los logos al derecho, con un vacío en medio y
                    nada que explicara qué significan. Ese vacío lo llena la
                    pregunta que la clienta trae: qué puedo pagar al recibir y
                    qué en línea. */}
                <div className="joyero-pagos">
                  <span className="joyero-pagos-titulo">Cómo pagas</span>

                  <div className="joyero-formas">
                    <div className="joyero-forma">
                      <span className="joyero-forma-icono">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="1.5" />
                          <circle cx="12" cy="12" r="2.8" />
                          <path d="M5 9.5v5M19 9.5v5" />
                        </svg>
                      </span>
                      <div>
                        <span className="joyero-forma-t">Al recibir, en efectivo</span>
                        {/* "Solo en Bogotá" va primero y no al final: es la
                            condición que decide si esta opción existe para
                            quien está leyendo. */}
                        <p className="joyero-forma-s">
                          Solo en Bogotá. Abonas el envío al confirmar el pedido y pagas
                          el resto cuando te entregan la pieza.
                        </p>
                      </div>
                    </div>

                    <span className="joyero-formas-linea" />

                    <div className="joyero-forma">
                      <span className="joyero-forma-icono">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" />
                          <path d="M16 8h4l3 3v5h-7z" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </span>
                      <div>
                        <span className="joyero-forma-t">En línea, a todo el país</span>
                        <p className="joyero-forma-s">
                          Tarjeta, PSE, Nequi, Daviplata o efectivo en Efecty.
                          Despachamos al día siguiente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fichas del mismo tamaño exacto. Sueltos y a su altura
                      natural, cada logo pesaba distinto y la fila se leía
                      desordenada. */}
                  <div className="joyero-logos">
                    {PAYMENT_LOGOS.map(({ name, src }) => (
                      <span key={name} className="joyero-logo">
                        <img src={src} alt={name} />
                      </span>
                    ))}
                  </div>

                  <span className="joyero-seguro">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Pago seguro procesado por Mercado Pago
                  </span>
                </div>
              </div>
            </section>

            <div className="container">
                {related.length > 0 && (
                    <div className="ficha-relacionadas">
                        <div className="ficha-relacionadas-head">
                            <span className="eyebrow">Otras piezas en {product.category.toLowerCase()}</span>
                            <Link to="/catalogo" className="ficha-relacionadas-link">
                                Ver el catálogo
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </Link>
                        </div>
                        <div className="ficha-relacionadas-grid">
                            {related.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    </div>
                )}
            </div>

            {/* Barra fija. El botón de comprar queda arriba y se pierde apenas
                la persona baja a leer la ficha; sin esto hay que volver a
                subir para comprar, y mucha gente no vuelve. Se asoma sola
                cuando el botón de arriba sale de cuadro. */}
            <div className={`ficha-barra${barraVisible ? ' ficha-barra--visible' : ''}`}
                 aria-hidden={!barraVisible}>
                <div className="container ficha-barra-fila">
                    <div className="ficha-barra-precio">
                        <div>
                            <span>${fmt(product.price)}</span>
                            <small>COP</small>
                        </div>
                        <span className="ficha-barra-nota">
                            {esAnillo
                                ? (talla ? `Talla ${talla} · ajuste sin costo` : 'Elige tu talla o te ayudamos')
                                : 'Envío 24 a 48 h Bogotá · 2 a 3 días'}
                        </span>
                    </div>
                    <div className="ficha-barra-acciones">
                        <button type="button" className="ficha-barra-comprar" onClick={() => setShowBuyModal(true)}>
                            Comprar ahora
                        </button>
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                           className="ficha-barra-wa" aria-label="Preguntar por WhatsApp">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductPage;

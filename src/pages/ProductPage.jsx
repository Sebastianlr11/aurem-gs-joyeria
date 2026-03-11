import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { waUrl } from '../lib/whatsapp';
import { Wallet } from '@mercadopago/sdk-react';
import ProductCard from '../components/catalog/ProductCard';

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
            });
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [storageKey]);

    return timeLeft;
};

const fmt = (price) => price?.toLocaleString('es-CO');

/* ── PaymentMethods ─────────────────────────────────────────────── */
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

const PaymentMethods = () => (
  <div className="pm-section">
    <span className="pm-label">Métodos de pago aceptados</span>
    <div className="pm-grid">
      {PAYMENT_LOGOS.map(({ name, src }) => (
        <div className="pm-item" key={name} title={name}>
          <img src={src} alt={name} />
        </div>
      ))}
    </div>
    <div className="pm-cod-tag">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      Contraentrega disponible en ciudades principales
    </div>
  </div>
);

const COD_CITIES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
  'Bucaramanga', 'Pereira', 'Manizales', 'Santa Marta', 'Cúcuta',
  'Ibagué', 'Villavicencio',
];

const MP_DISCOUNT = 0.02; // 2% descuento pagando con Mercado Pago

/* ── BuyModal ───────────────────────────────────────────────────── */
const BuyModal = ({ product, onClose }) => {
  const mpPrice = Math.round(product.price * (1 - MP_DISCOUNT));
  const mpSaving = product.price - mpPrice;
  const [step, setStep] = useState('method'); // method | form | loading | wallet | cod-success | error
  const [paymentMethod, setPaymentMethod] = useState(null); // 'mp' | 'cod'
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });
  const [errors, setErrors] = useState({});
  const [preferenceId, setPreferenceId] = useState(null);
  const [initPoint, setInitPoint] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const selectMethod = (method) => {
    setPaymentMethod(method);
    setStep('form');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Ingresa tu nombre';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ingresa un email válido';
    if (paymentMethod === 'cod' && !form.city) e.city = 'Selecciona tu ciudad';
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
      const { data, error } = await supabase.functions.invoke('create-preference', {
        body: {
          paymentMethod,
          product: { id: product.id, name: product.name, price: finalPrice },
          buyer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            city: form.city || undefined,
          },
        },
      });

      if (error || !data) throw new Error(data?.error || error?.message || 'Error desconocido');

      if (paymentMethod === 'cod') {
        setStep('cod-success');
      } else {
        if (!data.preferenceId) throw new Error(data?.error || 'Error desconocido');
        setPreferenceId(data.preferenceId);
        setInitPoint(data.initPoint);
        setStep('wallet');
      }
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo procesar tu pedido. Intenta de nuevo.');
      setStep('error');
    }
  };

  const handleChange = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => { const n = { ...er }; delete n[field]; return n; });
  };

  return (
    <div className="buy-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="buy-modal-box">
        <button className="buy-modal-close" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Product strip */}
        <div className="buy-modal-product">
          {product.image_url && <img src={product.image_url} alt={product.name} />}
          <div className="buy-modal-product-info">
            <span className="buy-modal-product-name">{product.name}</span>
            <span className="buy-modal-product-price">${fmt(product.price)} COP</span>
          </div>
        </div>

        {/* Selector de método de pago */}
        {step === 'method' && (
          <div className="buy-modal-methods">
            <h2 className="buy-modal-title">¿Cómo quieres pagar?</h2>
            <button className="buy-method-btn buy-method-btn--mp" onClick={() => selectMethod('mp')}>
              <div className="buy-method-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div className="buy-method-info">
                <div className="buy-method-name-row">
                  <span className="buy-method-name">Mercado Pago</span>
                  <span className="buy-method-discount-badge">2% OFF</span>
                </div>
                <span className="buy-method-desc">Pagas <strong>${fmt(mpPrice)}</strong> — ahorras ${fmt(mpSaving)} COP</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button className="buy-method-btn" onClick={() => selectMethod('cod')}>
              <div className="buy-method-icon buy-method-icon--cod">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="buy-method-info">
                <span className="buy-method-name">Contraentrega</span>
                <span className="buy-method-desc">Paga en efectivo al recibir tu pedido</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <p className="buy-method-note">Envíos a ciudades principales de Colombia</p>
          </div>
        )}

        {/* Formulario */}
        {step === 'form' && (
          <form className="buy-modal-form" onSubmit={handleSubmit} noValidate>
            <div className="buy-modal-form-header">
              <button type="button" className="buy-modal-back" onClick={() => setStep('method')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h2 className="buy-modal-title">
                {paymentMethod === 'cod' ? 'Datos de entrega' : 'Datos del comprador'}
              </h2>
            </div>

            <div className="buy-modal-field">
              <label>Nombre completo *</label>
              <input type="text" placeholder="Ej. María García" value={form.name}
                onChange={handleChange('name')} className={errors.name ? 'buy-modal-input--error' : ''} />
              {errors.name && <span className="buy-modal-field-error">{errors.name}</span>}
            </div>
            <div className="buy-modal-field">
              <label>Correo electrónico *</label>
              <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                onChange={handleChange('email')} className={errors.email ? 'buy-modal-input--error' : ''} />
              {errors.email && <span className="buy-modal-field-error">{errors.email}</span>}
            </div>
            <div className="buy-modal-field">
              <label>Teléfono {paymentMethod === 'cod' ? '*' : '(opcional)'}</label>
              <input type="tel" placeholder="Ej. 3001234567" value={form.phone}
                onChange={handleChange('phone')} className={errors.phone ? 'buy-modal-input--error' : ''} />
              {errors.phone && <span className="buy-modal-field-error">{errors.phone}</span>}
            </div>

            {paymentMethod === 'cod' && (
              <div className="buy-modal-field">
                <label>Ciudad *</label>
                <select value={form.city} onChange={handleChange('city')}
                  className={errors.city ? 'buy-modal-input--error' : ''}>
                  <option value="">Selecciona tu ciudad</option>
                  {COD_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.city && <span className="buy-modal-field-error">{errors.city}</span>}
                <span className="buy-modal-city-note">
                  ¿No ves tu ciudad? Por ahora el pago contraentrega solo está disponible en las ciudades de la lista. Para el resto del país puedes usar{' '}
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
                Pagarás <strong>${fmt(product.price)} COP</strong> en efectivo al recibir tu pedido.
              </div>
            )}

            <button type="submit" className="buy-modal-submit">
              {paymentMethod === 'cod' ? 'Confirmar pedido' : 'Continuar al pago'}
            </button>
          </form>
        )}

        {step === 'loading' && (
          <div className="buy-modal-loading">
            <div className="buy-modal-spinner" />
            <p>{paymentMethod === 'cod' ? 'Registrando tu pedido…' : 'Preparando tu pago…'}</p>
          </div>
        )}

        {step === 'cod-success' && (
          <div className="buy-cod-success">
            <div className="buy-cod-success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 15 10"/>
              </svg>
            </div>
            <h2>¡Pedido registrado!</h2>
            <p>Nos comunicaremos contigo pronto para coordinar la entrega en <strong>{form.city}</strong>.</p>
            <div className="buy-cod-success-detail">
              <span>Producto</span><span>{product.name}</span>
              <span>Total a pagar</span><span>${fmt(product.price)} COP</span>
              <span>Ciudad</span><span>{form.city}</span>
            </div>
            <button className="buy-modal-submit" onClick={onClose}>Entendido</button>
          </div>
        )}

        {step === 'wallet' && initPoint && (
          <div className="buy-modal-wallet">
            <p className="buy-modal-wallet-hint">Tu pedido está listo. Haz clic para completar el pago de forma segura.</p>
            <a
              href={initPoint}
              target="_blank"
              rel="noopener noreferrer"
              className="buy-modal-mp-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
              Pagar con Mercado Pago
            </a>
            <p className="buy-modal-secure-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Pago seguro procesado por Mercado Pago
            </p>
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
const Gallery = ({ images, badges }) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const [fading, setFading] = useState(false);

    const goTo = (idx) => {
        if (idx === activeIdx) return;
        setFading(true);
        setTimeout(() => { setActiveIdx(idx); setFading(false); }, 220);
    };

    const prev = () => goTo((activeIdx - 1 + images.length) % images.length);
    const next = () => goTo((activeIdx + 1) % images.length);

    if (images.length === 0) {
        return (
            <div className="pg-gallery hero-anim" style={{ '--hero-delay': '0s' }}>
                <div className="pg-gallery-main">
                    <div className="product-page-placeholder"><span>✦</span></div>
                </div>
                {badges}
            </div>
        );
    }

    return (
        <div className="pg-gallery hero-anim" style={{ '--hero-delay': '0s' }}>
            <div className="pg-gallery-main">
                <img
                    src={images[activeIdx]}
                    alt={`Imagen ${activeIdx + 1}`}
                    style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.22s ease' }}
                />
                {badges}
                {images.length > 1 && (
                    <>
                        <button className="pg-gallery-nav pg-gallery-nav--prev" onClick={prev} aria-label="Anterior">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <button className="pg-gallery-nav pg-gallery-nav--next" onClick={next} aria-label="Siguiente">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {images.length > 1 && (
                <div className="pg-gallery-footer">
                    <div className="pg-gallery-thumbs">
                        {images.map((url, i) => (
                            <button
                                key={i}
                                className={`pg-gallery-thumb ${i === activeIdx ? 'pg-gallery-thumb--active' : ''}`}
                                onClick={() => goTo(i)}
                                aria-label={`Imagen ${i + 1}`}
                            >
                                <img src={url} alt="" />
                            </button>
                        ))}
                    </div>
                    <span className="pg-gallery-counter">{activeIdx + 1} / {images.length}</span>
                </div>
            )}
        </div>
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

    useEffect(() => {
        if (!loading && product && searchParams.get('buy') === '1') {
            setShowBuyModal(true);
        }
    }, [loading, product, searchParams]);

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

    const waLink = waUrl(`Hola! Vi la pieza "${product.name}" en su tienda ($ ${fmt(product.price)} COP) y me encantó. ¿Tienen disponibilidad? 💎`);

    const badges = (
        <div className="product-page-badges">
            {product.is_new      && <span className="product-badge product-badge--new">Nuevo</span>}
            {product.is_featured && <span className="product-badge product-badge--featured">✦ Destacado</span>}
        </div>
    );

    return (
        <div className="product-page">
            {showBuyModal && <BuyModal product={product} onClose={() => setShowBuyModal(false)} />}

            {/* Back link */}
            <div className="container">
                <div className="product-page-back-wrap">
                    <Link to="/catalogo" className="product-page-back">
                        ← Volver al catálogo
                    </Link>
                </div>
            </div>

            {/* Hero */}
            <div className="product-page-hero section-with-borders">
                <div className="container">
                    <div className="product-page-grid">

                        {/* Mobile only: category + name above gallery */}
                        <div className="pp-mobile-header">
                            <span className="section-label">{product.category}</span>
                            <h1 className="product-page-name pp-mobile-name">{product.name}</h1>
                        </div>

                        <Gallery images={allImages} badges={badges} />

                        {/* Info */}
                        <div className="product-page-info">
                            <span className="section-label hero-anim pp-desktop-only" style={{ '--hero-delay': '0.1s' }}>
                                {product.category}
                            </span>

                            <h1 className="product-page-name pp-desktop-only">
                                {product.name.split(' ').reduce((acc, word, i) => {
                                    const lineIndex = Math.floor(i / 3);
                                    if (!acc[lineIndex]) acc[lineIndex] = [];
                                    acc[lineIndex].push(word);
                                    return acc;
                                }, []).map((words, i) => (
                                    <div key={i} className="hero-line" style={{ '--line-delay': `${0.18 + i * 0.14}s` }}>
                                        <span>{words.join(' ')}</span>
                                    </div>
                                ))}
                            </h1>

                            {product.description && (
                                <p className="product-page-desc hero-anim" style={{ '--hero-delay': '0.5s' }}>
                                    {product.description}
                                </p>
                            )}

                            {product.compare_price && product.compare_price > product.price ? (
                                /* ── Bloque oferta ── */
                                <div className="pp-offer hero-anim" style={{ '--hero-delay': '0.58s' }}>
                                    <div className="pp-offer-header">
                                        <span className="pp-offer-badge">🔥 Oferta especial</span>
                                        <span className="pp-offer-discount">
                                            -{Math.round((1 - product.price / product.compare_price) * 100)}%
                                        </span>
                                    </div>

                                    <div className="pp-offer-prices">
                                        <div className="pp-offer-before">
                                            <span className="pp-offer-before-label">Antes</span>
                                            <span className="pp-offer-before-value">${fmt(product.compare_price)}</span>
                                        </div>
                                        <div className="pp-offer-now">
                                            <span className="pp-offer-now-label">Ahora</span>
                                            <span className="pp-offer-now-value">${fmt(product.price)}</span>
                                            <span className="pp-offer-now-currency">COP</span>
                                        </div>
                                    </div>

                                    <span className="pp-offer-savings">
                                        Ahorras ${fmt(product.compare_price - product.price)} COP
                                    </span>

                                    {timeLeft && (
                                        <div className="pp-countdown">
                                            <span className="pp-countdown-title">⏱ Oferta termina en</span>
                                            <div className="pp-countdown-units">
                                                <div className="pp-countdown-unit">
                                                    <span className="pp-countdown-num">{pad(timeLeft.hours)}</span>
                                                    <span className="pp-countdown-lbl">HRS</span>
                                                </div>
                                                <span className="pp-countdown-sep">:</span>
                                                <div className="pp-countdown-unit">
                                                    <span className="pp-countdown-num">{pad(timeLeft.minutes)}</span>
                                                    <span className="pp-countdown-lbl">MIN</span>
                                                </div>
                                                <span className="pp-countdown-sep">:</span>
                                                <div className="pp-countdown-unit">
                                                    <span className="pp-countdown-num">{pad(timeLeft.seconds)}</span>
                                                    <span className="pp-countdown-lbl">SEG</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Precio normal ── */
                                <div className="product-page-price hero-anim" style={{ '--hero-delay': '0.62s' }}>
                                    <span className="product-page-price-label">Precio</span>
                                    <span className="product-page-price-value">${fmt(product.price)}</span>
                                    <span className="product-page-price-currency">COP</span>
                                </div>
                            )}

                            <div className="product-page-actions hero-anim" style={{ '--hero-delay': '0.75s' }}>
                                <button
                                    className="product-page-btn product-page-btn--buy"
                                    onClick={() => setShowBuyModal(true)}
                                >
                                    Comprar ahora
                                </button>
                                <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="product-page-btn product-page-btn--wa"
                                    title="Consultar por WhatsApp"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    Consultar
                                </a>
                            </div>

                            <PaymentMethods />

                            <div className="product-page-meta hero-anim" style={{ '--hero-delay': '0.88s' }}>
                                <div className="product-page-meta-item">
                                    <span>✦</span> Pieza artesanal de autor
                                </div>
                                <div className="product-page-meta-item">
                                    <span>✦</span> Envío a toda Colombia
                                </div>
                                <div className="product-page-meta-item">
                                    <span>✦</span> Garantía de calidad
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }} />
            </div>

            {/* Related products */}
            {related.length > 0 && (
                <div className="product-page-related">
                    <div className="container">
                        <span className="section-label">También te puede interesar</span>
                        <div className="product-page-related-grid">
                            {related.map(p => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductPage;

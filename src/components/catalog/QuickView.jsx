import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { waUrl } from '../../lib/whatsapp';

const fmt = (price) => price?.toLocaleString('es-CO');

const QuickView = ({ product, onClose }) => {
    const [imgIdx, setImgIdx] = useState(0);

    const images = product.images?.length ? product.images
        : product.image_url ? [product.image_url] : [];

    const waLink = waUrl({
        mobile: `Hola! 😊 Vi esta pieza en su tienda y me encantó:\n\n✨ *${product.name}*\n💰 Precio: $${fmt(product.price)} COP\n\nMe gustaría saber si está disponible 🙏`,
        desktop: `Hola! Vi esta pieza en su tienda y me encantó:\n\n- *${product.name}*\n- Precio: $${fmt(product.price)} COP\n\nMe gustaría saber si está disponible.`,
    });

    // Cierra con Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const discount = product.compare_price && product.compare_price > product.price
        ? Math.round((1 - product.price / product.compare_price) * 100)
        : null;

    return (
        <div className="qv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="qv-modal">
                <button className="qv-close" onClick={onClose} aria-label="Cerrar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                <div className="qv-body">
                    {/* Galería */}
                    <div className="qv-gallery">
                        <div className="qv-main-img">
                            {images[imgIdx]
                                ? <img src={images[imgIdx]} alt={product.name} />
                                : <div className="qv-placeholder">✦</div>
                            }
                            {discount && <span className="qv-discount-badge">-{discount}%</span>}
                        </div>
                        {images.length > 1 && (
                            <div className="qv-thumbs">
                                {images.map((url, i) => (
                                    <button
                                        key={i}
                                        className={`qv-thumb ${i === imgIdx ? 'qv-thumb--active' : ''}`}
                                        onClick={() => setImgIdx(i)}
                                    >
                                        <img src={url} alt="" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="qv-info">
                        <span className="qv-category">{product.category}</span>
                        <h2 className="qv-name">{product.name}</h2>

                        <div className="qv-price-row">
                            {product.compare_price && product.compare_price > product.price && (
                                <span className="qv-compare">${fmt(product.compare_price)}</span>
                            )}
                            <span className="qv-price">${fmt(product.price)}</span>
                            <span className="qv-currency">COP</span>
                        </div>

                        {product.description && (
                            <p className="qv-desc">{product.description}</p>
                        )}

                        <div className="qv-trust">
                            <span>✓ Certificado de autenticidad</span>
                            <span>✓ Envío a toda Colombia</span>
                        </div>

                        <div className="qv-actions">
                            <Link
                                to={`/catalogo/${product.id}?buy=1`}
                                className="qv-btn qv-btn--buy"
                                onClick={onClose}
                            >
                                Comprar ahora
                            </Link>
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="qv-btn qv-btn--wa"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                WhatsApp
                            </a>
                        </div>

                        <Link to={`/catalogo/${product.id}`} className="qv-detail-link" onClick={onClose}>
                            Ver todos los detalles →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickView;

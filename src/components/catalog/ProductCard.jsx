import React from 'react';
import { Link } from 'react-router-dom';
import { waUrl } from '../../lib/whatsapp';

const fmt = (price) => price?.toLocaleString('es-CO');

const ProductCard = ({ product }) => {
    const waLink  = waUrl(`Hola! Me interesa la pieza "${product.name}" ($ ${fmt(product.price)} COP). ¿Tienen disponibilidad? 💍`);
    const buyLink = waUrl(`Hola! Quiero comprar la pieza "${product.name}" ($ ${fmt(product.price)} COP). ¿Cómo procedo? 🛍️`);

    return (
        <Link to={`/catalogo/${product.id}`} className="product-card">
            <div className="product-card-image">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} />
                ) : (
                    <div className="product-card-placeholder">
                        <span>✦</span>
                    </div>
                )}
                <div className="product-card-overlay">
                    <span className="product-card-cta">Ver pieza</span>
                </div>
                <div className="product-card-badges">
                    {product.is_new && <span className="product-badge product-badge--new">Nuevo</span>}
                    {product.is_featured && <span className="product-badge product-badge--featured">✦ Destacado</span>}
                    {product.compare_price && product.compare_price > product.price && (
                        <span className="product-badge product-badge--discount">
                            -{Math.round((1 - product.price / product.compare_price) * 100)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="product-card-info">
                <p className="product-card-category">{product.category}</p>
                <h3 className="product-card-name">{product.name}</h3>
                {product.description && (
                    <p className="product-card-desc">{product.description}</p>
                )}
                <div className="product-card-price-row">
                    {product.compare_price && product.compare_price > product.price && (
                        <span className="product-card-compare">${fmt(product.compare_price)}</span>
                    )}
                    <p className="product-card-price">${fmt(product.price)}</p>
                </div>

                <div className="product-card-actions">
                    <a
                        href={buyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-card-btn product-card-btn--buy"
                        onClick={e => e.stopPropagation()}
                    >
                        Comprar
                    </a>
                    <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-card-btn product-card-btn--wa"
                        title="Consultar por WhatsApp"
                        onClick={e => e.stopPropagation()}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                    </a>
                </div>
            </div>
        </Link>
    );
};

export default ProductCard;

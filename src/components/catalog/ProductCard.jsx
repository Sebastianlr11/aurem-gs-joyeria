import React from 'react';
import { Link } from 'react-router-dom';
import { waUrl } from '../../lib/whatsapp';

const fmt = (price) => Number(price || 0).toLocaleString('es-CO');

/* La insignia dice una sola cosa, la más urgente: primero que queda poco,
   después el descuento, y solo si no hay nada de eso, que es nueva. */
const insignia = (p) => {
    if (p.stock === 0) return 'Agotada';
    if (p.stock === 1) return 'Última unidad';
    if (p.compare_price && p.compare_price > p.price) {
        return `-${Math.round((1 - p.price / p.compare_price) * 100)}%`;
    }
    if (p.is_new) return 'Nuevo';
    return null;
};

const WhatsAppIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" />
    </svg>
);

const ProductCard = ({ product }) => {
    const marca = insignia(product);
    const agotada = product.stock === 0;

    const waLink = waUrl({
        mobile: `Hola! 👋 Vi esta pieza en su tienda: *${product.name}*${product.description ? ` (${product.description})` : ''} — $${fmt(product.price)} COP. Me gustaría saber si está disponible ✨`,
        desktop: `Hola! Vi esta pieza en su tienda: *${product.name}*${product.description ? ` (${product.description})` : ''} — $${fmt(product.price)} COP. Me gustaría saber si está disponible.`,
    });

    return (
        <article className="pieza">
            <Link to={`/catalogo/${product.id}`} className="pieza-foto" aria-label={`Ver ${product.name}`}>
                {product.image_url
                    ? <img src={product.image_url} alt={product.name} loading="lazy" />
                    : <span className="pieza-foto-vacia">✦</span>}
                {marca && (
                    <span className={`pieza-insignia ${agotada ? 'pieza-insignia--agotada' : ''}`}>{marca}</span>
                )}
            </Link>

            <div className="pieza-cuerpo">
                <span className="pieza-categoria">{product.category}</span>
                <h3 className="pieza-nombre">{product.name}</h3>
                {product.description && <p className="pieza-spec">{product.description}</p>}
            </div>

            <div className="pieza-pie">
                <div className="pieza-precio-fila">
                    {product.compare_price && product.compare_price > product.price && (
                        <span className="pieza-precio-antes">${fmt(product.compare_price)}</span>
                    )}
                    <span className="pieza-precio">${fmt(product.price)}</span>
                    <span className="pieza-moneda">COP</span>
                </div>
                <div className="pieza-acciones">
                    <Link to={`/catalogo/${product.id}`} className="pieza-btn">Ver la pieza</Link>
                    <a
                        className="pieza-wa"
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Consultar por WhatsApp"
                        aria-label={`Consultar ${product.name} por WhatsApp`}
                    >
                        <WhatsAppIcon />
                    </a>
                </div>
            </div>
        </article>
    );
};

export default ProductCard;

/**
 * Panel · Productos — El catálogo: alta, edición y borrado de piezas.
 *
 * Salió de Dashboard.jsx el 23 de agosto de 2026 con los ayudantes que sólo usa
 * esta pantalla. El código se movió tal cual: lo que comparte con otras
 * secciones vive en `comunes.jsx`.
 */
import React, { useState } from 'react';
import { refDe } from '../../../lib/referencia';
import ProductModal from '../ProductModal';
import EliminarPieza from '../EliminarPieza';
import { fmt } from './comunes';
import { CATEGORIAS as CATEGORIES } from '../../../lib/categorias';

const ORDENES = {
    recientes: { label: 'Más recientes', fn: null },
    mayor: { label: 'Precio: mayor a menor', fn: (a, b) => b.price - a.price },
    menor: { label: 'Precio: menor a mayor', fn: (a, b) => a.price - b.price },
    stock: { label: 'Menos stock primero', fn: (a, b) => (a.stock ?? 99) - (b.stock ?? 99) },
};

const PIcon = ({ name, size = 16 }) => {
    const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (name) {
        case 'plus': return <svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
        case 'search': return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
        case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
        case 'rows': return <svg {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
        case 'export': return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
        case 'arrow': return <svg {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
        case 'trash': return <svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
        case 'package': return <svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
        case 'cash': return <svg {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
        case 'medal': return <svg {...p}><circle cx="12" cy="8" r="6" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>;
        default: return null;
    }
};

const PRODUCTS_PER_PAGE = 12;

const inventarioDe = (p) => {
    if (p.stock === null || p.stock === undefined) return { texto: 'Sin anotar', tono: 'gris' };
    if (p.stock === 0) return { texto: 'Sin unidades', tono: 'agotado' };
    if (p.stock === 1) return { texto: '1 unidad disponible', tono: 'poco' };
    return { texto: `${p.stock} unidades disponibles`, tono: 'ok' };
};

const ProductsSection = ({ products, loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('Todos');
    const [orden, setOrden] = useState('recientes');
    const [vista, setVista] = useState('cuadricula');
    const [modal, setModal] = useState(null);
    const [page, setPage] = useState(1);

    const closeModal = () => setModal(null);
    const afterSave = () => { closeModal(); onRefresh(); };

    const visible = (() => {
        const term = search.trim().toLowerCase();
        const lista = products.filter(p => {
            const matchCat = filterCat === 'Todos' || p.category === filterCat;
            const matchSearch = !term
                || p.name.toLowerCase().includes(term)
                || refDe(p).toLowerCase().includes(term)
                || (p.description || '').toLowerCase().includes(term);
            return matchCat && matchSearch;
        });
        const fn = ORDENES[orden].fn;
        return fn ? [...lista].sort(fn) : lista;
    })();

    const totalPages = Math.ceil(visible.length / PRODUCTS_PER_PAGE);
    const paginated = visible.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

    const setFilterAndReset = (cat) => { setFilterCat(cat); setPage(1); };
    const setSearchAndReset = (v) => { setSearch(v); setPage(1); };

    const agotadas = products.filter(p => p.stock === 0).length;
    const enOferta = products.filter(p => p.compare_price && p.compare_price > p.price).length;
    const valorCatalogo = products.reduce((s, p) => s + Number(p.price || 0), 0);

    /* Exporta lo que hay en pantalla, con los filtros aplicados. */
    const exportarCSV = () => {
        const filas = [
            ['Referencia', 'Nombre', 'Categoría', 'Precio', 'Precio anterior', 'Inventario'],
            ...visible.map(p => [
                refDe(p), p.name, p.category, p.price, p.compare_price || '',
                p.stock === null || p.stock === undefined ? 'Sin anotar' : p.stock,
            ]),
        ];
        const csv = filas
            .map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `catalogo-aurem-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const etiquetas = (p) => {
        const t = [];
        if (p.is_new) t.push({ label: 'Nuevo', cls: 'prod-tag--nuevo' });
        if (p.compare_price && p.compare_price > p.price) {
            t.push({ label: `−${Math.round((1 - p.price / p.compare_price) * 100)}%`, cls: 'prod-tag--oferta' });
        }
        if (p.stock === 0) t.push({ label: 'Agotado', cls: 'prod-tag--agotado' });
        return t;
    };

    return (
        <div className="admin-section">
            <div className="prod-head">
                <div>
                    <h1 className="prod-titulo">Productos</h1>
                    <p className="prod-sub">
                        {products.length} pieza{products.length !== 1 ? 's' : ''} en el catálogo
                        {agotadas > 0 && ` · ${agotadas} agotada${agotadas !== 1 ? 's' : ''}`}
                        {enOferta > 0 && ` · ${enOferta} en oferta`}
                    </p>
                </div>
                <div className="prod-head-acciones">
                    <button className="prod-btn-linea" onClick={exportarCSV} disabled={visible.length === 0}>
                        <PIcon name="export" /> Exportar catálogo
                    </button>
                    <button className="prod-btn-ink" onClick={() => setModal({ type: 'add' })}>
                        <PIcon name="plus" /> Nuevo producto
                    </button>
                </div>
            </div>

            <div className="prod-metricas">
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="package" size={18} /></span>
                    <span className="prod-metrica-v">{products.length}</span>
                    <span className="prod-metrica-l">Piezas publicadas</span>
                </div>
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="cash" size={18} /></span>
                    <span className="prod-metrica-v">${fmt(valorCatalogo)}</span>
                    <span className="prod-metrica-l">Valor del catálogo</span>
                </div>
                <div className="prod-metrica">
                    <span className="prod-metrica-icono"><PIcon name="medal" size={18} /></span>
                    <span className="prod-metrica-v">{enOferta}</span>
                    <span className="prod-metrica-l">Con precio de oferta</span>
                </div>
            </div>

            <div className="prod-panel">
                <div className="prod-toolbar">
                    <div className="riel" role="group" aria-label="Categorías">
                        {['Todos', ...CATEGORIES].map(c => {
                            const n = c === 'Todos' ? products.length : products.filter(p => p.category === c).length;
                            const vacia = n === 0;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    className={`riel-btn ${filterCat === c ? 'riel-btn--on' : ''} ${vacia ? 'riel-btn--vacia' : ''}`}
                                    aria-pressed={filterCat === c}
                                    disabled={vacia}
                                    onClick={vacia ? undefined : () => setFilterAndReset(c)}
                                >
                                    <span>{c}</span>
                                    <span className="riel-n">{n}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="prod-herramientas">
                        <label className="prod-buscar">
                            <PIcon name="search" size={15} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o referencia"
                                value={search}
                                onChange={e => setSearchAndReset(e.target.value)}
                            />
                        </label>
                        <select className="prod-orden" value={orden} onChange={e => setOrden(e.target.value)}>
                            {Object.entries(ORDENES).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                        <div className="prod-vista">
                            <button
                                className={`prod-vista-btn ${vista === 'cuadricula' ? 'prod-vista-btn--on' : ''}`}
                                onClick={() => setVista('cuadricula')}
                                title="Cuadrícula"
                                aria-label="Ver en cuadrícula"
                            >
                                <PIcon name="grid" size={15} />
                            </button>
                            <button
                                className={`prod-vista-btn ${vista === 'tabla' ? 'prod-vista-btn--on' : ''}`}
                                onClick={() => setVista('tabla')}
                                title="Tabla"
                                aria-label="Ver en tabla"
                            >
                                <PIcon name="rows" size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="admin-loading">Cargando productos…</div>
                ) : visible.length === 0 ? (
                    <div className="prod-vacio">
                        <span className="prod-vacio-t">Sin resultados</span>
                        <span className="prod-vacio-s">
                            {products.length === 0
                                ? 'Todavía no hay piezas publicadas.'
                                : 'Prueba con otra categoría o busca otro término.'}
                        </span>
                        <button className="prod-btn-ink" onClick={() => setModal({ type: 'add' })}>
                            <PIcon name="plus" /> Nuevo producto
                        </button>
                    </div>
                ) : vista === 'cuadricula' ? (
                    <div className="prod-grid">
                        {paginated.map(p => {
                            const inv = inventarioDe(p);
                            return (
                                <article key={p.id} className="prod-card">
                                    <div className="prod-card-foto">
                                        {p.image_url
                                            ? <img src={p.image_url} alt={p.name} loading="lazy" />
                                            : <span className="prod-card-foto-vacia">✦</span>}
                                        <div className="prod-card-tags">
                                            {etiquetas(p).map(t => (
                                                <span key={t.label} className={`prod-tag ${t.cls}`}>{t.label}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="prod-card-cuerpo">
                                        <div className="prod-card-meta">
                                            <span className="prod-card-cat">{p.category}</span>
                                            <span className="prod-card-ref">{refDe(p)}</span>
                                        </div>
                                        <h4 className="prod-card-nombre">{p.name}</h4>
                                        {p.description && <p className="prod-card-detalle">{p.description}</p>}
                                        <div className="prod-card-precio">
                                            <span className="prod-card-precio-v">${fmt(p.price)}</span>
                                            <span className="prod-card-precio-m">COP</span>
                                            {p.compare_price && p.compare_price > p.price && (
                                                <span className="prod-card-precio-antes">${fmt(p.compare_price)}</span>
                                            )}
                                        </div>
                                        <div className="prod-card-stock">
                                            <span className={`prod-punto prod-punto--${inv.tono}`} />
                                            <span>{inv.texto}</span>
                                        </div>
                                        <div className="prod-card-acciones">
                                            <button className="prod-card-editar" onClick={() => setModal({ type: 'edit', product: p })}>
                                                Editar
                                            </button>
                                            <a
                                                className="prod-card-icono"
                                                href={`/catalogo/${p.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Ver en la tienda"
                                            >
                                                <PIcon name="arrow" />
                                            </a>
                                            <button
                                                className="prod-card-icono prod-card-icono--borrar"
                                                onClick={() => setModal({ type: 'delete', product: p })}
                                                title="Retirar del catálogo"
                                            >
                                                <PIcon name="trash" />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        <button className="prod-nueva" onClick={() => setModal({ type: 'add' })}>
                            <span className="prod-nueva-icono"><PIcon name="plus" size={20} /></span>
                            <span className="prod-nueva-t">Añadir una pieza</span>
                            <span className="prod-nueva-s">Fotos en 4:5, metal, ley y precio en pesos</span>
                        </button>
                    </div>
                ) : (
                    <div className="prod-tabla-wrap">
                        <table className="prod-tabla">
                            <thead>
                                <tr>
                                    <th>Pieza</th>
                                    <th>Categoría</th>
                                    <th>Precio</th>
                                    <th>Inventario</th>
                                    <th>Estado</th>
                                    <th className="prod-th-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(p => {
                                    const inv = inventarioDe(p);
                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="prod-fila-pieza">
                                                    <span className="prod-fila-foto">
                                                        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : '✦'}
                                                    </span>
                                                    <div>
                                                        <span className="prod-fila-nombre">{p.name}</span>
                                                        <span className="prod-fila-meta">
                                                            {refDe(p)}{p.description ? ` · ${p.description}` : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{p.category}</td>
                                            <td>
                                                <div className="prod-fila-precio">
                                                    <span>${fmt(p.price)}</span>
                                                    {p.compare_price && p.compare_price > p.price && (
                                                        <span className="prod-card-precio-antes">${fmt(p.compare_price)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{inv.texto}</td>
                                            <td>
                                                <span className={`prod-estado prod-estado--${p.stock === 0 ? 'agotado' : 'publicado'}`}>
                                                    {p.stock === 0 ? 'Agotado' : 'Publicado'}
                                                </span>
                                            </td>
                                            <td className="prod-th-right">
                                                <button className="prod-btn-linea prod-btn-linea--sm" onClick={() => setModal({ type: 'edit', product: p })}>
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                            <button key={n} className={`pagination-num${n === page ? ' pagination-num--active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                        ))}
                        <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <span className="pagination-info">{visible.length} pieza{visible.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {modal?.type === 'add' && <ProductModal onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'edit' && <ProductModal product={modal.product} onClose={closeModal} onSaved={afterSave} />}
            {modal?.type === 'delete' && (
                <EliminarPieza
                    product={modal.product}
                    onClose={closeModal}
                    onDeleted={afterSave}
                />
            )}
        </div>
    );
};

/* ─── OrdersSection ──────────────────────────────────────────────── */

export default ProductsSection;

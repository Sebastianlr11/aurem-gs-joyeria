import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/catalog/ProductCard';
import { supabase } from '../lib/supabase';

const CATEGORIAS = ['Todos', 'Anillos', 'Collares', 'Aretes', 'Pulseras', 'Dijes'];

const RANGOS = [
    { label: 'Todos', min: 0, max: Infinity },
    { label: 'Hasta $300K', min: 0, max: 300000 },
    { label: '$300K – $600K', min: 300000, max: 600000 },
    { label: '+$600K', min: 600000, max: Infinity },
];

const PROMESAS = [
    { titulo: 'Envío a todo el país', valor: '24 a 48 horas hábiles' },
    { titulo: 'Forma de pago', valor: 'Pagas al recibir' },
    { titulo: 'Cada pieza incluye', valor: 'Certificado y garantía' },
];

const PER_PAGE = 8;

const Catalog = () => {
    const [searchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoria, setCategoria] = useState(searchParams.get('categoria') || 'Todos');
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('newest');
    const [rango, setRango] = useState(0);
    const [pagina, setPagina] = useState(1);

    /* Se traen todas las piezas de una vez: el catálogo es pequeño y así
       los chips pueden mostrar cuántas hay en cada categoría. */
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (!error) setProducts(data || []);
            setLoading(false);
        };
        fetchProducts();
    }, []);

    const conteoPorCategoria = useMemo(() => {
        const mapa = { Todos: products.length };
        CATEGORIAS.slice(1).forEach(c => {
            mapa[c] = products.filter(p => p.category === c).length;
        });
        return mapa;
    }, [products]);

    const filtradas = useMemo(() => {
        const { min, max } = RANGOS[rango];
        const q = busqueda.trim().toLowerCase();
        const result = products.filter(p => {
            const matchCat = categoria === 'Todos' || p.category === categoria;
            const matchBusqueda = !q ||
                p.name.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q);
            const matchPrecio = p.price >= min && p.price <= max;
            return matchCat && matchBusqueda && matchPrecio;
        });

        if (orden === 'price_asc') result.sort((a, b) => a.price - b.price);
        if (orden === 'price_desc') result.sort((a, b) => b.price - a.price);

        return result;
    }, [products, categoria, busqueda, orden, rango]);

    const visibles = filtradas.slice(0, pagina * PER_PAGE);

    return (
        <main className="catalogo">

            <header className="catalogo-head container">
                <div className="catalogo-head-texto">
                    <p className="eyebrow">Colección</p>
                    <h1 className="catalogo-titulo">
                        Nuestras piezas,
                        <em>una por una.</em>
                    </h1>
                    <p className="catalogo-lead">
                        Plata ley 925, oro 18k y esmeralda colombiana natural. Cada pieza se fotografía
                        como llega a tus manos.
                    </p>
                </div>

                <div className="catalogo-promesas">
                    {PROMESAS.map(p => (
                        <div key={p.titulo} className="catalogo-promesa">
                            <span className="catalogo-promesa-titulo">{p.titulo}</span>
                            <span className="catalogo-promesa-valor">{p.valor}</span>
                        </div>
                    ))}
                </div>
            </header>

            <div className="catalogo-filtros">
                <div className="container catalogo-filtros-fila">
                    {/* Riel segmentado: una sola fila, una sola activa. Las categorías
                        sin piezas conservan su etiqueta —el conteo ya lo dice— pero
                        se les quita el toque. */}
                    <div className="catalogo-riel" role="group" aria-label="Categorías">
                        {CATEGORIAS.map(c => {
                            const n = conteoPorCategoria[c] ?? 0;
                            const vacia = n === 0;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    className={`catalogo-riel-btn ${categoria === c ? 'catalogo-riel-btn--on' : ''} ${vacia ? 'catalogo-riel-btn--vacia' : ''}`}
                                    aria-pressed={categoria === c}
                                    disabled={vacia}
                                    onClick={vacia ? undefined : () => { setCategoria(c); setPagina(1); }}
                                >
                                    <span>{c}</span>
                                    <span className="catalogo-riel-n">{n}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="catalogo-herramientas">
                        <div className="catalogo-buscar">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar pieza"
                                value={busqueda}
                                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                                aria-label="Buscar pieza"
                            />
                        </div>
                        <select
                            className="catalogo-orden"
                            value={orden}
                            onChange={e => setOrden(e.target.value)}
                            aria-label="Ordenar"
                        >
                            <option value="newest">Más recientes</option>
                            <option value="price_asc">Precio: menor a mayor</option>
                            <option value="price_desc">Precio: mayor a menor</option>
                        </select>
                    </div>
                </div>

                <div className="container catalogo-filtros-fila catalogo-filtros-fila--precio">
                    <span className="catalogo-precio-label">Precio</span>
                    <div className="catalogo-riel" role="group" aria-label="Rango de precio">
                        {RANGOS.map((r, i) => (
                            <button
                                key={r.label}
                                type="button"
                                className={`catalogo-riel-btn ${rango === i ? 'catalogo-riel-btn--on' : ''}`}
                                aria-pressed={rango === i}
                                onClick={() => { setRango(i); setPagina(1); }}
                            >
                                <span>{r.label}</span>
                            </button>
                        ))}
                    </div>
                    <span className="catalogo-conteo">
                        {loading ? 'Cargando…' : `${filtradas.length} pieza${filtradas.length !== 1 ? 's' : ''}`}
                    </span>
                </div>
            </div>

            <section className="container catalogo-cuerpo">
                {loading ? (
                    <div className="catalogo-grid">
                        {[...Array(8)].map((_, i) => <div key={i} className="pieza-esqueleto" />)}
                    </div>
                ) : filtradas.length === 0 ? (
                    <div className="catalogo-vacio">
                        <span className="catalogo-vacio-icono">✦</span>
                        <p className="catalogo-vacio-titulo">Sin resultados</p>
                        <p className="catalogo-vacio-texto">Prueba con otra categoría o busca otro término.</p>
                    </div>
                ) : (
                    <>
                        <div className="catalogo-grid">
                            {visibles.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>

                        {visibles.length < filtradas.length && (
                            <div className="catalogo-mas">
                                <button className="catalogo-mas-btn" onClick={() => setPagina(p => p + 1)}>
                                    <span>Ver más piezas</span>
                                    <span className="catalogo-mas-progreso">{visibles.length} de {filtradas.length}</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </main>
    );
};

export default Catalog;

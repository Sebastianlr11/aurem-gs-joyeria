import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterBar from '../components/catalog/FilterBar';
import ProductCard from '../components/catalog/ProductCard';
import { supabase } from '../lib/supabase';

const Catalog = () => {
    const [searchParams] = useSearchParams();
    const initialCategory = searchParams.get('categoria') || 'Todos';

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            let query = supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (activeCategory !== 'Todos') {
                query = query.eq('category', activeCategory);
            }

            const { data, error } = await query;
            if (!error) setProducts(data || []);
            setLoading(false);
        };
        fetchProducts();
    }, [activeCategory]);

    const filtered = useMemo(() => {
        let result = search.trim()
            ? products.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(search.toLowerCase())
            )
            : [...products];

        if (sort === 'price_asc')  result.sort((a, b) => a.price - b.price);
        if (sort === 'price_desc') result.sort((a, b) => b.price - a.price);
        // 'newest' ya viene ordenado por created_at desc desde Supabase

        return result;
    }, [products, search, sort]);

    return (
        <main className="catalog-page">
            {/* Header */}
            <div className="catalog-header section-with-borders">
                <div className="container">
                    <span className="section-label">Colección</span>
                    <h1 className="catalog-title">Nuestras Piezas</h1>
                    <p className="catalog-subtitle">
                        Cada joya es única — diseñada con precisión, elaborada con pasión.
                    </p>
                </div>
                <div className="horizontal-divider" style={{ position: 'absolute', bottom: 0, left: 0 }} />
            </div>

            <div className="container">
                {/* Toolbar */}
                <div className="catalog-toolbar">
                    <div className="catalog-toolbar-left">
                        <FilterBar
                            active={activeCategory}
                            onChange={val => { setActiveCategory(val); setSearch(''); }}
                        />
                    </div>
                    <div className="catalog-toolbar-right">
                        <div className="catalog-search-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input
                                className="catalog-search"
                                type="text"
                                placeholder="Buscar pieza..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="catalog-sort"
                            value={sort}
                            onChange={e => setSort(e.target.value)}
                        >
                            <option value="newest">Más recientes</option>
                            <option value="price_asc">Precio: menor a mayor</option>
                            <option value="price_desc">Precio: mayor a menor</option>
                        </select>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="catalog-grid">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="product-card-skeleton" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="catalog-empty">
                        <div className="catalog-empty-icon">✦</div>
                        <p className="catalog-empty-title">Sin resultados</p>
                        <p className="catalog-empty-sub">Prueba con otra categoría o busca otro término.</p>
                    </div>
                ) : (
                    <>
                        <p className="catalog-count">{filtered.length} pieza{filtered.length !== 1 ? 's' : ''}</p>
                        <div className="catalog-grid">
                            {filtered.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default Catalog;

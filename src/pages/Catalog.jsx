import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/catalog/ProductCard';
import { supabase } from '../lib/supabase';
import { waUrl } from '../lib/whatsapp';
import { ponerMeta } from '../lib/meta';

const CATEGORIAS = ['Todos', 'Anillos', 'Collares', 'Aretes', 'Pulseras', 'Dijes'];

const RANGOS = [
    { label: 'Todos', min: 0, max: Infinity },
    { label: 'Hasta $300K', min: 0, max: 300000 },
    { label: '$300K – $600K', min: 300000, max: 600000 },
    { label: '+$600K', min: 600000, max: Infinity },
];

const PROMESAS = [
    { titulo: 'Envío a todo el país', valor: '24 a 48 h Bogotá · 2 a 3 días resto' },
    { titulo: 'Forma de pago', valor: 'Contraentrega en Bogotá' },
    /* El certificado NO está incluido: cuesta $50.000 aparte. Esta franja es
       de lo que se cumple siempre. */
    { titulo: 'Cada pieza incluye', valor: 'Estuche y garantía' },
];

const ORDENES = [
    { v: 'newest', label: 'Más recientes', corto: 'Más recientes' },
    { v: 'price_asc', label: 'Precio: menor a mayor', corto: 'Menor precio' },
    { v: 'price_desc', label: 'Precio: mayor a menor', corto: 'Mayor precio' },
];

const PER_PAGE = 8;

const Catalog = () => {
    const [searchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    /* Que la consulta falle y que el taller no tenga piezas son cosas
       distintas y la pantalla tiene que decirlo. Sin esto, un corte de red
       le anuncia a la clienta que no hay inventario. */
    const [fallo, setFallo] = useState(false);
    const [categoria, setCategoria] = useState(searchParams.get('categoria') || 'Todos');
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('newest');
    const [rango, setRango] = useState(0);
    const [metal, setMetal] = useState('Todos');
    const [pagina, setPagina] = useState(1);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
    const panelRef = useRef(null);
    /* Quién tenía el foco antes de abrir el panel, para devolvérselo al
       cerrar. Sin esto, quien navega con teclado cierra el panel y aparece
       al principio de la página. */
    const focoPrevioRef = useRef(null);

    /* El catálogo tiene su propio título y su propia canónica. Sin esto
       comparte los de la home, y para Google son la misma página. */
    useEffect(() => ponerMeta({
        titulo: 'Catálogo de joyas con esmeralda colombiana | Aurem Gs',
        descripcion: 'Anillos y dijes en plata 925 y oro 18k con esmeralda colombiana natural. Cada pieza se fotografía como llega a tus manos. Estuche incluido y garantía en el metal.',
        ruta: '/catalogo',
    }), []);

    /* Se traen todas las piezas de una vez: el catálogo es pequeño y así
       los chips pueden mostrar cuántas hay en cada categoría. */
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.error('No se pudo cargar el catálogo:', error.message);
                setFallo(true);
            } else {
                setProducts(data || []);
                setFallo(false);
            }
            setLoading(false);
        };
        fetchProducts();
    }, []);

    /* Los materiales salen del catálogo, no de una lista fija: si el joyero
       carga una pieza en platino, el filtro aparece solo. Se agrupan por la
       primera palabra —"Oro blanco 18k" y "Oro 18k" son los dos oro— porque
       nadie filtra por el matiz del oro, filtra por oro. */
    const MATERIALES = useMemo(() => {
        const vistos = new Set();
        products.forEach(p => {
            const raiz = (p.metal || '').trim().split(/\s+/)[0];
            if (raiz) vistos.add(raiz.charAt(0).toUpperCase() + raiz.slice(1).toLowerCase());
        });
        return ['Todos', ...[...vistos].sort()];
    }, [products]);

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
            const matchMetal = metal === 'Todos'
                || (p.metal || '').toLowerCase().startsWith(metal.toLowerCase());
            return matchCat && matchBusqueda && matchPrecio && matchMetal;
        });

        if (orden === 'price_asc') result.sort((a, b) => a.price - b.price);
        if (orden === 'price_desc') result.sort((a, b) => b.price - a.price);

        return result;
    }, [products, categoria, busqueda, orden, rango, metal]);

    const visibles = filtradas.slice(0, pagina * PER_PAGE);

    /* Cuántos filtros hay puestos aparte de la categoría, que vive fuera del
       panel porque es el que más se usa. Va en el botón, para que en móvil se
       vea que hay algo activo sin tener que abrirlo. */
    /* Un chip por filtro puesto, con su forma de quitarse. En móvil los
       filtros viven escondidos en el panel, y sin esto no hay manera de saber
       que están activos ni de soltarlos sin volver a abrirlo. */
    const chips = [
        rango !== 0 && { id: 'rango', label: RANGOS[rango].label, quitar: () => setRango(0) },
        metal !== 'Todos' && { id: 'metal', label: metal, quitar: () => setMetal('Todos') },
        orden !== 'newest' && {
            id: 'orden',
            label: ORDENES.find(o => o.v === orden).corto,
            quitar: () => setOrden('newest'),
        },
        busqueda.trim() && { id: 'q', label: `“${busqueda.trim()}”`, quitar: () => setBusqueda('') },
    ].filter(Boolean);

    const filtrosActivos = chips.length;

    const limpiarFiltros = () => {
        setBusqueda('');
        setOrden('newest');
        setRango(0);
        setMetal('Todos');
        setPagina(1);
    };

    /* Lo que la clienta escribió, si escribió algo. Es lo que separa "filtré
       de más" de "esto no existe en el catálogo", y las dos cosas se resuelven
       al revés. */
    const termino = busqueda.trim();

    /* El mensaje se lleva lo que buscó. Es el dato más valioso del momento
       —dice exactamente qué quiere y no lo encontró— y sin él Valentina abre
       la conversación desde cero. Si no hubo búsqueda, al menos va la
       categoría, que también acota. */
    const waCotizar = useMemo(() => {
        const que = termino
            ? `Busqué "${termino}" en el catálogo y no encontré nada.`
            : categoria !== 'Todos'
                ? `Estuve viendo ${categoria.toLowerCase()} en el catálogo y no encontré lo que buscaba.`
                : 'Estuve viendo el catálogo y no encontré lo que buscaba.';
        return waUrl(`Hola 🙏 ${que} ¿Me pueden cotizar una pieza a la medida?`);
    }, [termino, categoria]);

    /* Qué decir cuando no hay nada que mostrar. Son tres situaciones, no una,
       y la salida de cada una es distinta:

       - Buscó algo que no existe. Limpiar filtros no se lo va a traer; lo que
         resuelve es cotizarlo.
       - Apretó los filtros de más. La solución está en su mano y limpiarlos
         va primero.
       - Entró a una categoría sin piezas. No hay filtro que quitar —la
         categoría no cuenta como tal, vive en su propio riel— así que la
         salida es abrir el catálogo entero.

       El taller trabaja por encargo, así que "no hay" siempre significa "no
       lo tenemos hecho", y eso es lo que dice el texto en los tres casos. */
    const vacio = useMemo(() => {
        /* Primero el fallo, antes que cualquier lectura de los filtros: si la
           consulta no llegó, hablar de filtros o de encargos es inventar. Lo
           que hay que decir es qué pasó, por qué y cómo salir. */
        if (fallo) return {
            titulo: 'No pudimos cargar el catálogo',
            texto: 'Puede ser tu conexión. Recarga la página y vuelve a intentarlo; si sigue igual, escríbenos y te mostramos las piezas por WhatsApp.',
            cotizarPrimero: false,
            arreglable: true,
            arreglarTexto: 'Recargar',
            arreglar: () => window.location.reload(),
        };

        /* Sin pronombre y sin género: esta frase se pega detrás de textos que
           hablan de "una pieza" y de categorías que pueden ser masculinas o
           femeninas —aretes, pulseras—. Con "cómo la quieres" salía "los
           hacemos por encargo… cómo la quieres". */
        const aMedida = 'Cuéntanos qué tienes en mente y te cotizamos; una pieza desde cero toma de 5 a 8 días.';

        if (termino) return {
            titulo: 'Eso no está en el catálogo',
            texto: `Pero se puede hacer. ${aMedida}`,
            cotizarPrimero: true,
            arreglable: filtrosActivos > 0,
            arreglarTexto: 'Limpiar filtros',
            arreglar: limpiarFiltros,
        };

        if (filtrosActivos > 0) return {
            titulo: 'Ninguna pieza cumple esos filtros',
            texto: 'Quita alguno para ver más. O cuéntanos qué buscas y la hacemos a tu medida.',
            cotizarPrimero: false,
            arreglable: true,
            arreglarTexto: 'Limpiar filtros',
            arreglar: limpiarFiltros,
        };

        if (categoria !== 'Todos') return {
            titulo: `Todavía no tenemos ${categoria.toLowerCase()}`,
            /* "Se hacen" y no "los hacemos": la categoría puede ser masculina
               o femenina y la frase tiene que servir para las cinco. */
            texto: `Pero se hacen por encargo. ${aMedida}`,
            cotizarPrimero: true,
            arreglable: true,
            arreglarTexto: 'Ver todo el catálogo',
            arreglar: () => { setCategoria('Todos'); setPagina(1); },
        };

        /* Catálogo entero vacío. No debería pasar nunca —si pasa, es que la
           consulta falló o el taller no tiene nada cargado— y decir "sin
           resultados" ahí sería culpar a la clienta de algo que no hizo. */
        return {
            titulo: 'Estamos surtiendo el catálogo',
            texto: `Mientras tanto, todo se puede hacer por encargo. ${aMedida}`,
            cotizarPrimero: true,
            arreglable: false,
        };
    }, [fallo, termino, filtrosActivos, categoria]);

    /* Con el panel abierto la página de detrás no se mueve, y el foco se
       queda dentro.

       El panel se anuncia con aria-modal="true", que le promete a un lector
       de pantalla que lo de detrás no existe. Pero eso es sólo una etiqueta:
       si el foco no se mueve ni se encierra, quien navega con teclado abre el
       panel y sigue tabulando por los filtros de la franja y las tarjetas que
       tiene tapadas. La promesa hay que cumplirla a mano. */
    useEffect(() => {
        if (!filtrosAbiertos) return;

        focoPrevioRef.current = document.activeElement;
        const previo = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const enfocables = () => [...(panelRef.current?.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? [])].filter(el => el.offsetParent !== null);

        /* El primero del panel, no el botón de cerrar: quien lo abrió quiere
           filtrar, no salir. */
        enfocables()[0]?.focus();

        const alTeclado = (e) => {
            if (e.key === 'Escape') { setFiltrosAbiertos(false); return; }
            if (e.key !== 'Tab') return;

            const lista = enfocables();
            if (!lista.length) return;
            const primero = lista[0];
            const ultimo = lista[lista.length - 1];

            /* El ciclo. Si el foco se escapó del panel —por un clic en el
               fondo, por ejemplo— se devuelve al principio. */
            if (!panelRef.current?.contains(document.activeElement)) {
                e.preventDefault();
                primero.focus();
            } else if (e.shiftKey && document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        };

        window.addEventListener('keydown', alTeclado);
        return () => {
            document.body.style.overflow = previo;
            window.removeEventListener('keydown', alTeclado);
            /* De vuelta al botón que lo abrió. */
            focoPrevioRef.current?.focus?.();
        };
    }, [filtrosAbiertos]);

    /* Los mismos controles se pintan dos veces: en la franja de escritorio y
       dentro del panel de móvil. Comparten estado, así que no hay nada que
       sincronizar; el que no toca se oculta con CSS. */
    const campoBuscar = () => (
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
    );

    const rielMaterial = () => (
        <div className="riel" role="group" aria-label="Material">
            {MATERIALES.map(m => (
                <button
                    key={m}
                    type="button"
                    className={`riel-btn ${metal === m ? 'riel-btn--on' : ''}`}
                    aria-pressed={metal === m}
                    onClick={() => { setMetal(m); setPagina(1); }}
                >
                    <span>{m}</span>
                </button>
            ))}
        </div>
    );

    /* En el panel el orden va como lista con palomita, no como <select>: un
       desplegable dentro de un panel deslizante abre un segundo overlay del
       sistema encima, y en el celular eso se siente como perder el sitio. */
    const listaOrden = () => (
        <div className="catalogo-orden-lista" role="group" aria-label="Ordenar por">
            {ORDENES.map(o => (
                <button
                    key={o.v}
                    type="button"
                    className={`catalogo-orden-op ${orden === o.v ? 'catalogo-orden-op--on' : ''}`}
                    aria-pressed={orden === o.v}
                    onClick={() => setOrden(o.v)}
                >
                    <span>{o.label}</span>
                    {orden === o.v && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--oro-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 12 9 17 20 6" />
                        </svg>
                    )}
                </button>
            ))}
        </div>
    );

    /* Riel segmentado: una sola fila, una sola activa.

       Las categorías sin piezas SÍ se pueden tocar, y no muestran el cero.
       Antes iban en disabled con un "0" al lado, y eso las convertía en tres
       etiquetas muertas: hoy el catálogo tiene Anillos y Dijes, así que
       Collares, Aretes y Pulseras —la mitad del riel— no llevaban a ninguna
       parte.

       El taller trabaja por encargo, así que "no hay" es "no lo tenemos
       hecho", y esa es una conversación, no un callejón. Al tocarlas se llega
       a la pantalla que lo ofrece. El cero no aporta: no es un dato que sirva
       para comprar, y sí frena el toque. */
    const rielCategorias = () => (
        <div className="riel" role="group" aria-label="Categorías">
            {CATEGORIAS.map(c => {
                const n = conteoPorCategoria[c] ?? 0;
                return (
                    <button
                        key={c}
                        type="button"
                        className={`riel-btn ${categoria === c ? 'riel-btn--on' : ''}`}
                        aria-pressed={categoria === c}
                        onClick={() => { setCategoria(c); setPagina(1); }}
                    >
                        <span>{c}</span>
                        {n > 0 && <span className="riel-n">{n}</span>}
                    </button>
                );
            })}
        </div>
    );

    const rielPrecio = () => (
        <div className="riel" role="group" aria-label="Rango de precio">
            {RANGOS.map((r, i) => (
                <button
                    key={r.label}
                    type="button"
                    className={`riel-btn ${rango === i ? 'riel-btn--on' : ''}`}
                    aria-pressed={rango === i}
                    onClick={() => { setRango(i); setPagina(1); }}
                >
                    <span>{r.label}</span>
                </button>
            ))}
        </div>
    );

    return (
        <main className="catalogo">

            <header className="catalogo-head container">
                <div className="catalogo-head-texto">
                    <p className="eyebrow">Colección</p>
                    <h1 className="catalogo-titulo">
                        Nuestras piezas,
                        <em>una por una.</em>
                    </h1>
                    {/* La primera frase sólo en escritorio. En celular ocupaba
                        dos de las tres líneas del párrafo, y lo que dice
                        —plata, oro, esmeralda— ya está en la barra de abajo y
                        en la ficha de cada tarjeta. La que se queda es la que
                        no repite nada y es la que construye confianza: que la
                        foto es la pieza. */}
                    <p className="catalogo-lead">
                        <span className="catalogo-lead-larga">
                            Plata ley 925, oro 18k y esmeralda colombiana natural.{' '}
                        </span>
                        Cada pieza se fotografía como llega a tus manos.
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

            {/* Sólo el buscador. La franja llevaba categorías, orden, precio
                y material en tres filas que se comían 145px del primer
                viewport en celular — y con cinco piezas en catálogo, filtrar
                por precio entre cinco anillos no le resuelve nada a nadie.
                Todo eso vive ahora en el panel, a un toque del botón flotante.

                El buscador se queda fuera porque es el único que se usa sin
                saber de antemano que se quiere filtrar: se escribe lo que se
                busca y ya. */}
            <div className="catalogo-filtros">
                <div className="container catalogo-filtros-fila">
                    {/* En escritorio el botón vive aquí, en la fila. Flotando
                        se quedaba encima de la tercera foto para siempre, y
                        dejaba esta banda con el buscador solo a un lado. En
                        celular manda el flotante, que está a un pulgar. */}
                    <div className="catalogo-filtros-btn-fila">
                        <button
                        type="button"
                        className="catalogo-filtros-btn"
                        onClick={() => setFiltrosAbiertos(true)}
                        aria-expanded={filtrosAbiertos}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="7" x2="20" y2="7" /><circle cx="15" cy="7" r="2.5" />
                            <line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="17" r="2.5" />
                        </svg>
                        Filtros
                        {filtrosActivos > 0 && <span className="catalogo-filtros-n">{filtrosActivos}</span>}
                    </button>
                    </div>
                    <div className="catalogo-herramientas">
                        {campoBuscar()}
                    </div>
                </div>

                {chips.length > 0 && (
                    <div className="container catalogo-chips">
                        {chips.map(c => (
                            <button key={c.id} type="button" className="catalogo-chip"
                                    onClick={() => { c.quitar(); setPagina(1); }}
                                    aria-label={`Quitar filtro ${c.label}`}>
                                <span>{c.label}</span>
                                <span aria-hidden="true">×</span>
                            </button>
                        ))}
                    </div>
                )}

            </div>

            {/* Panel de filtros, sólo en móvil */}
            {filtrosAbiertos && (
                <div className="catalogo-panel-velo" onClick={e => e.target === e.currentTarget && setFiltrosAbiertos(false)}>
                    <div className="catalogo-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Filtros">
                        <div className="catalogo-panel-head">
                            <h2>Filtros</h2>
                            <button type="button" className="catalogo-panel-cerrar" onClick={() => setFiltrosAbiertos(false)} aria-label="Cerrar filtros">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="catalogo-panel-cuerpo">
                            {/* Primero, y con su propio nombre: la categoría no
                                es un filtro más, es por donde se empieza a
                                mirar una joyería. Vivía en la franja; al
                                quitarla se habría quedado sin ningún sitio. */}
                            <div className="catalogo-panel-grupo">
                                <span className="catalogo-precio-label">Categoría</span>
                                {rielCategorias()}
                            </div>
                            <div className="catalogo-panel-grupo">
                                <span className="catalogo-precio-label">Precio</span>
                                {rielPrecio()}
                            </div>
                            <div className="catalogo-panel-grupo">
                                <span className="catalogo-precio-label">Material</span>
                                {rielMaterial()}
                            </div>
                            <div className="catalogo-panel-grupo">
                                <span className="catalogo-precio-label">Ordenar por</span>
                                {listaOrden()}
                            </div>
                        </div>

                        <div className="catalogo-panel-pie">
                            <button type="button" className="btn-pill light" onClick={limpiarFiltros} disabled={filtrosActivos === 0}>
                                Limpiar
                            </button>
                            <button type="button" className="btn-pill black" onClick={() => setFiltrosAbiertos(false)}>
                                Ver {filtradas.length} pieza{filtradas.length !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section className="container catalogo-cuerpo">
                {loading ? (
                    <div className="catalogo-grid">
                        {[...Array(8)].map((_, i) => <div key={i} className="pieza-esqueleto" />)}
                    </div>
                ) : filtradas.length === 0 ? (
                    /* Un catálogo vacío no es un callejón: quien filtró y no
                       encontró es quien más claro tiene lo que quiere, y ya
                       nos dijo qué es. El taller trabaja por encargo, así que
                       "no hay" en realidad significa "no lo tenemos hecho".

                       Se separan dos casos porque la salida es la contraria.
                       Si apretó los filtros, la solución está en su mano y
                       limpiarlos va primero. Si buscó un término que no
                       existe, limpiar filtros no se lo va a traer: el camino
                       real es cotizarlo. */
                    <div className="catalogo-vacio">
                        <span className="catalogo-vacio-icono">✦</span>
                        <p className="catalogo-vacio-titulo">{vacio.titulo}</p>
                        <p className="catalogo-vacio-texto">{vacio.texto}</p>
                        {/* El botón oscuro va primero, como en el resto del
                            sitio. Cuál de los dos es el oscuro depende del
                            caso: cuando el catálogo no tiene la pieza,
                            limpiar filtros no se la trae y manda la
                            cotización. */}
                        <div className="catalogo-vacio-acciones">
                            {vacio.cotizarPrimero ? (
                                <>
                                    <a href={waCotizar} target="_blank" rel="noopener noreferrer" className="btn-pill black">
                                        Cotizar por WhatsApp
                                    </a>
                                    {vacio.arreglable && (
                                        <button type="button" className="btn-pill light" onClick={vacio.arreglar}>
                                            {vacio.arreglarTexto}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button type="button" className="btn-pill black" onClick={vacio.arreglar}>
                                        {vacio.arreglarTexto}
                                    </button>
                                    <a href={waCotizar} target="_blank" rel="noopener noreferrer" className="btn-pill light">
                                        Cotizar por WhatsApp
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Cuántas hay y cuántas se están viendo. En móvil el
                            conteo de la franja de escritorio queda oculto, y
                            sin esto no hay forma de saber si la lista terminó. */}
                        <div className="catalogo-resumen">
                            <span>{filtradas.length} pieza{filtradas.length !== 1 ? 's' : ''}</span>
                            <div>
                                {/* Sólo cuando falta algo por cargar. Con todo a
                                    la vista decía "5 de 5" junto a "5 piezas":
                                    el mismo dato dos veces, y en el tono más
                                    claro de la paleta. */}
                                {visibles.length < filtradas.length && (
                                    <span>{visibles.length} de {filtradas.length}</span>
                                )}
                                {filtrosActivos > 0 && (
                                    <button type="button" className="catalogo-limpiar" onClick={limpiarFiltros}>
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        </div>

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

            {/* Flotante y no en la fila de filtros: en el celular esa fila se va
                con el scroll a los dos segundos y deja los filtros a un viaje
                de vuelta arriba. Aquí está siempre a un pulgar. */}
            {/* Siempre visible, no sólo al bajar. Antes se asomaba cuando la
                franja salía de pantalla; ahora no hay franja que salga, así
                que sin esto el botón no aparecería nunca y el catálogo se
                quedaría sin filtros. */}
            <div className="catalogo-filtros-flotante catalogo-filtros-flotante--visible">
                <button
                    type="button"
                    className="catalogo-filtros-btn"
                    onClick={() => setFiltrosAbiertos(true)}
                    aria-expanded={filtrosAbiertos}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="7" x2="20" y2="7" /><circle cx="15" cy="7" r="2.5" />
                        <line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="17" r="2.5" />
                    </svg>
                    Filtros
                    {filtrosActivos > 0 && <span className="catalogo-filtros-n">{filtrosActivos}</span>}
                </button>
            </div>
        </main>
    );
};

export default Catalog;

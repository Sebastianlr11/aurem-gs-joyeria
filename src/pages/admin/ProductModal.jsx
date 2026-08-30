/**
 * La ficha de una pieza.
 *
 * Reemplaza un formulario de doce campos apilados en una columna, donde para
 * llegar a las fotos había que pasar por delante de todo lo demás y no se
 * sabía en qué parte se estaba. Ahora hay seis secciones nombradas, un riel
 * que dice dónde estás y te lleva de un salto, y el pie fijo con lo único que
 * de verdad importa antes de cerrar: si hay cambios sin guardar.
 *
 * Tres cosas que el formulario viejo no hacía y que valían la pena:
 *
 * 1. Enseña lo que va a ver la clienta. El precio formateado, el punzón que
 *    sale del metal, la etiqueta de inventario tal cual aparece en la tienda.
 *    Antes había que guardar, ir al sitio y mirar.
 *
 * 2. Deja elegir la portada. Antes era la primera foto que subiste y punto;
 *    para cambiarla tocaba borrarlas todas y subirlas en otro orden.
 *
 * 3. El margen es una tarjeta y no una línea de ayuda perdida bajo un campo.
 *    Es el número con el que se decide cuánta pauta aguanta la pieza.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { borrarFotos } from '../../lib/fotosEnStorage';
import { versionesDeFoto } from '../../lib/optimizarFoto';
import { CATEGORIAS as CATEGORIES } from '../../lib/categorias';

const METALES = ['Plata 925', 'Oro 18k', 'Oro blanco 18k', 'Oro rosa 18k', 'Platino PT950'];
const MAX_DESC = 600;

const texto = (v) => String(v ?? '').trim();
const fmt = (n) => Math.round(n).toLocaleString('es-CO');

/* Los precios llegan de la base como "550000.00" —numeric de Postgres— y los
   campos se editan como dígitos sueltos. Quitar los puntos sin redondear
   antes convertiría 550000.00 en 55000000: cien veces más caro, y guardado
   sin que nada lo delate. */
const aDigitos = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.round(n)) : String(v).replace(/\D/g, '');
};
const numero = (v) => {
    const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : n;
};

const SECCIONES = [
    { id: 'identidad', label: 'Identidad' },
    { id: 'precio', label: 'Precio y margen' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'ficha', label: 'Ficha técnica' },
    { id: 'fotos', label: 'Fotos' },
    { id: 'publicacion', label: 'Publicación' },
];

const VACIO = {
    name: '', category: 'Anillos', price: '', compare_price: '',
    description: '', image_url: '', is_new: false,
    is_featured: false, stock: '', metal: '', piedra: '', talla_rango: '',
};

/** Un interruptor. Se usa dentro de un botón, así que es un span, no un input. */
const Palanca = ({ on }) => (
    <span className={`pm-palanca${on ? ' pm-palanca--on' : ''}`} aria-hidden="true">
        <span className="pm-palanca-bola" />
    </span>
);

/* Un campo de plata, con el signo y la moneda dentro del borde.
   Vive FUERA del componente a propósito: definido adentro sería un tipo de
   componente nuevo en cada render, React lo desmontaría y volvería a montar
   en cada tecla, y el cursor se saldría del campo al escribir. */
const CampoPlata = ({ etiqueta, obligatorio, marcador, ayuda, valor, alCambiar }) => (
    <div className="pm-campo">
        <label className="pm-label">
            {etiqueta}{obligatorio && <span className="pm-obligatorio"> · obligatorio</span>}
        </label>
        <div className="pm-plata">
            <span className="pm-plata-signo">$</span>
            <input
                inputMode="numeric"
                value={valor ?? ''}
                placeholder={marcador}
                onChange={e => alCambiar(e.target.value.replace(/\D/g, ''))}
            />
            <span className="pm-plata-cop">COP</span>
        </div>
        {ayuda && <span className="pm-ayuda">{ayuda}</span>}
    </div>
);

const Regla = ({ children }) => (
    <div className="pm-regla">
        <span className="pm-regla-t">{children}</span>
        <span className="pm-regla-linea" />
    </div>
);

export default function ProductModal({ product, onClose, onSaved }) {
    const isEdit = !!product?.id;

    const [form, setForm] = useState(() => {
        if (!isEdit) return { ...VACIO };
        return {
            ...VACIO, ...product,
            price: aDigitos(product.price),
            compare_price: aDigitos(product.compare_price),
            stock: product.stock ?? '',
        };
    });
    const [images, setImages] = useState(isEdit ? (product.images || []) : []);
    const [urlInput, setUrlInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [subiendo, setSubiendo] = useState(0);
    const [error, setError] = useState('');
    const [tocado, setTocado] = useState(false);
    const [activa, setActiva] = useState('identidad');

    const cuerpoRef = useRef(null);

    /* Lo que se subió a Storage DESDE QUE SE ABRIÓ ESTE MODAL y todavía no
       está guardado en ninguna ficha. Si se cierra sin guardar hay que
       borrarlo: el archivo ya está en el bucket y no queda nada que lo
       nombre. Era el último camino que dejaba huérfanos.

       En una referencia y no en estado porque no se pinta: cambiarlo no tiene
       por qué repintar el modal, y hace falta leerlo al cerrar, cuando el
       componente ya se está yendo. */
    const subidasSinGuardar = useRef([]);

    const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTocado(true); };

    /* Cerrar sin guardar se lleva lo que se subió y no llegó a ninguna ficha.
       No se espera al borrado antes de cerrar: la ventana se cierra al
       instante, como siempre, y la limpieza termina sola. Si falla, lo peor
       que pasa es lo que pasaba antes de esto. */
    const cerrar = useCallback(() => {
        const sueltas = subidasSinGuardar.current;
        subidasSinGuardar.current = [];
        if (sueltas.length) borrarFotos(sueltas);
        onClose();
    }, [onClose]);

    /* Escape cierra. Es la salida que la gente prueba primero, y sin ella el
       único camino es apuntarle a una × de 36 píxeles. */
    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, [cerrar]);

    /* Qué sección se está mirando. El riel sirve para saber dónde estás, no
       sólo para saltar: si sólo se pintara al hacer clic, bajar con la rueda
       lo dejaría mintiendo. */
    useEffect(() => {
        const cuerpo = cuerpoRef.current;
        if (!cuerpo) return;
        const alRodar = () => {
            const limite = cuerpo.scrollTop + 90;
            let cual = SECCIONES[0].id;
            cuerpo.querySelectorAll('[data-sec]').forEach(s => {
                if (s.offsetTop <= limite) cual = s.dataset.sec;
            });
            setActiva(cual);
        };
        cuerpo.addEventListener('scroll', alRodar, { passive: true });
        return () => cuerpo.removeEventListener('scroll', alRodar);
    }, []);

    const irA = (id) => {
        const cuerpo = cuerpoRef.current;
        const el = cuerpo?.querySelector(`[data-sec="${id}"]`);
        if (el) cuerpo.scrollTop = Math.max(el.offsetTop - 18, 0);
        setActiva(id);
    };

    /* ── Fotos ────────────────────────────────────────────────────── */

    const subirArchivo = async (original) => {
        /* Se achica y se convierte ANTES de subir. Las fotos salen del
           celular con 1536×2752 y varios megas, y se guardaban tal cual: eso
           es exactamente lo que baja después cada clienta que abre la ficha.
           Si algo falla, sube la original. */
        const { principal, gemela, variantes, ancho, alto } = await versionesDeFoto(original);

        const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        /* Las copias chicas van PRIMERO, y el nombre de la grande se decide
           después según cómo les fue. El motivo: la marca `-893x1600` en el
           nombre de la grande es lo único que le dice al sitio que existe un
           `srcset` (ver fotoProducto.js). Ponerla antes de saber si las
           copias subieron sería prometer archivos que quizá no están, y el
           navegador pintaría una foto rota — bastante peor que una pesada. */
        let conVariantes = variantes.length > 0;
        if (conVariantes) {
            const idas = await Promise.all(variantes.map(v => supabase.storage
                .from('product-images')
                .upload(`${base}-w${v.ancho}.webp`, v.archivo, { upsert: false })));
            const falla = idas.find(r => r.error);
            if (falla) {
                console.error('No se pudieron subir los tamaños chicos:', falla.error.message);
                conVariantes = false;
            }
        }

        /* El mismo nombre para las dos grandes, sólo cambia la extensión. Es
           la convención de la que depende wa.ts para pedir la JPEG: el sitio
           usa la WebP porque pesa una fracción, pero WhatsApp no acepta WebP. */
        const sufijo = conVariantes ? `-${ancho}x${alto}` : '';
        const ruta = (f) => `${base}${sufijo}.${f.name.split('.').pop()}`;

        const { error: upErr } = await supabase.storage
            .from('product-images').upload(ruta(principal), principal, { upsert: false });
        if (upErr) throw upErr;

        if (gemela) {
            /* Si falla la gemela el catálogo funciona igual: lo que se pierde
               es que Valentina pueda mandarla por WhatsApp. No vale tumbar la
               subida por eso, pero sí dejarlo dicho. */
            const { error: errGemela } = await supabase.storage
                .from('product-images').upload(ruta(gemela), gemela, { upsert: false });
            if (errGemela) console.error('No se pudo subir la versión JPEG:', errGemela.message);
        }

        const { data } = supabase.storage.from('product-images').getPublicUrl(ruta(principal));
        return data.publicUrl;
    };

    const alElegirArchivos = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setError(''); setSubiendo(files.length);
        const results = await Promise.allSettled(files.map(f => subirArchivo(f)));
        const urls = [], fallaron = [];
        results.forEach((r, i) => r.status === 'fulfilled' ? urls.push(r.value) : fallaron.push(files[i].name));
        if (urls.length) {
            subidasSinGuardar.current.push(...urls);
            setImages(prev => [...prev, ...urls]);
            setTocado(true);
        }
        if (fallaron.length) setError(`No se pudieron subir: ${fallaron.join(', ')}`);
        setSubiendo(0); e.target.value = '';
    };

    /* Una URL pegada a mano no se anota, y la diferencia importa: si alguien
       copia aquí la dirección de una foto que ya usa OTRA pieza, anotarla
       haría que cerrar sin guardar borrara del bucket una foto que sí está
       publicada. Sólo se limpia lo que subió este modal. */
    const agregarUrl = () => {
        const url = urlInput.trim();
        if (!url) return;
        setImages(prev => [...prev, url]); setUrlInput(''); setTocado(true);
    };

    /* La portada se elige moviendo la foto al frente del arreglo. El sitio y
       los correos ya leen images[0] como portada, así que cambiar el orden
       hace el trabajo sin tocar la base ni ningún otro consumidor. */
    const hacerPortada = (idx) => {
        if (idx === 0) return;
        setImages(prev => [prev[idx], ...prev.filter((_, i) => i !== idx)]);
        setTocado(true);
    };

    /* Sólo se saca de la lista. Borrar el archivo aquí sería adelantarse:
       quien quita una foto y después cierra el modal sin guardar espera
       encontrarla donde estaba, y en cambio tendría una ficha apuntando a un
       archivo que ya no existe. El borrado de verdad va en `guardar`, cuando
       la decisión ya es firme. */
    const quitarFoto = (idx) => { setImages(prev => prev.filter((_, i) => i !== idx)); setTocado(true); };

    /* ── Lo que verá la clienta ───────────────────────────────────── */

    const precio = numero(form.price);

    const inventario = useMemo(() => {
        if (form.stock === '' || form.stock === null || form.stock === undefined) {
            return { texto: 'Sin control de inventario', tono: 'pm-stock--gris' };
        }
        const n = numero(form.stock);
        if (n === null) return { texto: 'Sin control de inventario', tono: 'pm-stock--gris' };
        if (n === 0) return { texto: 'Agotado', tono: 'pm-stock--agotado' };
        if (n <= 3) return { texto: `Últimas ${n} pieza${n !== 1 ? 's' : ''}`, tono: 'pm-stock--poco' };
        return { texto: `${n} unidades disponibles`, tono: 'pm-stock--ok' };
    }, [form.stock]);

    const descLargo = (form.description || '').length;

    /* ── Guardar ──────────────────────────────────────────────────── */

    const guardar = async (e) => {
        e.preventDefault(); setError('');
        if (!texto(form.name)) { setError('Falta el nombre de la pieza.'); irA('identidad'); return; }
        if (precio === null || precio <= 0) { setError('Falta el precio de venta.'); irA('precio'); return; }

        setSaving(true);
        const comparar = numero(form.compare_price);
        const payload = {
            name: texto(form.name),
            category: form.category,
            price: precio,
            compare_price: comparar && comparar > precio ? comparar : null,
            description: texto(form.description) || null,
            images,
            image_url: images[0] || texto(form.image_url) || null,
            is_new: !!form.is_new,
            is_featured: !!form.is_featured,
            metal: texto(form.metal) || null,
            piedra: texto(form.piedra) || null,
            talla_rango: texto(form.talla_rango) || null,
            // Vacío = sin control de inventario (null). 0 = agotado.
            stock: form.stock === '' || form.stock === null || form.stock === undefined
                ? null
                : Math.max(0, Math.trunc(Number(form.stock))),
        };

        let err;
        if (isEdit) ({ error: err } = await supabase.from('products').update(payload).eq('id', product.id));
        else ({ error: err } = await supabase.from('products').insert([payload]));
        setSaving(false);
        if (err) { setError(err.message); return; }

        /* Las fotos que se quitaron de la ficha se van del bucket. Antes se
           quedaban ahí, públicas y sin que nada las nombrara: la única forma
           de encontrarlas era comparar el bucket entero contra la base.

           Se hace después de guardar y con la lista que de verdad quedó
           grabada, no con la del formulario: si el update falla, no se ha
           borrado nada. */
        if (isEdit) {
            const quedaron = new Set(images);
            const sobran = (product.images || []).filter(u => !quedaron.has(u));
            if (sobran.length) borrarFotos(sobran);
        }

        /* Ya están en una ficha: dejan de ser huérfanas en potencia. Sin esto,
           guardar y cerrar borraría las fotos recién guardadas. */
        subidasSinGuardar.current = [];

        onSaved();
    };

    return (
        <div className="pm-fondo" onClick={e => e.target === e.currentTarget && cerrar()}>
            <form
                className="pm-caja"
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? 'Editar producto' : 'Nuevo producto'}
                onSubmit={guardar}
            >
                {/* ── Riel ── */}
                <aside className="pm-riel">
                    <div className="pm-riel-arriba">
                        <div className="pm-riel-pieza">
                            {images[0]
                                ? <img src={images[0]} alt="" className="pm-riel-foto" />
                                : <span className="pm-riel-foto pm-riel-foto--vacia">✦</span>}
                            <div className="pm-riel-datos">
                                <span className="pm-riel-nombre">{texto(form.name) || 'Pieza sin nombre'}</span>
                                <span className="punzon">{texto(form.metal) || 'Sin punzón'}</span>
                            </div>
                        </div>

                        <nav className="pm-riel-nav">
                            {SECCIONES.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className={`pm-riel-item${activa === s.id ? ' pm-riel-item--on' : ''}`}
                                    onClick={() => irA(s.id)}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="pm-riel-estado">
                        <span className="pm-riel-estado-t">Estado</span>
                        <span className="pm-riel-estado-s">
                            {!isEdit ? 'Todavía sin publicar.'
                                : form.is_featured ? 'Publicada y destacada en la portada.'
                                    : 'Publicada en el catálogo.'}
                        </span>
                    </div>
                </aside>

                {/* ── Columna principal ── */}
                <div className="pm-col">
                    <header className="pm-cabeza">
                        <div>
                            <span className="pm-cabeza-ante">Ficha de producto</span>
                            <h2 className="pm-cabeza-titulo">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
                        </div>
                        <button type="button" className="pm-cerrar" onClick={cerrar} aria-label="Cerrar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </header>

                    <div className="pm-cuerpo" ref={cuerpoRef}>
                        {error && <p className="pm-error">{error}</p>}

                        <section data-sec="identidad" className="pm-sec">
                            <Regla>Identidad</Regla>
                            <div className="pm-rejilla">
                                <div className="pm-campo">
                                    <label className="pm-label">Nombre<span className="pm-obligatorio"> · obligatorio</span></label>
                                    <input
                                        className="pm-input"
                                        value={form.name}
                                        onChange={e => set('name', e.target.value)}
                                        placeholder="Anillo Camino Verde"
                                    />
                                </div>
                                <div className="pm-campo">
                                    <label className="pm-label">Categoría<span className="pm-obligatorio"> · obligatorio</span></label>
                                    <div className="pm-select">
                                        <select value={form.category} onChange={e => set('category', e.target.value)}>
                                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section data-sec="precio" className="pm-sec">
                            <Regla>Precio y margen</Regla>
                            <div className="pm-rejilla pm-rejilla--tres">
                                <CampoPlata
                                    etiqueta="Precio de venta" obligatorio
                                    marcador="550.000"
                                    valor={form.price}
                                    alCambiar={v => set('price', v)}
                                    ayuda={precio !== null ? `Se publica como $${fmt(precio)} COP` : 'Lo que paga la clienta.'}
                                />
                                <CampoPlata
                                    etiqueta="Precio anterior"
                                    marcador="Vacío si no hay oferta"
                                    valor={form.compare_price}
                                    alCambiar={v => set('compare_price', v)}
                                    ayuda="Se tacha junto al precio nuevo."
                                />
                            </div>

                            {/* Aquí vivía el costo de la pieza, y con él un margen
                                calculado sobre un número fijo del catálogo. No se
                                podía mantener: el oro se mueve y el flete depende de
                                a dónde va, así que el campo se llenaba de
                                estimaciones y el panel terminaba avisando de que sus
                                propios márgenes eran de relleno.

                                Desde el 23 de agosto de 2026 el costo se anota en el
                                PEDIDO, al despachar, cuando ya se sabe qué costó de
                                verdad — y queda congelado ahí, igual que el precio se
                                congela en order_items. Ver la migración
                                20260823_costos_del_pedido.sql. */}
                        </section>

                        <section data-sec="inventario" className="pm-sec">
                            <Regla>Inventario</Regla>
                            <div className="pm-rejilla pm-rejilla--fin">
                                <div className="pm-campo">
                                    <label className="pm-label">Unidades disponibles</label>
                                    <input
                                        className="pm-input"
                                        inputMode="numeric"
                                        value={form.stock ?? ''}
                                        onChange={e => set('stock', e.target.value.replace(/\D/g, ''))}
                                        placeholder="Vacío si no llevas inventario"
                                    />
                                    <span className="pm-ayuda">0 es agotado. Vacío es sin control de inventario.</span>
                                </div>
                                <div className="pm-campo">
                                    <span className="pm-label">En la tienda se ve así</span>
                                    <span className={`pm-stock ${inventario.tono}`}>{inventario.texto}</span>
                                </div>
                            </div>
                        </section>

                        <section data-sec="ficha" className="pm-sec">
                            <Regla>Ficha técnica</Regla>
                            <div className="pm-rejilla">
                                <div className="pm-campo">
                                    <label className="pm-label">Metal y ley</label>
                                    <input
                                        className="pm-input" list="pm-metales"
                                        value={form.metal || ''}
                                        onChange={e => set('metal', e.target.value)}
                                        placeholder="Plata 925"
                                    />
                                    <datalist id="pm-metales">
                                        {METALES.map(m => <option key={m} value={m} />)}
                                    </datalist>
                                    <span className="pm-ayuda">De acá sale el punzón de la pieza.</span>
                                </div>
                                <div className="pm-campo">
                                    <label className="pm-label">Piedra</label>
                                    <input
                                        className="pm-input"
                                        value={form.piedra || ''}
                                        onChange={e => set('piedra', e.target.value)}
                                        placeholder="Vacío si no lleva piedra"
                                    />
                                </div>
                                {/* Aquí vivía «Engaste». Se quitó el 30 de agosto de 2026: el
                                    taller no lo llenaba nunca —tres piezas de las primeras y
                                    ninguna más—, así que la ficha de la pieza enseñaba el dato
                                    en unas y lo callaba en las otras. La columna sigue en
                                    `products`, muerta, como `costo`. */}
                                <div className="pm-campo">
                                    <label className="pm-label">Tallas</label>
                                    <input
                                        className="pm-input"
                                        value={form.talla_rango || ''}
                                        onChange={e => set('talla_rango', e.target.value)}
                                        placeholder="5 a 12"
                                    />
                                    <span className="pm-ayuda">Sólo para anillos.</span>
                                </div>
                            </div>
                            <div className="pm-campo">
                                <label className="pm-label">Descripción</label>
                                <textarea
                                    className="pm-input pm-area"
                                    rows={4}
                                    maxLength={MAX_DESC}
                                    value={form.description || ''}
                                    onChange={e => set('description', e.target.value)}
                                    placeholder="Metal, ley, piedra, entrega y garantía."
                                />
                                <div className="pm-area-pie">
                                    <span className="pm-ayuda">Metal, ley, piedra, entrega y garantía. Sin adjetivos.</span>
                                    <span className={`pm-cuenta${descLargo > MAX_DESC - 60 ? ' pm-cuenta--cerca' : ''}`}>
                                        {descLargo} / {MAX_DESC}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section data-sec="fotos" className="pm-sec">
                            <Regla>Fotos</Regla>
                            <span className="pm-ayuda pm-ayuda--suelta">
                                Mínimo 3 fotos, misma luz y mismo fondo. Toca una para hacerla portada.
                            </span>
                            <div className="pm-fotos">
                                {images.map((url, i) => (
                                    <div
                                        key={`${url}-${i}`}
                                        className={`pm-foto${i === 0 ? ' pm-foto--portada' : ''}`}
                                        onClick={() => hacerPortada(i)}
                                        title={i === 0 ? 'Es la portada' : 'Hacer portada'}
                                    >
                                        <img src={url} alt="" onError={e => { e.currentTarget.style.opacity = '0.25'; }} />
                                        <button
                                            type="button"
                                            className="pm-foto-quitar"
                                            aria-label="Quitar foto"
                                            onClick={e => { e.stopPropagation(); quitarFoto(i); }}
                                        >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                        </button>
                                        {i === 0 && <span className="pm-foto-sello">Portada</span>}
                                    </div>
                                ))}
                                {Array.from({ length: subiendo }).map((_, i) => (
                                    <div key={`sub-${i}`} className="pm-foto pm-foto--subiendo" />
                                ))}
                                <label className="pm-foto-mas" title="Agregar fotos">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                                    <span>Subir</span>
                                    <input type="file" accept="image/*" multiple hidden onChange={alElegirArchivos} disabled={subiendo > 0} />
                                </label>
                            </div>
                            <div className="pm-url">
                                <input
                                    className="pm-input"
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarUrl(); } }}
                                    placeholder="O pegar URL de imagen"
                                />
                                <button type="button" className="pm-btn pm-btn--claro" onClick={agregarUrl}>Agregar</button>
                            </div>
                        </section>

                        <section data-sec="publicacion" className="pm-sec pm-sec--ultima">
                            <Regla>Publicación</Regla>
                            <div className="pm-rejilla">
                                <button type="button" className="pm-opcion" onClick={() => set('is_new', !form.is_new)}>
                                    <span className="pm-opcion-txt">
                                        <span className="pm-opcion-t">Nuevo</span>
                                        <span className="pm-opcion-s">Lleva sello de recién llegado.</span>
                                    </span>
                                    <Palanca on={!!form.is_new} />
                                </button>
                                <button type="button" className="pm-opcion" onClick={() => set('is_featured', !form.is_featured)}>
                                    <span className="pm-opcion-txt">
                                        <span className="pm-opcion-t">Destacado</span>
                                        {/* Desde el 30 de agosto de 2026 esto es verdad: la
                                            portada lee el catálogo. Antes prometía «aparece en la
                                            portada» y la portada no leía nada — eran cinco fotos
                                            de banco y tres colecciones escritas a mano. */}
                                        <span className="pm-opcion-s">Va en el carrusel y es la cara de su categoría.</span>
                                    </span>
                                    <Palanca on={!!form.is_featured} />
                                </button>
                            </div>
                        </section>
                    </div>

                    <footer className="pm-pie">
                        <span className="pm-pie-estado">
                            <span className={`pm-punto${tocado ? ' pm-punto--tocado' : ''}`} />
                            {subiendo > 0
                                ? `Subiendo ${subiendo} foto${subiendo !== 1 ? 's' : ''}…`
                                : tocado ? 'Cambios sin guardar' : 'Sin cambios'}
                        </span>
                        <div className="pm-pie-botones">
                            <button type="button" className="pm-btn pm-btn--claro" onClick={cerrar}>Cancelar</button>
                            <button type="submit" className="pm-btn pm-btn--oscuro" disabled={saving || subiendo > 0}>
                                {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
                            </button>
                        </div>
                    </footer>
                </div>
            </form>
        </div>
    );
}

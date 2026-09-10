/**
 * Panel · Emitir y mandar el certificado de autenticidad de un pedido.
 *
 * ── Por qué nace al ENTREGAR y no al despachar ────────────────────────────
 *
 * Porque un contraentrega se puede caer en la puerta y la pieza vuelve al
 * inventario. Un certificado emitido de una compra que se devolvió queda
 * suelto por ahí, con el nombre de alguien que no tiene la joya. Y como las
 * entregas de Bogotá las hace el taller, el joyero vuelve, marca «entregado» y
 * manda el certificado: es un cierre natural y de paso una excusa para
 * escribirle otra vez.
 *
 * Se puede emitir igual antes de tiempo —el botón está siempre—, pero el
 * diálogo lo dice.
 *
 * ── Uno por pedido ────────────────────────────────────────────────────────
 *
 * Un pedido de tres piezas lleva un certificado, no tres. La decisión es del
 * taller y simplifica lo demás: `order_id` es único de hecho, y el diálogo
 * enseña el que ya existe en vez de dejar emitir dos.
 *
 * ── El peso y la talla se corrigen aquí ───────────────────────────────────
 *
 * El peso del catálogo es el de la pieza de muestra y una fabricación a medida
 * no pesa lo mismo. Lo que se escriba aquí es lo que queda congelado en el
 * documento para siempre — la pantalla lo avisa.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { congelar, nuevoCodigo, piezasDe, urlDeCertificado } from '../../../lib/certificado';
import { tarjetaJpeg, pintarTarjeta } from './tarjeta';

/* El mismo bucket público del catálogo, bajo su propio prefijo. Un bucket
   nuevo habría que crearlo a mano en el panel de Supabase, y un paso de
   instalación que no está en ninguna migración es el que nadie recuerda el día
   que se levanta otro entorno. */
const BUCKET = 'product-images';
const CARPETA = 'certificados';

/* Cuántas veces se reintenta si el código sorteado ya existe. Con 31⁸
   combinaciones un choque es prácticamente imposible; «prácticamente» no es
   «nunca», y un 23505 sin reintento sería un error incomprensible en pantalla. */
const INTENTOS = 5;

const mensajeWa = (cert) => {
    const piezas = piezasDe(cert.datos);
    /* «tu anillo» con una, «tus 2 piezas» con varias. Nombrar la pieza cuando
       hay una es lo que hace que el mensaje no parezca automático. */
    const que = piezas.length === 1 ? `tu ${piezas[0].nombre}` : `tus ${piezas.length} piezas`;
    return (
    `Hola ${cert.datos.cliente || ''}! 💎 Aquí va el certificado de autenticidad de ${que}.\n\n` +
    `Puedes verificarlo en cualquier momento en ${urlDeCertificado(cert.codigo)} o escaneando el código de la tarjeta.\n\n` +
    `Guárdalo: ahí está también la garantía. Gracias por confiar en Aurem Gs Joyería.`
    );
};

const DialogoCertificado = ({ pedido, productos = [], onClose }) => {
    const [cargando, setCargando] = useState(true);
    const [cert, setCert] = useState(null);
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');
    const [ocupado, setOcupado] = useState('');

    /* Las piezas del pedido, con lo que hace falta corregir antes de emitir.
       Una por línea de `order_items`; si el pedido no tiene —los de antes de
       que existiera la tabla— se arma una sola con lo que hay en la orden. */
    const [lineas, setLineas] = useState([]);

    const lienzoRef = useRef(null);

    /* ── Lo que ya existe ── */
    useEffect(() => {
        let vivo = true;
        (async () => {
            const { data, error: err } = await supabase
                .from('certificados')
                .select('codigo, datos, emitido_en, anulado_en')
                .eq('order_id', pedido.id)
                .maybeSingle();

            if (!vivo) return;
            if (err) setError(`No se pudo consultar si ya tiene certificado: ${err.message}`);
            if (data) setCert(data);
            setCargando(false);
        })();
        return () => { vivo = false; };
    }, [pedido.id]);

    /* ── Las piezas del pedido ── */
    useEffect(() => {
        let vivo = true;
        (async () => {
            const { data } = await supabase
                .from('order_items')
                .select('product_id, nombre, talla')
                .eq('order_id', pedido.id)
                .order('creado_en');
            if (!vivo) return;

            const filas = (data ?? []).map((f) => {
                const producto = productos.find((p) => p.id === f.product_id) || null;
                return {
                    clave: f.product_id || f.nombre,
                    producto,
                    nombre: f.nombre || producto?.name || '',
                    talla: f.talla || '',
                    peso: producto?.peso_gramos ? String(producto.peso_gramos) : '',
                };
            });

            if (filas.length) return setLineas(filas);

            /* Sin filas: un pedido de antes de `order_items`, o uno cuyo
               guardado de piezas falló. Se arma una sola con lo de la orden.
               Ojo: `product_name` puede ser el nombre PEGADO de varias piezas,
               así que quien emita tiene que mirarlo — por eso es editable. */
            const producto = productos.find((p) => p.id === pedido.product_id) || null;
            setLineas([{
                clave: pedido.id,
                producto,
                nombre: producto?.name || pedido.product_name || '',
                talla: '',
                peso: producto?.peso_gramos ? String(producto.peso_gramos) : '',
            }]);
        })();
        return () => { vivo = false; };
    }, [pedido.id, pedido.product_id, pedido.product_name, productos]);

    const cambiarLinea = (clave, campo, valor) =>
        setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)));

    /* ── La vista previa ── */
    const pintar = useCallback(async (elCert) => {
        const caja = lienzoRef.current;
        if (!caja || !elCert) return;
        try {
            const lienzo = await pintarTarjeta(elCert);
            /* La tarjeta se pinta a 1080px y la caja mide bastante menos: el
               CSS la encoge, y así se ve en el panel lo mismo que se manda. */
            lienzo.style.width = '100%';
            lienzo.style.height = 'auto';
            caja.replaceChildren(lienzo);
        } catch (e) {
            setError(`No se pudo dibujar la tarjeta: ${e.message}`);
        }
    }, []);

    useEffect(() => { if (cert) pintar(cert); }, [cert, pintar]);

    /* ── Emitir ── */
    const emitir = async () => {
        setOcupado('emitiendo');
        setError('');

        const datos = congelar({ pedido, piezas: lineas });

        for (let intento = 0; intento < INTENTOS; intento++) {
            const fila = {
                codigo: nuevoCodigo(),
                order_id: pedido.id,
                datos,
                es_prueba: !!pedido.es_prueba,
                emitido_por: (await supabase.auth.getUser()).data.user?.id ?? null,
            };

            const { data, error: err } = await supabase
                .from('certificados')
                .insert(fila)
                .select('codigo, datos, emitido_en, anulado_en')
                .single();

            if (!err) { setCert(data); setOcupado(''); return; }
            /* 23505 es el código sorteado repetido: se vuelve a sortear. Con
               cualquier otro error no hay nada que reintentar. */
            if (err.code !== '23505') {
                setError(`No se pudo emitir: ${err.message}`);
                setOcupado('');
                return;
            }
        }

        setError('El código sorteado chocó cinco veces seguidas, que no debería pasar nunca. Vuelve a intentarlo y, si se repite, avisa.');
        setOcupado('');
    };

    /* ── Descargar ── */
    const descargar = async () => {
        setOcupado('descargando');
        try {
            const blob = await tarjetaJpeg(cert);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificado ${cert.codigo}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setError(e.message);
        }
        setOcupado('');
    };

    /* ── Mandar por WhatsApp ── */
    const mandar = async () => {
        setOcupado('mandando');
        setError('');
        setAviso('');
        try {
            const blob = await tarjetaJpeg(cert);
            const ruta = `${CARPETA}/${cert.codigo}.jpg`;

            const { error: errSubida } = await supabase.storage
                .from(BUCKET)
                .upload(ruta, blob, {
                    contentType: 'image/jpeg',
                    /* Un año, igual que las fotos del catálogo: el
                       `Cache-Control` de un archivo se decide al subirlo y
                       después no hay forma de cambiarlo sin resubirlo. */
                    cacheControl: '31536000',
                    /* Se sobrescribe a propósito: si se vuelve a mandar el
                       mismo certificado, es la misma tarjeta. */
                    upsert: true,
                });
            if (errSubida) throw new Error(`No se pudo subir la tarjeta: ${errSubida.message}`);

            const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta);

            const { data, error: errEnvio } = await supabase.functions.invoke('wa-send', {
                body: {
                    telefono: pedido.customer_phone,
                    texto: mensajeWa(cert),
                    imagenUrl: publica.publicUrl,
                },
            });

            /* `invoke` se traga el cuerpo del error, y aquí el cuerpo es lo
               único que explica el porqué —sobre todo la ventana de 24 h, que
               es un caso normal y no una avería—. */
            if (errEnvio) {
                const cuerpo = await errEnvio.context?.json?.().catch(() => null);
                throw new Error(cuerpo?.error || errEnvio.message);
            }
            if (data?.error) throw new Error(data.error);

            setAviso('La tarjeta salió por WhatsApp.');
        } catch (e) {
            setError(e.message);
        }
        setOcupado('');
    };

    /* ── Anular ── */
    const anular = async () => {
        setOcupado('anulando');
        const { error: err } = await supabase
            .from('certificados')
            .update({ anulado_en: new Date().toISOString(), anulado_por: 'panel' })
            .eq('codigo', cert.codigo);
        if (err) setError(`No se pudo anular: ${err.message}`);
        else setCert({ ...cert, anulado_en: new Date().toISOString() });
        setOcupado('');
    };

    const sinTelefono = !pedido.customer_phone;

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box cert-dlg">
                <div className="modal-header">
                    <h3 className="modal-title">Certificado de autenticidad</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
                </div>

                <div className="modal-body cert-dlg-body">
                    {cargando && <p className="cert-dlg-nota">Buscando si este pedido ya tiene certificado…</p>}

                    {!cargando && !cert && (
                        <>
                            {pedido.status !== 'entregado' && (
                                <p className="cert-dlg-alerta">
                                    Este pedido todavía no está entregado. Lo normal es emitirlo al
                                    entregar: si la compra se cae en la puerta, el certificado ya
                                    estaría circulando con el nombre de alguien que no tiene la pieza.
                                </p>
                            )}

                            <p className="cert-dlg-nota">
                                Se emite a nombre de <strong>{pedido.customer_name}</strong> y ampara{' '}
                                <strong>{lineas.length} pieza{lineas.length !== 1 ? 's' : ''}</strong>.
                                En el documento sale sólo el nombre de pila y nunca el precio.
                            </p>

                            {lineas.map((l) => (
                                <div className="cert-dlg-pieza" key={l.clave}>
                                    <p className="cert-dlg-pieza-nombre">{l.nombre}</p>
                                    <div className="modal-row">
                                        <div className="modal-field">
                                            <label htmlFor={`cert-peso-${l.clave}`}>Peso en gramos</label>
                                            <input
                                                id={`cert-peso-${l.clave}`} type="number" step="0.01" min="0"
                                                value={l.peso}
                                                onChange={(e) => cambiarLinea(l.clave, 'peso', e.target.value)}
                                                placeholder="Lo que marque la balanza"
                                            />
                                            <span className="cert-dlg-pista">
                                                {l.producto?.peso_gramos
                                                    ? 'Viene del catálogo. Corrígelo si pesó distinto.'
                                                    : 'Sin peso en el catálogo. Vacío, la línea no sale.'}
                                            </span>
                                        </div>
                                        <div className="modal-field">
                                            <label htmlFor={`cert-talla-${l.clave}`}>Talla</label>
                                            <input
                                                id={`cert-talla-${l.clave}`} value={l.talla}
                                                onChange={(e) => cambiarLinea(l.clave, 'talla', e.target.value)}
                                                placeholder="Si aplica"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <p className="cert-dlg-pista">
                                Lo que escribas queda congelado en el documento: un certificado no se
                                reescribe después.
                            </p>
                        </>
                    )}

                    {cert && (
                        <>
                            {cert.anulado_en && (
                                <p className="cert-dlg-alerta">
                                    Este certificado está anulado. La página pública lo dice, y quien
                                    escanee el QR lo va a ver.
                                </p>
                            )}
                            <div className="cert-dlg-previa" ref={lienzoRef} />
                            <p className="cert-dlg-nota">
                                <strong>{cert.codigo}</strong> ·{' '}
                                <a href={urlDeCertificado(cert.codigo)} target="_blank" rel="noreferrer">
                                    ver la página pública
                                </a>
                            </p>
                        </>
                    )}

                    {error && <p className="cert-dlg-error">{error}</p>}
                    {aviso && <p className="cert-dlg-ok">{aviso}</p>}
                </div>

                <div className="modal-actions">
                    <button className="btn-pill light" onClick={onClose}>Cerrar</button>

                    {!cargando && !cert && (
                        <button className="btn-pill black" onClick={emitir} disabled={!!ocupado}>
                            {ocupado === 'emitiendo' ? 'Emitiendo…' : 'Emitir el certificado'}
                        </button>
                    )}

                    {cert && !cert.anulado_en && (
                        <>
                            <button className="btn-pill light" onClick={anular} disabled={!!ocupado}>
                                {ocupado === 'anulando' ? 'Anulando…' : 'Anular'}
                            </button>
                            <button className="btn-pill light" onClick={descargar} disabled={!!ocupado}>
                                {ocupado === 'descargando' ? 'Preparando…' : 'Descargar'}
                            </button>
                            <button
                                className="btn-pill black" onClick={mandar}
                                disabled={!!ocupado || sinTelefono}
                                title={sinTelefono ? 'Este pedido no tiene teléfono al que escribirle.' : ''}
                            >
                                {ocupado === 'mandando' ? 'Mandando…' : 'Mandar por WhatsApp'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DialogoCertificado;

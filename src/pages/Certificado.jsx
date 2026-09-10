/**
 * La página a la que lleva el QR del certificado — y el documento que se
 * imprime.
 *
 * Es la mitad que hace verificable a la otra: la tarjeta que la clienta recibe
 * por WhatsApp no prueba nada por sí sola, porque una imagen se reenvía y se
 * retoca. Lo que prueba es que el código exista en nuestra base y que lo que
 * dice la tarjeta coincida con lo que dice esta pantalla.
 *
 * **Lo que NO prueba, para que nadie lo prometa**: que la pieza que alguien
 * tiene en la mano sea ésta. Un QR se fotocopia. Prueba que el código existe,
 * de qué piezas es y cuándo se vendieron.
 *
 * ── Es una hoja carta, no una pantalla ────────────────────────────────────
 *
 * La maqueta viene del diseño `Certificado de Autenticidad.dc.html`, que es un
 * documento paginado de 8,5×11 pulgadas. Así que esta pantalla se diseñó para
 * imprimirse y se adapta al navegador, y no al revés: en papel sale el
 * documento, y en un celular las tres rejillas se apilan.
 *
 * Eso obliga a una cosa que en una página normal no haría falta: **el ancho de
 * la hoja se mide en pulgadas**, no en `px` ni en `rem`. Una hoja medida en
 * píxeles se imprime a un tamaño que depende del navegador.
 *
 * ── Tres desenlaces, y los tres se dicen distinto ─────────────────────────
 *
 * Un código que no existe, uno anulado y una consulta que se cayó son tres
 * cosas distintas y aquí se responden distinto. Confundirlas es el error caro:
 * decirle «este certificado no existe» a alguien cuya única falla fue el wifi
 * lo convence de que le vendieron algo falso.
 *
 * ── Sin indexar ───────────────────────────────────────────────────────────
 *
 * `index.html` declara `index, follow` para todo el sitio. Esta pantalla lleva
 * el nombre de pila de una clienta y las joyas que compró: no tiene por qué
 * acabar en Google. Va `noindex` y también está cerrada en `robots.txt`.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { traerCertificado } from '../lib/apiPublica';
import {
    piezasDe, resumenDePieza, fechaLarga, normalizarCodigo,
    GARANTIAS, EXCLUSION, NOTA_LEGAL, urlDeCertificado,
} from '../lib/certificado';
import { ponerMeta } from '../lib/meta';
import { waUrl } from '../lib/whatsapp';
import Isotipo from '../components/Isotipo';
import CodigoQr from '../components/CodigoQr';

import './Certificado.css';

/* El aire alrededor del documento, para los tres estados que no son un
   certificado. Sin él, un mensaje de dos líneas queda pegado al navbar. */
const Aviso = ({ titulo, children }) => (
    <main className="cert-aviso">
        <span className="cert-aviso-icono" aria-hidden="true">✦</span>
        <h1 className="cert-aviso-titulo">{titulo}</h1>
        <div className="cert-aviso-texto">{children}</div>
        <div className="cert-aviso-acciones">
            <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
            <a
                href={waUrl('Hola 🙏 Estoy verificando un certificado de una pieza de Aurem Gs y quisiera confirmarlo con ustedes.')}
                target="_blank" rel="noopener noreferrer" className="btn-pill light"
            >
                Escríbenos por WhatsApp
            </a>
        </div>
    </main>
);

const Certificado = () => {
    const { codigo: crudo } = useParams();
    /* Se normaliza antes de preguntar: quien llega desde una tarjeta impresa
       teclea el código a mano y lo escribe en minúscula. La base también lo
       normaliza —la API es pública y no puede fiarse del navegador—, pero
       hacerlo aquí ahorra el viaje cuando ni siquiera tiene forma de código. */
    const codigo = normalizarCodigo(crudo);

    /* El resultado y el código al que pertenece van juntos en un solo estado, y
       no en dos.

       Si fueran dos, cambiar de certificado sin recargar dejaría el anterior en
       pantalla mientras llega el nuevo — enseñando el nombre de otra clienta
       bajo un código que ya no es el suyo. Con el código dentro, basta con
       comparar: mientras `resultado.codigo` no sea el de la URL, esto está
       cargando. Es también lo que evita el `setEstado('cargando')` al entrar al
       efecto, que es una renderización en cascada. */
    const [resultado, setResultado] = useState({ codigo: null, estado: 'cargando', cert: null });

    useEffect(() => {
        /* Sin código no hay nada que preguntar, y tampoco nada que poner en el
           estado: eso se decide al pintar, unas líneas más abajo. */
        if (!codigo) return undefined;
        let vivo = true;

        traerCertificado(codigo).then(({ data, error }) => {
            if (!vivo) return;
            if (error) return setResultado({ codigo, estado: 'error', cert: null });
            if (!data) return setResultado({ codigo, estado: 'inexistente', cert: null });
            setResultado({ codigo, estado: data.anulado_en ? 'anulado' : 'valido', cert: data });
        });

        return () => { vivo = false; };
    }, [codigo]);

    /* Un código que ni siquiera tiene forma de código no llega a preguntarse:
       se responde aquí mismo, sin viaje de red. */
    const estado = !codigo
        ? 'inexistente'
        : (resultado.codigo === codigo ? resultado.estado : 'cargando');
    const cert = estado === 'valido' || estado === 'anulado' ? resultado.cert : null;

    /* Con una pieza se la nombra; con varias, no se nombra la primera y se
       callan las demás — el título diría que el certificado es de una joya
       cuando ampara dos. */
    const cuantas = cert ? piezasDe(cert.datos) : [];
    const titulo = cuantas.length === 1 ? `Certificado de ${cuantas[0].nombre}`
        : cuantas.length > 1 ? `Certificado de ${cuantas.length} piezas`
        : 'Verificar un certificado';
    useEffect(() => ponerMeta({
        titulo: `${titulo} | Aurem Gs Joyería`,
        descripcion: 'Certificado de autenticidad emitido por Aurem Gs Joyería: procedencia de la pieza y garantía del taller.',
        ruta: `/certificado/${codigo || ''}`,
        robots: 'noindex, nofollow',
    }), [codigo, titulo]);

    if (estado === 'cargando') {
        return (
            <main className="cert-aviso">
                <div className="page-spinner" />
                <p className="cert-aviso-texto">Verificando el certificado…</p>
            </main>
        );
    }

    /* «No pude comprobarlo» no es «esto es falso», y la diferencia le importa
       muchísimo a quien está mirando la pantalla con la joya en la mano. */
    if (estado === 'error') {
        return (
            <Aviso titulo="No pudimos verificarlo ahora">
                <p>
                    No es que el certificado no exista: no logramos consultarlo. Puede ser tu
                    conexión o algo de nuestro lado. Vuelve a intentarlo en un momento, y si
                    sigue igual escríbenos con el código y lo confirmamos a mano.
                </p>
                {codigo && <p className="cert-codigo-suelto">{codigo}</p>}
            </Aviso>
        );
    }

    if (estado === 'inexistente') {
        return (
            <Aviso titulo="Este certificado no existe">
                <p>
                    No encontramos ningún certificado con ese código. Casi siempre es una
                    letra mal copiada — el código tiene la forma <strong>AG-</strong> y ocho
                    caracteres, y nunca lleva la letra O ni el número 1.
                </p>
                <p>Si lo copiaste bien y aun así sale esto, escríbenos: queremos saberlo.</p>
                {codigo && <p className="cert-codigo-suelto">{codigo}</p>}
            </Aviso>
        );
    }

    const datos = cert.datos || {};
    const piezas = piezasDe(datos);
    const anulado = estado === 'anulado';

    return (
        <main className="cert-pagina">
            <article className={`cert-hoja${anulado ? ' cert-hoja--anulada' : ''}`}>

                {/* ── Cabecera ── */}
                <header className="cert-cab">
                    <div className="cert-marca">
                        <Isotipo className="cert-iso" />
                        <span className="cert-marca-texto">
                            <span className="cert-marca-nombre">AUREM GS</span>
                            <span className="cert-marca-sub">Joyería fina · Colombia</span>
                        </span>
                    </div>
                    {/* El punzón del sistema, con la muesca del diseño. Marca un
                        dato comprobable, que es para lo que existe. */}
                    <span className={`cert-punzon${anulado ? ' cert-punzon--anulado' : ''}`}>
                        {anulado ? 'Anulado' : 'Documento original'}
                    </span>
                </header>

                <div className="cert-regla" aria-hidden="true">
                    <span className="cert-regla-oro" />
                    <span className="cert-regla-pelo" />
                </div>

                {/* ── Título y los dos datos del documento ── */}
                <div className="cert-encabezado">
                    <h1 className="cert-titulo">
                        Certificado de
                        <em>autenticidad</em>
                    </h1>
                    <dl className="cert-meta">
                        <div>
                            <dt>N.º de certificado</dt>
                            <dd className="cert-meta-codigo">{cert.codigo}</dd>
                        </div>
                        {datos.compradoEn && (
                            <div>
                                <dt>Fecha de compra</dt>
                                <dd className="cert-meta-fecha">{fechaLarga(datos.compradoEn)}</dd>
                            </div>
                        )}
                    </dl>
                </div>

                {anulado && (
                    <div className="cert-anulado" role="status">
                        <p className="cert-anulado-titulo">Este certificado fue anulado</p>
                        <p>
                            Se anuló el {fechaLarga(cert.anulado_en)}, y ya no ampara las piezas
                            que describe. Suele pasar cuando una compra se devolvió o se cambió
                            por otra pieza. Si llegaste aquí con una joya en la mano, escríbenos
                            antes de nada.
                        </p>
                    </div>
                )}

                {/* ── A nombre de quién, y cuántas piezas ── */}
                <div className="cert-titular">
                    <div>
                        <span className="cert-rotulo">Expedido a nombre de</span>
                        <span className="cert-titular-nombre">{datos.cliente || 'Su titular'}</span>
                    </div>
                    <div className="cert-ampara">
                        Ampara
                        <span className="cert-ampara-n">
                            {piezas.length} pieza{piezas.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* ── Las piezas ── */}
                <div className="cert-tabla">
                    <div className="cert-tabla-cab">
                        <span aria-hidden="true" />
                        <span>Pieza y materiales</span>
                        <span className="cert-col-ref">Referencia</span>
                    </div>
                    {piezas.map((pz, i) => (
                        <div className="cert-fila" key={`${pz.referencia || pz.nombre}-${i}`}>
                            <span className="cert-num" aria-hidden="true">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="cert-pieza">
                                <span className="cert-pieza-nombre">{pz.nombre}</span>
                                {/* Metal, piedra, peso y talla en una línea. Es la
                                    misma función que usa la tarjeta: si cada una
                                    tuviera la suya, el QR acabaría desmintiendo al
                                    papel que lo lleva impreso. */}
                                {resumenDePieza(pz) && (
                                    <span className="cert-pieza-ficha">{resumenDePieza(pz)}</span>
                                )}
                            </span>
                            <span className="cert-ref">{pz.referencia || '—'}</span>
                        </div>
                    ))}
                </div>

                {/* ── Lo que se responde por ellas ──

                    El diseño trae tres casillas: Garantía, Envío y Pago. Se
                    conserva la forma y **cambia el contenido**, porque lo que
                    decían no es cierto en este negocio: el envío no es de 24 a 48
                    horas —son 3 a 4 días en Bogotá y 4 a 6 al resto del país— y el
                    contraentrega **no es a todo el país, es sólo Bogotá**. Un
                    certificado es el papel que la clienta enseña al reclamar: lo
                    que prometa ahí, se cumple.

                    Así que las casillas dicen lo único que este documento tiene
                    que decir: las dos garantías, copiadas de
                    `/politica-de-devoluciones`, y la exclusión de las piedras, que
                    es la parte incómoda y justo por eso la que no se puede
                    omitir. */}
                <div className="cert-tira">
                    {GARANTIAS.map((g) => (
                        <div className="cert-tira-celda" key={g.titulo}>
                            <span className="cert-rotulo">{g.titulo}</span>
                            <p>{g.texto}</p>
                        </div>
                    ))}
                    <div className="cert-tira-celda">
                        <span className="cert-rotulo">Las piedras</span>
                        <p>{EXCLUSION}</p>
                    </div>
                </div>

                {/* ── Verificación y firma ── */}
                <div className="cert-pie">
                    <div className="cert-verificacion">
                        <CodigoQr valor={urlDeCertificado(cert.codigo)} className="cert-qr" />
                        <div>
                            <span className="cert-rotulo">Verificación</span>
                            <p className="cert-verificacion-texto">
                                Escanea el código, o abre{' '}
                                <a href={urlDeCertificado(cert.codigo)}>auremgsjoyeria.com</a>{' '}
                                y busca el número de arriba.
                            </p>
                        </div>
                    </div>
                    <div className="cert-firma">
                        <span className="cert-firma-linea" aria-hidden="true" />
                        <span className="cert-firma-nombre">Aurem Gs Joyería</span>
                        <span className="cert-rotulo">Firma autorizada</span>
                    </div>
                </div>

                <p className="cert-legal">{NOTA_LEGAL}</p>
            </article>

            {/* Fuera de la hoja, y fuera del papel: en la impresión no salen. */}
            <div className="cert-acciones">
                <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
                <a
                    href={waUrl(`Hola 🙏 Tengo el certificado ${cert.codigo} y quisiera preguntarles algo sobre mi pieza.`)}
                    target="_blank" rel="noopener noreferrer" className="btn-pill light"
                >
                    Escríbenos por WhatsApp
                </a>
            </div>
        </main>
    );
};

export default Certificado;

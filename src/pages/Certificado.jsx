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
 * ── La hoja de taller ─────────────────────────────────────────────────────
 *
 * La maqueta viene del diseño `Certificado-v2-hoja-de-taller.dc.html`. Es una
 * página, no un documento paginado: rejillas que se reacomodan solas con
 * `auto-fit`, sin un solo punto de quiebre escrito a mano. Quien llega aquí
 * acaba de escanear un QR, o sea que está en un celular.
 *
 * **Cada pieza va con su foto**, y ésa es la parte que hace trabajo: es lo
 * único que quien tiene la joya en la mano puede comparar de verdad.
 *
 * La versión imprimible —la hoja carta— es la TARJETA, que se pinta en un
 * canvas y se manda por WhatsApp (`pages/admin/certificado/tarjeta.js`).
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
    piezasDe, camposDePieza, posicionDePieza, fechaLarga, normalizarCodigo,
    GARANTIAS, EXCLUSION, NOTA_LEGAL,
} from '../lib/certificado';
import { ponerMeta } from '../lib/meta';
import { waUrl } from '../lib/whatsapp';
import Isotipo from '../components/Isotipo';
import { fotoProducto } from '../lib/fotoProducto';

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
    const conteo = `${piezas.length} pieza${piezas.length !== 1 ? 's' : ''}`;

    return (
        <main className="cert-pagina">
            <article className="cert-hoja">

                {/* ── Cabecera ── */}
                <header className="cert-cab">
                    <div className="cert-cab-marca">
                        <p className="cert-antetitulo">
                            <Isotipo className="cert-iso" />
                            Aurem Gs Joyería
                        </p>
                        <h1 className="cert-titulo">
                            Certificado de
                            <span>Autenticidad</span>
                        </h1>
                    </div>

                    <div className="cert-cab-sello">
                        {/* El sello octogonal: oro por fuera, una hoja de un
                            píxel de aire, y el degradado del mostrador por
                            dentro. Es el punzón del sistema llevado a un sello
                            de lacre, que es lo que un certificado pide. */}
                        <div className={`cert-sello${anulado ? ' cert-sello--anulado' : ''}`}>
                            <div className="cert-sello-cara">
                                <span className="cert-sello-ag">AG</span>
                                <span className="cert-sello-filete" aria-hidden="true" />
                                <span className="cert-sello-rotulo">{anulado ? 'Anulado' : 'Verificado'}</span>
                            </div>
                        </div>
                        <div>
                            <span className="cert-rotulo">Certificado n.º</span>
                            <strong className="cert-codigo">{cert.codigo}</strong>
                            <span className="cert-emitido">Emitido el {fechaLarga(cert.emitido_en)}</span>
                        </div>
                    </div>
                </header>

                {/* Dos filetes, oro y pelo, con tres píxeles de aire entre
                    ellos. Es el gesto del sistema, no un borde doble. */}
                <div className="cert-filete-oro" aria-hidden="true" />
                <div className="cert-filete-pelo" aria-hidden="true" />

                {anulado && (
                    <div className="cert-anulado" role="status">
                        <p className="cert-anulado-titulo">Este certificado fue anulado</p>
                        <p>
                            Ya no ampara las piezas que describe. Suele pasar cuando una
                            compra se devolvió o se cambió por otra pieza. Si tienes la joya
                            en la mano, escríbenos antes de nada.
                        </p>
                    </div>
                )}

                {/* ── Los tres datos del documento ── */}
                <section className="cert-resumen">
                    <div>
                        <span className="cert-rotulo">Expedido a nombre de</span>
                        <strong className="cert-resumen-nombre">{datos.cliente || 'Su titular'}</strong>
                    </div>
                    <div>
                        <span className="cert-rotulo">Fecha de compra</span>
                        <strong>{fechaLarga(datos.compradoEn) || '—'}</strong>
                    </div>
                    <div>
                        <span className="cert-rotulo">Piezas amparadas</span>
                        <strong>{conteo}</strong>
                    </div>
                </section>

                {/* ── Las piezas ── */}
                <div className="cert-seccion">
                    <h2>Las piezas</h2>
                    <span aria-hidden="true" />
                </div>

                <div className="cert-piezas">
                    {piezas.map((pz, i) => {
                        const foto = pz.foto ? fotoProducto(pz.foto) : null;
                        return (
                            <article className="cert-pieza" key={`${pz.referencia || pz.nombre}-${i}`}>
                                <div className="cert-pieza-foto">
                                    {foto
                                        ? <img
                                            {...foto}
                                            sizes="(max-width: 700px) 92vw, 400px"
                                            alt={`Foto de ${pz.nombre}`}
                                            loading={i === 0 ? 'eager' : 'lazy'}
                                        />
                                        /* Una pieza a la medida no está en el catálogo y no
                                           tiene foto. Un punzón antes que un hueco roto. */
                                        : <span className="cert-pieza-sinfoto" aria-hidden="true">✦</span>}
                                </div>

                                <div className="cert-pieza-cuerpo">
                                    <div className="cert-pieza-alto">
                                        <span>{posicionDePieza(i, piezas.length)}</span>
                                        {pz.referencia && <span className="cert-pieza-ref">Ref. {pz.referencia}</span>}
                                    </div>
                                    <h3>{pz.nombre}</h3>
                                    <dl className="cert-pieza-datos">
                                        {camposDePieza(pz).map(({ etiqueta, valor }) => (
                                            <div key={etiqueta}>
                                                <dt>{etiqueta}</dt>
                                                <dd>{valor}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {/* Por qué están las fotos, dicho en voz alta. */}
                <p className="cert-comparar">
                    {piezas.length === 1
                        ? 'Compara tu pieza con esta foto: es la de la joya que se te entregó.'
                        : 'Compara tus piezas con estas fotos: son las de las joyas que se te entregaron.'}
                </p>

                {/* ── La garantía ── */}
                <section className="cert-garantias">
                    <div>
                        <h2>La garantía que lo acompaña</h2>
                        {/* La exclusión de las piedras es la parte incómoda del papel, y
                            justo por eso va aquí arriba y no escondida al final. */}
                        <p>
                            {EXCLUSION} Los términos completos están en la{' '}
                            <Link to="/politica-de-devoluciones">política de devoluciones y garantías</Link>.
                        </p>
                    </div>
                    <div className="cert-garantias-lista">
                        {GARANTIAS.map((g) => (
                            <div key={g.titulo}>
                                <p className="cert-garantia-titulo">{g.titulo}</p>
                                <p>{g.texto}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <p className="cert-legal">{NOTA_LEGAL}</p>
            </article>

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

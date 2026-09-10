/**
 * La página a la que lleva el QR del certificado.
 *
 * Es la mitad que hace verificable a la otra: la tarjeta que la clienta recibe
 * por WhatsApp —o la que va impresa en el estuche— no prueba nada por sí sola,
 * porque una imagen se reenvía y se retoca. Lo que prueba es que el código
 * exista en nuestra base y que lo que dice la tarjeta coincida con lo que dice
 * esta pantalla.
 *
 * **Lo que NO prueba, para que nadie lo prometa**: que la pieza que alguien
 * tiene en la mano sea ésta. Un QR se fotocopia. Por eso la página enseña la
 * foto real de la pieza en grande — quien la tiene delante compara, y ésa es la
 * verificación de verdad. Prometer más sería vender humo, que es exactamente lo
 * que un certificado viene a combatir.
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
 * el nombre de pila de una clienta y la joya que compró: no tiene por qué
 * acabar en Google. Va `noindex` y también está cerrada en `robots.txt`.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { traerCertificado } from '../lib/apiPublica';
import {
    campos, fechaLarga, normalizarCodigo,
    GARANTIAS, EXCLUSION, NOTA_LEGAL,
} from '../lib/certificado';
import { ponerMeta } from '../lib/meta';
import { waUrl } from '../lib/whatsapp';
import { fotoProducto } from '../lib/fotoProducto';

import './Certificado.css';

/* El aire alrededor del documento, para los tres estados que no son un
   certificado. Sin él, un mensaje de dos líneas queda pegado al navbar. */
const Aviso = ({ titulo, children, acciones = true }) => (
    <main className="cert-aviso">
        <span className="cert-aviso-icono" aria-hidden="true">✦</span>
        <h1 className="cert-aviso-titulo">{titulo}</h1>
        <div className="cert-aviso-texto">{children}</div>
        {acciones && (
            <div className="cert-aviso-acciones">
                <Link to="/catalogo" className="btn-pill black">Ver el catálogo</Link>
                <a
                    href={waUrl('Hola 🙏 Estoy verificando un certificado de una pieza de Aurem Gs y quisiera confirmarlo con ustedes.')}
                    target="_blank" rel="noopener noreferrer" className="btn-pill light"
                >
                    Escríbenos por WhatsApp
                </a>
            </div>
        )}
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

    const pieza = cert?.datos?.pieza;
    useEffect(() => ponerMeta({
        titulo: pieza
            ? `Certificado de ${pieza} | Aurem Gs Joyería`
            : 'Verificar un certificado | Aurem Gs Joyería',
        descripcion: 'Certificado de autenticidad emitido por Aurem Gs Joyería: procedencia de la pieza y garantía del taller.',
        ruta: `/certificado/${codigo || ''}`,
        robots: 'noindex, nofollow',
    }), [codigo, pieza]);

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
                <p>
                    Si lo copiaste bien y aun así sale esto, escríbenos: queremos saberlo.
                </p>
                {codigo && <p className="cert-codigo-suelto">{codigo}</p>}
            </Aviso>
        );
    }

    const datos = cert.datos || {};
    const lineas = campos(datos);
    const anulado = estado === 'anulado';
    const foto = datos.foto ? fotoProducto(datos.foto) : null;

    return (
        <main className="cert-pagina">
            <article className={`cert-doc ${anulado ? 'cert-doc--anulado' : ''}`}>

                {/* El marco de oro. Decorativo y a propósito de 1px: es el
                    filete del sistema, no un borde de tarjeta. */}
                <div className="cert-marco" aria-hidden="true" />

                <header className="cert-cabecera">
                    <p className="cert-antetitulo"><span className="cert-filete" aria-hidden="true" />Aurem Gs Joyería</p>
                    <h1 className="cert-titulo">
                        Certificado de
                        <em>Autenticidad</em>
                    </h1>
                    {!anulado && <span className="punzon cert-sello">Verificado</span>}
                </header>

                {anulado && (
                    <div className="cert-anulado" role="status">
                        <p className="cert-anulado-titulo">Este certificado fue anulado</p>
                        <p>
                            Se anuló el {fechaLarga(cert.anulado_en)}
                            {datos.pieza ? `, y ya no ampara la pieza que describe` : ''}. Suele
                            pasar cuando una compra se devolvió o se cambió por otra pieza. Si
                            llegaste aquí con una joya en la mano, escríbenos antes de nada.
                        </p>
                    </div>
                )}

                {datos.cliente && (
                    <p className="cert-nombre">
                        <span className="cert-nombre-rotulo">Expedido a nombre de</span>
                        <strong>{datos.cliente}</strong>
                    </p>
                )}

                {foto && (
                    <figure className="cert-foto">
                        {/* Se reparten las props tal cual, con el `width` y el
                            `height` reales del archivo: son los que le reservan
                            el sitio a la foto y evitan que el documento salte
                            cuando llega. El CSS decide el tamaño en pantalla. */}
                        <img
                            {...foto}
                            sizes="(max-width: 640px) 84vw, 380px"
                            alt={datos.pieza ? `Foto de ${datos.pieza}` : 'La pieza certificada'}
                            loading="eager"
                        />
                        {/* La razón de que la foto esté aquí, dicha en voz alta:
                            es lo único que quien tiene la pieza puede comparar. */}
                        <figcaption>Compara tu pieza con esta foto: es la de la joya que se te entregó.</figcaption>
                    </figure>
                )}

                <dl className="cert-datos">
                    {lineas.map(({ etiqueta, valor }) => (
                        <div className="cert-dato" key={etiqueta}>
                            <dt>{etiqueta}</dt>
                            <dd>{valor}</dd>
                        </div>
                    ))}
                </dl>

                <section className="cert-garantias">
                    <h2 className="cert-h2">La garantía que lo acompaña</h2>
                    <ul>
                        {GARANTIAS.map((g) => (
                            <li key={g.titulo}>
                                <strong>{g.titulo}.</strong> {g.texto}
                            </li>
                        ))}
                    </ul>
                    <p className="cert-exclusion">{EXCLUSION}</p>
                    <p className="cert-mas">
                        Los términos completos están en la{' '}
                        <Link to="/politica-de-devoluciones">política de devoluciones y garantías</Link>.
                    </p>
                </section>

                <footer className="cert-pie">
                    <div className="cert-pie-codigo">
                        <span className="cert-pie-rotulo">Número de certificado</span>
                        <strong>{cert.codigo}</strong>
                    </div>
                    <div className="cert-pie-fecha">
                        <span className="cert-pie-rotulo">Emitido</span>
                        <strong>{fechaLarga(cert.emitido_en)}</strong>
                    </div>
                </footer>

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

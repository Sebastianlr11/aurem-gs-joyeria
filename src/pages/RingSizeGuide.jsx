import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { waUrl } from '../lib/whatsapp';

/* Tabla estándar de tallas US: circunferencia interior en milímetros.
   El diámetro se deriva dividiendo por π, no se guarda por separado. */
const TALLAS = [
    ['3', 44.2], ['3.5', 45.5], ['4', 46.8], ['4.5', 48.0], ['5', 49.3],
    ['5.5', 50.6], ['6', 51.9], ['6.5', 53.1], ['7', 54.4], ['7.5', 55.7],
    ['8', 57.0], ['8.5', 58.3], ['9', 59.5], ['9.5', 60.8], ['10', 62.1],
    ['10.5', 63.4], ['11', 64.6], ['11.5', 65.9], ['12', 67.2], ['12.5', 68.5],
];

const UNIDADES = {
    'circ-mm': { label: 'Circunferencia mm', sufijo: 'mm de circunferencia', aCirc: v => v },
    'circ-cm': { label: 'Circunferencia cm', sufijo: 'cm de circunferencia', aCirc: v => v * 10 },
    'diam-mm': { label: 'Diámetro mm', sufijo: 'mm de diámetro', aCirc: v => v * Math.PI },
};

const num = n => n.toFixed(1).replace('.', ',');

const PASOS = [
    {
        titulo: 'Envuelve un hilo',
        texto: 'Da una vuelta completa en la base del dedo, ajustada pero sin apretar. Sirve hilo, cinta de papel o una tira delgada.',
    },
    {
        titulo: 'Marca y mide',
        texto: 'Marca el punto donde se cruza y mide esa longitud con una regla, en milímetros. Esa es tu circunferencia.',
    },
    {
        titulo: 'Busca tu número',
        texto: 'Escribe la medida arriba o búscala en la tabla. Mide al final del día: en la mañana y con frío el dedo está más delgado.',
    },
];

const FAQS = [
    {
        q: '¿Y si mi medida queda entre dos tallas?',
        a: 'Elige la mayor. Un anillo apenas holgado se acomoda al dedo; uno apretado no entra. Si quedas justo en la mitad, escríbenos con la medida exacta y te decimos.',
    },
    {
        q: '¿La talla es igual en oro, plata y platino?',
        a: 'Sí, la tabla aplica a los tres metales. Lo que cambia la sensación es el ancho de la banda: en bandas anchas conviene media talla más.',
    },
    {
        q: '¿Pueden ajustar el anillo si no me queda?',
        a: 'Escríbenos por WhatsApp con la foto de la pieza y tu medida y te confirmamos si ese diseño admite ajuste. No todos se pueden modificar sin afectar el acabado.',
    },
    {
        q: '¿Cómo mido si el anillo es un regalo?',
        a: 'Mide por dentro un anillo que la persona ya use en ese dedo: el diámetro interior en milímetros corresponde a la columna Diám. mm de la tabla.',
    },
];

const Tabla = ({ filas }) => (
    <div className="talla-tabla">
        <div className="talla-tabla-head">
            <span>Talla</span>
            <span>Circ. mm</span>
            <span>Diám. mm</span>
        </div>
        {filas.map(([talla, circ], i) => (
            <div key={talla} className={`talla-fila ${i % 2 ? 'talla-fila--alt' : ''}`}>
                <span className="talla-fila-n">{talla}</span>
                <span className="talla-fila-v">{num(circ)}</span>
                <span className="talla-fila-v">{num(circ / Math.PI)}</span>
            </div>
        ))}
    </div>
);

const RingSizeGuide = () => {
    const [valor, setValor] = useState('');
    const [unidad, setUnidad] = useState('circ-mm');
    const [faqAbierta, setFaqAbierta] = useState(0);

    const resultado = () => {
        const bruto = String(valor).replace(',', '.').trim();
        if (!bruto) return { talla: '?', detalle: 'Escribe tu medida y te decimos la talla.' };

        const v = parseFloat(bruto);
        if (!isFinite(v) || v <= 0) {
            return { talla: '?', detalle: `Ingresa un número en ${UNIDADES[unidad].sufijo}.` };
        }

        const circ = UNIDADES[unidad].aCirc(v);
        if (circ < TALLAS[0][1] - 0.6) {
            return { talla: '?', detalle: 'Esa medida queda por debajo de la talla 3. Escríbenos y la fabricamos a tu medida.' };
        }
        if (circ > TALLAS[TALLAS.length - 1][1] + 0.6) {
            return { talla: '?', detalle: 'Esa medida pasa la talla 12.5. Escríbenos y la fabricamos a tu medida.' };
        }

        // Entre dos tallas se toma la mayor: un anillo holgado se ajusta, uno apretado no entra.
        const fila = TALLAS.find(f => f[1] >= circ - 0.35) || TALLAS[TALLAS.length - 1];
        return {
            talla: fila[0],
            detalle: `${num(fila[1])} mm de circunferencia · ${num(fila[1] / Math.PI)} mm de diámetro interior.`,
        };
    };

    const r = resultado();

    const waLink = waUrl({
        mobile: 'Hola! 💍 Necesito ayuda con mi talla de anillo. Mi medida es: ',
        desktop: 'Hola! Necesito ayuda con mi talla de anillo. Mi medida es: ',
    });

    return (
        <main className="talla">

            <section className="talla-head">
                <div className="talla-head-eyebrow">
                    <span className="talla-rule" />
                    <p>Guía de tallas</p>
                    <span className="talla-rule" />
                </div>
                <h1 className="talla-titulo">
                    Encuentra tu talla
                    <em>antes de comprar.</em>
                </h1>
                <p className="talla-lead">
                    Mide la base del dedo con un hilo, escribe la medida en milímetros y te decimos la
                    talla. Sin adivinar, sin devoluciones.
                </p>
                <div className="talla-punzones">
                    <span className="punzon punzon--dark">Tallas 3 a 12.5</span>
                    <span className="punzon punzon--dark">Sistema US</span>
                    <span className="punzon punzon--dark">Oro 18k · plata 925 · platino</span>
                </div>
            </section>

            <section className="talla-calc">
                <div className="talla-calc-card">
                    <div className="talla-calc-medida">
                        <p className="eyebrow">Tu medida</p>
                        <div className="talla-calc-input">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={valor}
                                onChange={e => setValor(e.target.value)}
                                placeholder="54,4"
                                aria-label="Medida del dedo"
                            />
                            <span>{UNIDADES[unidad].sufijo}</span>
                        </div>
                        <div className="talla-calc-chips">
                            {Object.entries(UNIDADES).map(([clave, u]) => (
                                <button
                                    key={clave}
                                    type="button"
                                    className={`talla-chip ${unidad === clave ? 'talla-chip--on' : ''}`}
                                    onClick={() => setUnidad(clave)}
                                >
                                    {u.label}
                                </button>
                            ))}
                        </div>
                        <p className="talla-calc-nota">
                            Si tu medida cae entre dos tallas, tomamos la mayor: un anillo holgado se
                            ajusta, uno apretado no entra.
                        </p>
                    </div>

                    <div className="talla-calc-resultado">
                        <span className="punzon">Tu talla</span>
                        <p className="talla-calc-valor">{r.talla}</p>
                        <p className="talla-calc-detalle">{r.detalle}</p>
                    </div>
                </div>
            </section>

            <section className="talla-pasos-seccion">
                <h2 className="talla-h2">
                    Cómo medir
                    <em>en dos minutos.</em>
                </h2>
                <div className="talla-pasos">
                    {PASOS.map((p, i) => (
                        <div key={p.titulo} className="talla-paso">
                            <p className="talla-paso-n">{i + 1}</p>
                            <h3 className="talla-paso-titulo">{p.titulo}</h3>
                            <p className="talla-paso-texto">{p.texto}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="talla-tablas-seccion">
                <div className="talla-tablas-head">
                    <h2 className="talla-h2">
                        Tabla de
                        <em>equivalencias.</em>
                    </h2>
                    <p className="talla-tablas-nota">
                        Circunferencia interior y diámetro interior de cada talla, en milímetros.
                    </p>
                </div>
                <div className="talla-tablas">
                    <Tabla filas={TALLAS.slice(0, 10)} />
                    <Tabla filas={TALLAS.slice(10)} />
                </div>
            </section>

            <section className="talla-faqs-seccion">
                <h2 className="talla-h2">
                    Preguntas
                    <em>frecuentes.</em>
                </h2>
                <div className="talla-faqs">
                    {FAQS.map((f, i) => (
                        <div key={f.q} className={`talla-faq ${faqAbierta === i ? 'talla-faq--on' : ''}`}>
                            <button
                                className="talla-faq-q"
                                onClick={() => setFaqAbierta(faqAbierta === i ? -1 : i)}
                                aria-expanded={faqAbierta === i}
                            >
                                {f.q}
                                <span className="talla-faq-icono">{faqAbierta === i ? '−' : '+'}</span>
                            </button>
                            <div className="talla-faq-a">
                                <div><p>{f.a}</p></div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="talla-contacto">
                <div className="talla-contacto-inner">
                    <div>
                        <h2 className="talla-h2">
                            Dudas con tu talla
                            <em>escríbenos.</em>
                        </h2>
                        <p className="talla-contacto-lead">
                            Mándanos tu medida por WhatsApp y te confirmamos la talla antes de que hagas
                            el pedido.
                        </p>
                    </div>
                    <div className="talla-contacto-acciones">
                        <div className="talla-contacto-botones">
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-pill black">
                                Consultar mi talla
                            </a>
                            <Link to="/catalogo" className="btn-pill light">Ver el catálogo</Link>
                        </div>
                        <div className="talla-punzones">
                            <span className="punzon">Envío 24 a 48 h en Bogotá</span>
                            <span className="punzon">Pagas al recibir</span>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default RingSizeGuide;

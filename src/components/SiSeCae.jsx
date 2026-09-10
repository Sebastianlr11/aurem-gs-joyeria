/**
 * La red debajo de las pantallas perezosas.
 *
 * ── El fallo que la trajo ──────────────────────────────────────────────────
 *
 * El 9 de septiembre de 2026 el panel se quedó **en blanco**, sin un mensaje,
 * sin un error en consola y sin forma de saber qué hacer. La causa: el borde de
 * Vercel devolvió un **503** al pedir `ProtectedRoute-*.js` justo después de un
 * despliegue. El archivo estaba bien —desde `curl` respondía 200— y un minuto
 * después cargaba sin problema.
 *
 * Lo que convirtió un tropiezo de red de un segundo en «el panel no funciona»
 * fue esto: cuando un `import()` de `React.lazy` falla, la promesa queda
 * rechazada **y el navegador se guarda ese rechazo**. Todo intento posterior
 * dentro de la misma página devuelve el mismo fallo, así que la pantalla no se
 * recupera sola nunca. Y sin una barrera de errores, React desmonta el árbol
 * entero: `#root` vacío, ni un pixel, ni un mensaje.
 *
 * ── Y va a volver a pasar, por diseño ──────────────────────────────────────
 *
 * No hace falta un 503. **Cada despliegue cambia el hash de todos los chunks**,
 * y quien tuviera la pestaña abierta desde antes sigue con el `index.js` viejo,
 * que pide nombres de archivo que ya no existen. La primera pantalla perezosa a
 * la que navegue —el panel, una ficha, el catálogo— se cae igual. Es el precio
 * normal de partir el bundle, y lo paga cualquiera que deje la pestaña abierta
 * mientras se publica algo.
 *
 * Por eso la salida que se ofrece es **recargar**: con el HTML nuevo llegan los
 * nombres nuevos, y se acabó. No es un consejo genérico de «intenta de nuevo»,
 * es exactamente lo que arregla este caso.
 *
 * ── Por qué una clase ─────────────────────────────────────────────────────
 *
 * Porque `componentDidCatch` no tiene equivalente en ganchos: es el único sitio
 * de la aplicación donde React obliga a una clase.
 */
import React from 'react';

/* Cómo se reconoce que lo que falló fue bajar un trozo de la aplicación y no el
   código de la pantalla. Los tres navegadores lo dicen distinto, y ninguno usa
   un tipo de error propio. */
const ES_DE_CARGA = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

class SiSeCae extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        /* Al registro, siempre. Una pantalla que se cae y no deja rastro es la
           que nadie arregla — que es justo lo que pasó con el 503. */
        console.error('Se cayó una pantalla:', error, info?.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        const esDeCarga = ES_DE_CARGA.test(String(error?.message || ''));

        return (
            <main className="secae">
                <span className="secae-icono" aria-hidden="true">✦</span>
                <h1 className="secae-titulo">
                    {esDeCarga ? 'Falta una parte de la página' : 'Algo se rompió acá'}
                </h1>
                <p className="secae-texto">
                    {esDeCarga
                        ? 'No se pudo bajar un trozo de la aplicación. Casi siempre es que acabamos de publicar una versión nueva y esta pestaña se quedó con la vieja. Recargar lo arregla.'
                        : 'Esta pantalla falló al pintarse. Recargar suele bastar; si vuelve a pasar, escríbenos y lo miramos.'}
                </p>
                <div className="secae-acciones">
                    <button className="btn-pill black" onClick={() => window.location.reload()}>
                        Recargar la página
                    </button>
                </div>
                {/* El mensaje crudo, en pequeño: es lo primero que se pide cuando
                    alguien reporta esto por WhatsApp. */}
                <p className="secae-detalle">{String(error?.message || error)}</p>
            </main>
        );
    }
}

export default SiSeCae;

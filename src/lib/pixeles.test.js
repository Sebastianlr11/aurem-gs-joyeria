// @vitest-environment jsdom
/**
 * Que diferir los píxeles no pierda ni un evento.
 *
 * Los píxeles se cargan cuando el navegador está libre —284 KiB de terceros no
 * pueden ir delante de la primera joya— y eso abre una ventana en la que
 * `window.fbq` todavía no existe. Antes, un evento lanzado en esa ventana **se
 * descartaba en silencio**, y el primero de todos es el `PageView` de la
 * visita: el que dice si la pauta trajo a alguien.
 *
 * Se prueba porque el fallo no se ve. No hay error, no hay log: simplemente
 * Meta no se enteró, y eso se descubre semanas después mirando un informe que
 * no cuadra. Y en local no se puede comprobar a mano —los IDs de píxel sólo
 * están en Vercel a propósito, para no ensuciar la medición— así que esta
 * prueba es la única forma de saberlo antes de desplegar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* Los IDs se leen al importar el módulo, así que hay que ponerlos antes y
   recargarlo en cada caso. */
const cargarModulo = async () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '111111111111111');
    vi.stubEnv('VITE_TIKTOK_PIXEL_ID', 'TIKTOKPRUEBA00000000');
    vi.resetModules();
    return import('./pixeles');
};

describe('los píxeles diferidos', () => {
    beforeEach(() => {
        delete window.fbq;
        delete window.ttq;
        vi.unstubAllEnvs();
        /* El fragmento de Meta se cuelga del primer <script> de la página.
           En un navegador siempre hay uno —el del bundle—; en jsdom hay que
           ponerlo, o `cargarMeta()` revienta en la prueba y no en la vida. */
        if (!document.querySelector('script')) {
            document.head.appendChild(document.createElement('script'));
        }
    });

    /* El caso que motivó la cola. */
    it('un PageView lanzado antes de que carguen NO se pierde', async () => {
        const { pixelPagina } = await cargarModulo();

        pixelPagina();          // el píxel todavía no existe

        const track = vi.fn();
        const page = vi.fn();
        window.fbq = track;
        window.ttq = { track: vi.fn(), page };

        /* Al aparecer el píxel, el evento guardado sale. Se fuerza el vaciado
           lanzando otro evento, que es lo que pasa en una visita real: el
           siguiente cambio de ruta o clic arrastra lo pendiente. */
        pixelPagina();

        expect(track).toHaveBeenCalled();
        expect(track.mock.calls.some(c => c[1] === 'PageView')).toBe(true);
        expect(page).toHaveBeenCalled();
    });

    it('con el píxel ya cargado, dispara al momento', async () => {
        const { pixelPagina } = await cargarModulo();
        const track = vi.fn();
        window.fbq = track;
        window.ttq = { track: vi.fn(), page: vi.fn() };

        pixelPagina();
        expect(track).toHaveBeenCalledTimes(1);
    });

    /* Sin tope, una pestaña abierta toda la tarde con un bloqueador de
       anuncios acumularía eventos hasta cansarse. */
    it('la cola no crece sin límite si los píxeles nunca llegan', async () => {
        const { pixelPagina } = await cargarModulo();
        for (let i = 0; i < 500; i++) pixelPagina();

        const track = vi.fn();
        window.fbq = track;
        window.ttq = { track: vi.fn(), page: vi.fn() };
        pixelPagina();

        /* 50 de tope, más el que fuerza el vaciado. Lo que importa es que ni
           se pierda todo ni se guarde sin freno. */
        expect(track.mock.calls.length).toBeGreaterThan(1);
        expect(track.mock.calls.length).toBeLessThanOrEqual(60);
    });

    it('sin IDs de píxel no toca nada, ni encola', async () => {
        vi.stubEnv('VITE_META_PIXEL_ID', '');
        vi.stubEnv('VITE_TIKTOK_PIXEL_ID', '');
        vi.resetModules();
        const { pixelPagina, iniciarPixeles } = await import('./pixeles');

        const track = vi.fn();
        window.fbq = track;
        pixelPagina();
        iniciarPixeles();

        expect(track).not.toHaveBeenCalled();
    });
});

/**
 * Cuándo arrancan, que es lo que decide el bloqueo del hilo principal.
 *
 * Los 284 KiB de Meta y TikTok eran **todo** el TBT de la portada (153 ms de
 * 137 medidos, el 30 de agosto de 2026), así que ahora esperan al primer
 * gesto de la persona. Eso abre dos formas nuevas de equivocarse, y las dos
 * son invisibles: cargarlos igual de pronto —y no ganar nada— o no cargarlos
 * nunca —y dejar de medir la pauta—. Ninguna de las dos da error en pantalla.
 */
describe('cuándo arrancan los píxeles', () => {
    /* Cada caso recarga el módulo con `vi.resetModules()`, pero la ventana de
       jsdom es la misma para todo el archivo: sin esto los oyentes de un caso
       siguen colgados en el siguiente y una sola baliza se cuenta cinco
       veces. En un navegador hay UN módulo y el problema no existe. */
    const suscritos = [];

    beforeEach(() => {
        delete window.fbq;
        delete window.ttq;
        vi.unstubAllEnvs();
        if (!document.querySelector('script')) {
            document.head.appendChild(document.createElement('script'));
        }

        for (const donde of [window, document]) {
            const original = donde.addEventListener.bind(donde);
            vi.spyOn(donde, 'addEventListener').mockImplementation((tipo, fn, opciones) => {
                suscritos.push([donde, tipo, fn]);
                original(tipo, fn, opciones);
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const [donde, tipo, fn] of suscritos.splice(0)) donde.removeEventListener(tipo, fn);
    });

    it('no baja nada hasta que la persona da señales de vida', async () => {
        const { iniciarPixeles, pixelPagina } = await cargarModulo();

        iniciarPixeles();
        pixelPagina();   // el PageView de la visita, que se guarda en la cola

        expect(window.fbq).toBeUndefined();
        expect(window.ttq).toBeUndefined();
    });

    it('un desplazamiento los carga', async () => {
        const { iniciarPixeles } = await cargarModulo();
        iniciarPixeles();

        window.dispatchEvent(new Event('scroll'));

        expect(window.fbq).toBeDefined();
        expect(window.ttq).toBeDefined();
    });

    it('ocultar la pestaña también los carga', async () => {
        const { iniciarPixeles } = await cargarModulo();
        iniciarPixeles();

        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));

        expect(window.fbq).toBeDefined();
    });

    /* El caso que costaría dinero: a la pantalla de gracias se llega volviendo
       de Mercado Pago y se puede cerrar sin tocar nada. Si la venta esperara a
       un gesto, no se contaría ninguna. */
    it('una compra no espera a ningún gesto', async () => {
        const { iniciarPixeles, pixelCompra } = await cargarModulo();
        iniciarPixeles();

        pixelCompra({ pedidoId: 'PED-1', valor: 550000, piezaId: 'x', piezaNombre: 'Anillo' });

        expect(window.fbq).toBeDefined();
        expect(window.ttq).toBeDefined();
    });

    /* Y el que se pierde si nadie lo vigila: quien entra, no toca nada y se
       va. El fragmento nunca llegó a estar vivo, así que la visita se cuenta
       con el píxel de imagen o no se cuenta. */
    it('irse sin tocar nada manda la baliza de Meta', async () => {
        const { iniciarPixeles } = await cargarModulo();
        const llamadas = [];
        vi.stubGlobal('fetch', (url, opciones) => {
            llamadas.push({ url, opciones });
            return Promise.resolve();
        });

        iniciarPixeles();
        window.dispatchEvent(new Event('pagehide'));

        expect(llamadas).toHaveLength(1);
        expect(llamadas[0].url).toContain('facebook.com/tr/');
        expect(llamadas[0].url).toContain('ev=PageView');
        /* Sin `keepalive` el navegador cancela la petición al cerrar la
           página, que es justo el momento en el que se manda. */
        expect(llamadas[0].opciones.keepalive).toBe(true);
        vi.unstubAllGlobals();
    });

    it('si el fragmento ya está vivo, la baliza no duplica la visita', async () => {
        const { iniciarPixeles } = await cargarModulo();
        const llamadas = [];
        vi.stubGlobal('fetch', (url) => { llamadas.push(url); return Promise.resolve(); });

        iniciarPixeles();
        /* `callMethod` es lo que pone fbevents.js cuando de verdad cargó. */
        window.fbq = Object.assign(vi.fn(), { callMethod: vi.fn() });
        window.dispatchEvent(new Event('pagehide'));

        expect(llamadas).toHaveLength(0);
        vi.unstubAllGlobals();
    });
});

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
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

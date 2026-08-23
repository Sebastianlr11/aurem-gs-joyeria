// @vitest-environment jsdom
/**
 * El visor de fotos y los avisos.
 *
 * Estas dos piezas no se pueden probar a mano en el navegador, y esa es
 * exactamente la razón de que valga la pena probarlas aquí: para ver el visor
 * hace falta una foto en un hilo, y para ver un aviso hace falta que entre un
 * mensaje de WhatsApp de verdad. Forzarlo insertando una fila falsa haría que
 * el cron le mandara una plantilla real a un número real.
 *
 * Sacarlas de `ChatPanel.jsx` las volvió comprobables, que es la mitad del
 * motivo para sacarlas. Las dos tenían un fallo latente y aquí están escritos
 * los dos, para que no vuelvan.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisorDeFotos, useAvisos } from './ganchos';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const FOTO = 'https://ejemplo.test/anillo.webp';
const OTRA = 'https://ejemplo.test/dije.webp';

describe('useVisorDeFotos', () => {
    it('empieza cerrado', () => {
        const { result } = renderHook(() => useVisorDeFotos());
        expect(result.current.foto).toBeNull();
        expect(result.current.cerrando).toBe(false);
    });

    it('abrir enseña la foto', () => {
        const { result } = renderHook(() => useVisorDeFotos());
        act(() => result.current.abrir(FOTO));
        expect(result.current.foto).toBe(FOTO);
        expect(result.current.cerrando).toBe(false);
    });

    /* Se cierra en dos tiempos a propósito: primero la clase que desvanece y
       300 ms después se quita la imagen. Desmontarla de golpe corta la
       animación a la mitad. */
    it('cerrar desvanece primero y quita la foto después, no de golpe', () => {
        const { result } = renderHook(() => useVisorDeFotos());
        act(() => result.current.abrir(FOTO));

        act(() => result.current.cerrar());
        expect(result.current.cerrando).toBe(true);
        expect(result.current.foto).toBe(FOTO);          // sigue puesta, desvaneciéndose

        act(() => vi.advanceTimersByTime(300));
        expect(result.current.foto).toBeNull();
        expect(result.current.cerrando).toBe(false);
    });

    /* El fallo que traía de `ChatPanel.jsx`: el reloj del cierre no se
       cancelaba nunca. Abrir una foto durante los 300 ms en que otra se estaba
       cerrando dejaba vivo el reloj viejo, que llegaba puntual y te cerraba la
       que acababas de abrir. */
    it('abrir mientras otra se cierra NO deja que el reloj viejo la cierre', () => {
        const { result } = renderHook(() => useVisorDeFotos());
        act(() => result.current.abrir(FOTO));
        act(() => result.current.cerrar());

        act(() => vi.advanceTimersByTime(100));          // a media animación
        act(() => result.current.abrir(OTRA));
        expect(result.current.foto).toBe(OTRA);
        expect(result.current.cerrando).toBe(false);

        act(() => vi.advanceTimersByTime(500));          // el reloj viejo ya habría llegado
        expect(result.current.foto).toBe(OTRA);
    });

    it('al salir de la pantalla no queda ningún reloj vivo', () => {
        const { result, unmount } = renderHook(() => useVisorDeFotos());
        act(() => result.current.abrir(FOTO));
        act(() => result.current.cerrar());
        unmount();
        expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
        expect(vi.getTimerCount()).toBe(0);
    });
});

const mensaje = (n) => ({ nombre: `Cliente ${n}`, texto: `Mensaje ${n}`, telefono: `57314000000${n}` });

describe('useAvisos', () => {
    it('empieza sin avisos', () => {
        const { result } = renderHook(() => useAvisos());
        expect(result.current.avisos).toEqual([]);
    });

    it('un aviso aparece y se va solo a los cinco segundos', () => {
        const { result } = renderHook(() => useAvisos());
        act(() => result.current.avisar(mensaje(1)));
        expect(result.current.avisos).toHaveLength(1);
        expect(result.current.avisos[0]).toMatchObject({ nombre: 'Cliente 1', texto: 'Mensaje 1' });

        act(() => vi.advanceTimersByTime(4999));
        expect(result.current.avisos).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1));
        expect(result.current.avisos).toHaveLength(0);
    });

    /* El otro fallo que traía de `ChatPanel.jsx`: el identificador era
       `toast-${Date.now()}`, así que dos mensajes en el mismo milisegundo
       —dos clientas a la vez, o un mensaje troceado— compartían id. React
       repetía la clave y el reloj del primero se llevaba los dos por delante. */
    it('dos mensajes en el mismo milisegundo no comparten identificador', () => {
        const { result } = renderHook(() => useAvisos());
        act(() => { result.current.avisar(mensaje(1)); result.current.avisar(mensaje(2)); });

        const ids = result.current.avisos.map(a => a.id);
        expect(ids).toHaveLength(2);
        expect(new Set(ids).size).toBe(2);
    });

    it('no se apilan más de cinco: los viejos ceden el sitio', () => {
        const { result } = renderHook(() => useAvisos());
        act(() => { for (let i = 1; i <= 8; i++) result.current.avisar(mensaje(i)); });
        expect(result.current.avisos).toHaveLength(5);
        expect(result.current.avisos[0].texto).toBe('Mensaje 4');
        expect(result.current.avisos[4].texto).toBe('Mensaje 8');
    });

    it('descartar quita sólo el que se tocó', () => {
        const { result } = renderHook(() => useAvisos());
        act(() => { result.current.avisar(mensaje(1)); result.current.avisar(mensaje(2)); });
        const [primero] = result.current.avisos;
        act(() => result.current.descartar(primero.id));
        expect(result.current.avisos).toHaveLength(1);
        expect(result.current.avisos[0].texto).toBe('Mensaje 2');
    });

    /* Un aviso que sobrevive a su conversación lleva, al tocarlo, a un chat
       que ya no existe. */
    it('al borrar conversaciones se van sus avisos y sólo los suyos', () => {
        const { result } = renderHook(() => useAvisos());
        act(() => { result.current.avisar(mensaje(1)); result.current.avisar(mensaje(2)); });
        act(() => result.current.olvidar(new Set(['573140000001'])));
        expect(result.current.avisos).toHaveLength(1);
        expect(result.current.avisos[0].telefono).toBe('573140000002');
    });

    it('al salir de la pantalla no queda ningún reloj vivo', () => {
        const { result, unmount } = renderHook(() => useAvisos());
        act(() => { result.current.avisar(mensaje(1)); result.current.avisar(mensaje(2)); });
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});

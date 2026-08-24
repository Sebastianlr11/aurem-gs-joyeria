// @vitest-environment jsdom
/**
 * Marcar varias conversaciones y archivarlas de una vez.
 *
 * La distinción que hay que tener escrita es `null` contra conjunto vacío:
 * `null` es «no estoy en modo selección» y el conjunto vacío es «estoy, y no
 * he marcado nada». La lista se comporta al revés en cada caso —en el primero
 * pulsar una fila la ABRE, en el segundo la MARCA— y confundirlos es cómo se
 * llega a que un clic haga lo contrario de lo que espera quien lo dio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const falso = vi.hoisted(() => ({ upserts: [], error: null }));

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            upsert: async (filas, opciones) => {
                falso.upserts.push({ filas, opciones });
                return { error: falso.error };
            },
        }),
    },
}));

const { useSeleccion } = await import('./ganchos');

beforeEach(() => { falso.upserts = []; falso.error = null; });

describe('useSeleccion', () => {
    it('empieza fuera del modo selección, que no es lo mismo que vacío', () => {
        const { result } = renderHook(() => useSeleccion());
        expect(result.current.marcadas).toBeNull();
    });

    it('entrar sin nada deja un conjunto vacío, no null', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar());
        expect(result.current.marcadas).toBeInstanceOf(Set);
        expect(result.current.marcadas.size).toBe(0);
    });

    it('entrar con una lista las deja marcadas', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a', 'b', 'c']));
        expect([...result.current.marcadas]).toEqual(['a', 'b', 'c']);
    });

    it('salir vuelve a null, no a un conjunto vacío', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a']));
        act(() => result.current.salir());
        expect(result.current.marcadas).toBeNull();
    });

    it('alternar marca y desmarca', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar([]));
        act(() => result.current.alternar('a'));
        expect([...result.current.marcadas]).toEqual(['a']);
        act(() => result.current.alternar('a'));
        expect(result.current.marcadas.size).toBe(0);
    });

    /* Alternar sin haber entrado enciende el modo con esa marcada. Es lo que
       pasa al pulsar una casilla desde fuera, y es el comportamiento que ya
       tenía el panel. */
    it('alternar desde fuera del modo lo enciende con esa marcada', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.alternar('a'));
        expect([...result.current.marcadas]).toEqual(['a']);
    });

    it('olvidar suelta las que ya no existen y respeta el modo apagado', () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a', 'b', 'c']));
        act(() => result.current.olvidar(new Set(['b'])));
        expect([...result.current.marcadas]).toEqual(['a', 'c']);

        act(() => result.current.salir());
        act(() => result.current.olvidar(new Set(['a'])));
        expect(result.current.marcadas).toBeNull();      // no lo enciende sin querer
    });
});

describe('archivar en lote', () => {
    it('va en UN solo upsert, no una fila por conversación', async () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a', 'b', 'c']));
        const hecho = vi.fn();
        await act(() => result.current.archivar(hecho));

        expect(falso.upserts).toHaveLength(1);
        expect(falso.upserts[0].filas).toHaveLength(3);
        expect(falso.upserts[0].opciones).toEqual({ onConflict: 'phone_number' });
        expect(falso.upserts[0].filas[0]).toMatchObject({ phone_number: 'a', is_archived: true });
    });

    it('al terminar avisa con lo archivado y sale del modo', async () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a', 'b']));
        const hecho = vi.fn();
        await act(() => result.current.archivar(hecho));

        expect(hecho).toHaveBeenCalledWith(['a', 'b']);
        expect(result.current.marcadas).toBeNull();
        expect(result.current.archivando).toBe(false);
    });

    /* Si la base dijo que no, NO se puede avisar de que se archivó: el panel
       marcaría como archivadas conversaciones que siguen en la bandeja, y la
       pantalla estaría mintiendo hasta la siguiente recarga. */
    it('si la base falla no avisa, no sale del modo y lo dice', async () => {
        falso.error = { message: 'se cayó' };
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a', 'b']));
        const hecho = vi.fn();
        await act(() => result.current.archivar(hecho));

        expect(hecho).not.toHaveBeenCalled();
        expect([...result.current.marcadas]).toEqual(['a', 'b']);
        expect(result.current.error).toContain('se cayó');
    });

    it('sin nada marcado no toca la base', async () => {
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar([]));
        await act(() => result.current.archivar(vi.fn()));
        expect(falso.upserts).toHaveLength(0);
    });

    it('el error se puede descartar a mano', async () => {
        falso.error = { message: 'se cayó' };
        const { result } = renderHook(() => useSeleccion());
        act(() => result.current.entrar(['a']));
        await act(() => result.current.archivar(vi.fn()));
        await waitFor(() => expect(result.current.error).not.toBe(''));
        act(() => result.current.setError(''));
        expect(result.current.error).toBe('');
    });
});

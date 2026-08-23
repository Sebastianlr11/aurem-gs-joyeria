// @vitest-environment jsdom
/**
 * Los datos de la ficha del contacto.
 *
 * Lo que se prueba aquí no es lo que se mudó de `ChatPanel.jsx` —eso se
 * comprobó en el navegador, pantalla contra pantalla— sino las dos cosas que
 * se AÑADIERON al sacarlo, que son las que nadie ha visto funcionar:
 *
 *   · que al cambiar de conversación se descarte lo que llegue tarde de la
 *     anterior, y
 *   · que cancelar las notas devuelva lo guardado en vez de dejar el borrador.
 *
 * La primera es una carrera: no se puede provocar a mano porque depende de que
 * una respuesta de la base llegue después de que hayas cambiado de chat.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const falso = vi.hoisted(() => ({ clientes: {}, pedidos: {}, retrasos: {}, guardados: [] }));

/* El constructor de Supabase encadena: .select().or().maybeSingle() para la
   ficha, y .select().or().order().limit() para los pedidos. Los dos terminan
   en un `then`, así que basta con devolverse a sí mismo y resolver al final. */
vi.mock('../../../lib/supabase', () => {
    const constructor = (tabla) => {
        let telefono = null, actualizar = null;
        const b = {
            select: () => b,
            order: () => b,
            limit: () => b,
            eq: (_col, v) => { telefono = telefono ?? v; return b; },
            update: (payload) => { actualizar = payload; return b; },
            or: (filtro) => { telefono = filtro.match(/\.eq\.(\d+)/)?.[1]; return b; },
            maybeSingle: () => b,
            then: (ok) => {
                if (actualizar) { falso.guardados.push({ tabla, ...actualizar }); return Promise.resolve().then(() => ok({ error: null })); }
                const datos = tabla === 'customers' ? falso.clientes[telefono] ?? null : falso.pedidos[telefono] ?? [];
                const espera = falso.retrasos[telefono] ?? 0;
                return new Promise(r => setTimeout(r, espera)).then(() => ok({ data: datos }));
            },
        };
        return b;
    };
    return { supabase: { from: constructor } };
});

const { useFichaDelContacto } = await import('./ganchos');

beforeEach(() => {
    falso.clientes = {
        573000000001: { id: 'c1', name: 'Ana', notes: 'lo que está guardado' },
        573000000002: { id: 'c2', name: 'Beatriz', notes: null },
    };
    falso.pedidos = { 573000000001: [{ id: 'p1' }], 573000000002: [] };
    falso.retrasos = {};
    falso.guardados = [];
});

describe('useFichaDelContacto', () => {
    it('trae el cliente, sus pedidos y sus notas', async () => {
        const { result } = renderHook(() => useFichaDelContacto('573000000001'));
        await waitFor(() => expect(result.current.cliente?.name).toBe('Ana'));
        expect(result.current.pedidos).toHaveLength(1);
        expect(result.current.notas).toBe('lo que está guardado');
    });

    it('sin teléfono no pide nada', async () => {
        const { result } = renderHook(() => useFichaDelContacto(null));
        await new Promise(r => setTimeout(r, 20));
        expect(result.current.cliente).toBeNull();
        expect(result.current.pedidos).toEqual([]);
    });

    /* La carrera: si la respuesta de la primera conversación llega DESPUÉS de
       que ya cambiaste a la segunda, no puede pintar la ficha de quien acabas
       de dejar sobre el chat de quien acabas de abrir. */
    it('una respuesta lenta de la conversación anterior no pisa la nueva', async () => {
        falso.retrasos[573000000001] = 60;
        const { result, rerender } = renderHook(({ t }) => useFichaDelContacto(t), {
            initialProps: { t: '573000000001' },
        });
        rerender({ t: '573000000002' });                       // se cambia antes de que llegue Ana
        await waitFor(() => expect(result.current.cliente?.name).toBe('Beatriz'));
        await new Promise(r => setTimeout(r, 120));            // ya llegó la de Ana, tarde
        expect(result.current.cliente.name).toBe('Beatriz');
        expect(result.current.notas).toBe('');
    });

    it('cancelar devuelve lo guardado, no deja el borrador', async () => {
        const { result } = renderHook(() => useFichaDelContacto('573000000001'));
        await waitFor(() => expect(result.current.cliente?.name).toBe('Ana'));

        act(() => { result.current.setEditandoNotas(true); result.current.setNotas('borrador a medias'); });
        expect(result.current.notas).toBe('borrador a medias');

        act(() => result.current.cancelarNotas());
        expect(result.current.notas).toBe('lo que está guardado');
        expect(result.current.editandoNotas).toBe(false);
        expect(falso.guardados).toHaveLength(0);               // y no tocó la base
    });

    it('guardar escribe en la base y deja la ficha al día sin volver a pedirla', async () => {
        const { result } = renderHook(() => useFichaDelContacto('573000000001'));
        await waitFor(() => expect(result.current.cliente?.name).toBe('Ana'));

        act(() => result.current.setNotas('la nueva nota'));
        await act(() => result.current.guardarNotas());

        expect(falso.guardados).toEqual([{ tabla: 'customers', notes: 'la nueva nota' }]);
        expect(result.current.cliente.notes).toBe('la nueva nota');
        expect(result.current.editandoNotas).toBe(false);
    });

    it('sin cliente en la base, guardar no escribe nada', async () => {
        const { result } = renderHook(() => useFichaDelContacto('573000000009'));
        await new Promise(r => setTimeout(r, 20));
        await act(() => result.current.guardarNotas());
        expect(falso.guardados).toHaveLength(0);
    });
});

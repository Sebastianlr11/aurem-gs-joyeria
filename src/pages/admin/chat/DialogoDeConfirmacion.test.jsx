// @vitest-environment jsdom
/**
 * El «¿seguro?» del chat.
 *
 * Se prueba porque al unificar los dos diálogos en uno **cambió un
 * comportamiento**: el de archivar no bloqueaba el clic del fondo mientras
 * trabajaba y el de las fotos sí. Ahora los dos lo bloquean, y eso es lo que
 * hay que dejar fijado — darle a Cancelar cuando el borrado ya salió hacia el
 * servidor no cancela nada, sólo hace creer que sí.
 *
 * Y el de las fotos no se puede abrir a mano si el hilo no tiene fotos, que es
 * justo el caso de la conversación de pruebas.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import DialogoDeConfirmacion from './DialogoDeConfirmacion';

afterEach(cleanup);

const pintar = (extra = {}) => {
    const onCancelar = vi.fn(), onConfirmar = vi.fn();
    render(
        <DialogoDeConfirmacion
            titulo="¿Archivar conversación?"
            texto="Volverá si envía un mensaje."
            accion="Archivar"
            onCancelar={onCancelar}
            onConfirmar={onConfirmar}
            {...extra}
        />,
    );
    const boton = (t) => screen.getByRole('button', { name: t });
    return { onCancelar, onConfirmar, boton };
};

describe('en reposo', () => {
    it('enseña el título, el texto y los dos botones', () => {
        const { boton } = pintar();
        expect(screen.getByRole('heading').textContent).toBe('¿Archivar conversación?');
        expect(screen.getByText('Volverá si envía un mensaje.')).toBeTruthy();
        expect(boton('Cancelar')).toBeTruthy();
        expect(boton('Archivar')).toBeTruthy();
    });

    /* El tono no es decoración: `danger` es para lo que no vuelve —las fotos se
       borran del bucket— y `primary` para lo que se deshace solo. */
    it('el tono viaja a la clase del botón', () => {
        const { boton } = pintar();
        expect(boton('Archivar').className).toContain('chat-confirm-btn--primary');
        cleanup();
        const otro = pintar({ tono: 'danger', accion: 'Borrar las fotos' });
        expect(otro.boton('Borrar las fotos').className).toContain('chat-confirm-btn--danger');
    });

    it('cancelar y confirmar llaman a lo suyo', () => {
        const { onCancelar, onConfirmar, boton } = pintar();
        boton('Cancelar').click();
        boton('Archivar').click();
        expect(onCancelar).toHaveBeenCalledTimes(1);
        expect(onConfirmar).toHaveBeenCalledTimes(1);
    });

    it('el clic en el fondo cancela, y el del modal no se propaga', () => {
        const { onCancelar } = pintar();
        document.querySelector('.chat-confirm-overlay').click();
        expect(onCancelar).toHaveBeenCalledTimes(1);
        document.querySelector('.chat-confirm-modal').click();
        expect(onCancelar).toHaveBeenCalledTimes(1);   // sigue en una
    });
});

describe('mientras la acción corre', () => {
    /* Esto es lo que se unificó. El diálogo de archivar no lo hacía. */
    it('el fondo deja de cerrar', () => {
        const { onCancelar } = pintar({ ocupado: true });
        document.querySelector('.chat-confirm-overlay').click();
        expect(onCancelar).not.toHaveBeenCalled();
    });

    it('los dos botones se apagan', () => {
        const { boton } = pintar({ ocupado: true, textoOcupado: 'Borrando…' });
        expect(boton('Cancelar').disabled).toBe(true);
        expect(boton('Borrando…').disabled).toBe(true);
    });

    it('el botón de acción dice qué está pasando', () => {
        pintar({ ocupado: true, accion: 'Borrar las fotos', textoOcupado: 'Borrando…' });
        expect(screen.queryByRole('button', { name: 'Borrar las fotos' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Borrando…' })).toBeTruthy();
    });

    /* Si no se le da un texto de ocupado, se queda con el de la acción en vez
       de quedarse en blanco. */
    it('sin texto de ocupado no se queda mudo', () => {
        const { boton } = pintar({ ocupado: true });
        expect(boton('Archivar').disabled).toBe(true);
    });
});

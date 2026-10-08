import { supabase } from './supabase';

/* Manda un mensaje por la función wa-send y, si falla, lanza el motivo que
   ELLA dio.

   `supabase.functions.invoke` se traga el cuerpo de toda respuesta que no sea
   2xx y deja sólo «Edge Function returned a non-2xx status code». Y aquí el
   cuerpo es lo único que explica el porqué: el 7 de octubre de 2026 el chat
   enseñó ese texto en inglés a quien intentaba contestarle a una clienta que
   había escrito el día anterior — era la ventana de 24 h cerrada (un 409),
   que es un caso normal y tiene salida, no una avería. El diálogo del
   certificado ya lo leía; el chat y el selector de fotos no. */
export async function enviarPorWhatsApp({ telefono, texto, imagenUrl }) {
    const { data, error } = await supabase.functions.invoke('wa-send', {
        body: { telefono, texto, imagenUrl },
    });
    if (error) {
        const cuerpo = await error.context?.json?.().catch(() => null);
        throw new Error(cuerpo?.error || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
}

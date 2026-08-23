/**
 * Dos trozos de estado del panel de conversaciones que se valen solos: el
 * visor de fotos y los avisos de mensaje nuevo.
 *
 * Salieron de `ChatPanel.jsx` el 23 de agosto de 2026, después del buscador.
 * Son ganchos y no componentes porque lo que estorbaba en el archivo grande no
 * era la pintura —nueve y diez líneas de JSX— sino el estado, los relojes y la
 * limpieza, que estaban repartidos por cuatro sitios distintos del componente.
 *
 * Están juntos en un archivo sin componentes por la regla de siempre:
 * `react-refresh/only-export-components` no deja mezclar las dos cosas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/* Tiene que cuadrar con la animación `.lb-closing` de panel.css. Si allí se
   cambia la duración, aquí también, o la foto se queda a medio desvanecer. */
const CIERRE_MS = 300;

/**
 * El visor a pantalla completa de una foto del chat.
 *
 * Se cierra en dos tiempos —primero la clase que desvanece, luego quitar la
 * imagen— porque desmontarla de golpe corta la animación.
 *
 * **Arregla un fallo que venía de antes:** el reloj del cierre no se cancelaba
 * nunca. Si abrías una foto durante los 300 ms en que otra se estaba cerrando,
 * el reloj viejo llegaba igual y te cerraba la que acababas de abrir. Y al
 * salir de la pantalla con el visor abierto, el temporizador seguía vivo
 * intentando tocar un componente desmontado.
 */
export function useVisorDeFotos() {
    const [foto, setFoto] = useState(null);
    const [cerrando, setCerrando] = useState(false);
    const reloj = useRef(null);

    useEffect(() => () => clearTimeout(reloj.current), []);

    const abrir = useCallback((url) => {
        clearTimeout(reloj.current);
        setFoto(url);
        setCerrando(false);
    }, []);

    const cerrar = useCallback(() => {
        setCerrando(true);
        reloj.current = setTimeout(() => { setFoto(null); setCerrando(false); }, CIERRE_MS);
    }, []);

    return { foto, cerrando, abrir, cerrar };
}

/* Cuánto dura un aviso en pantalla, y cuántos caben a la vez. Cinco segundos
   es lo que se tarda en leer un nombre y media frase; más, y se acumulan
   tapando el chat. */
const VIDA_MS = 5000;
const MAXIMO = 5;

/**
 * Los avisos de que llegó un mensaje en OTRA conversación.
 *
 * Sólo para la que no estás mirando: si el mensaje entra en el chat abierto ya
 * se ve solo, y avisar de lo que está a la vista es ruido.
 *
 * **Arregla otro fallo que venía de antes:** el identificador era
 * `toast-${Date.now()}`, así que dos mensajes en el mismo milisegundo —dos
 * clientas escribiendo a la vez, o un mensaje troceado— compartían id. React
 * repetía la clave y, peor, el reloj del primero se llevaba los dos por
 * delante.
 */
export function useAvisos() {
    const [avisos, setAvisos] = useState([]);
    const relojes = useRef([]);

    useEffect(() => () => { relojes.current.forEach(clearTimeout); relojes.current = []; }, []);

    const avisar = useCallback(({ nombre, texto, telefono }) => {
        const id = `aviso-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setAvisos(prev => [...prev.slice(-(MAXIMO - 1)), { id, nombre, texto, telefono }]);
        relojes.current.push(
            setTimeout(() => setAvisos(prev => prev.filter(a => a.id !== id)), VIDA_MS),
        );
    }, []);

    const descartar = useCallback((id) => {
        setAvisos(prev => prev.filter(a => a.id !== id));
    }, []);

    /* Al borrar conversaciones hay que llevarse sus avisos: uno que sobreviva
       a su chat lleva, al tocarlo, a una conversación que ya no existe. */
    const olvidar = useCallback((telefonos) => {
        setAvisos(prev => prev.filter(a => !telefonos.has(a.telefono)));
    }, []);

    return { avisos, avisar, descartar, olvidar };
}

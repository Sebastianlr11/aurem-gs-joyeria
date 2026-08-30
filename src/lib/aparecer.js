import { useEffect, useLayoutEffect, useRef } from 'react'

/* En el servidor no hay diseño que medir y React avisa por consola cada vez
   que se usa `useLayoutEffect` — una línea por componente animado, en cada
   build, desde que `scripts/prerenderizar.mjs` pinta la portada en Node. Es
   el mismo hook en el navegador; en Node no hace nada, que es lo correcto:
   el estado oculto lo pone el efecto, y el HTML del build tiene que salir
   con el contenido visible. */
const useEfectoDeDiseno = typeof window === 'undefined' ? useEffect : useLayoutEffect

/* Cuánto antes de entrar en pantalla empieza la animación. Sin esto el
   movimiento arranca cuando la sección ya lleva medio segundo a la vista y
   se siente tarde. */
const MARGEN = '-80px'

/**
 * Cuándo NO se anima y se muestra todo de una.
 *
 * Tres casos, y el tercero importa más de lo que parece: Chrome no ejecuta
 * IntersectionObserver en pestañas ocultas. Si alguien abre el sitio con
 * clic central, o un generador de vistas previas lo renderiza sin mostrarlo,
 * el observador nunca dispara y las secciones se quedarían invisibles para
 * siempre. Vale más una portada sin animación que una portada en blanco.
 */
const noAnimar = () =>
  typeof IntersectionObserver === 'undefined' ||
  (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  (typeof document !== 'undefined' && document.visibilityState === 'hidden')

function observarUnaVez(el, alEntrar) {
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      alEntrar()
      // Una sola vez: al volver a subir no se esconde de nuevo.
      obs.disconnect()
    }
  }, { rootMargin: MARGEN })
  obs.observe(el)
  return () => obs.disconnect()
}

/**
 * Aparecer al entrar en pantalla.
 *
 * Reemplaza a framer-motion, que estaba en el proyecto para exactamente
 * esto: unas secciones que se desvanecen hacia arriba al hacer scroll. Eran
 * 41 KB comprimidos en el camino crítico de la portada —más que todo el CSS
 * del sitio— por un trabajo que el navegador hace con un IntersectionObserver
 * y una transición.
 *
 * El estado oculto lo pone el hook y NO el JSX. Si el JavaScript no llega a
 * correr —falla la red, un navegador viejo, un rastreador— el contenido queda
 * visible en vez de invisible para siempre. Vale más una sección sin animar
 * que una sección que no está.
 */
export function useAparecer(direccion = 'y') {
  const ref = useRef(null)

  useEfectoDeDiseno(() => {
    const el = ref.current
    if (!el || noAnimar()) return
    el.classList.add('aparece', `aparece--${direccion}`)
  }, [direccion])

  useEffect(() => {
    const el = ref.current
    if (!el || noAnimar()) return
    return observarUnaVez(el, () => el.classList.add('aparece--visible'))
  }, [])

  return ref
}

/**
 * Lo mismo para una rejilla: los hijos entran uno detrás de otro.
 *
 * El contenedor no se mueve —igual que el `stagger` de antes, que sólo
 * orquestaba— y las clases se las pone a los hijos el propio hook, por la
 * misma razón de arriba. `paso` es el retraso entre uno y el siguiente.
 *
 * `llave` es para las rejillas cuyos hijos llegan después, de una consulta:
 * los efectos corren al montar, y los hijos que aparecen más tarde no pasarían
 * por aquí —se verían, sin animar, que es el fallo tolerable, pero se verían
 * distinto que el resto de la portada—. Pasando algo que cambie cuando cambien
 * los hijos, se les pone la clase a ellos también. Las rejillas fijas no lo
 * pasan y se comportan igual que siempre.
 */
export function useAparecerGrupo(paso = 0.12, llave = null) {
  const ref = useRef(null)

  useEfectoDeDiseno(() => {
    const el = ref.current
    if (!el || noAnimar()) return
    Array.from(el.children).forEach((hijo, i) => {
      hijo.classList.add('aparece', 'aparece--y')
      hijo.style.setProperty('--i', String(i))
      hijo.style.setProperty('--paso', `${paso}s`)
    })
  }, [paso, llave])

  useEffect(() => {
    const el = ref.current
    if (!el || noAnimar()) return
    return observarUnaVez(el, () => {
      for (const hijo of el.children) hijo.classList.add('aparece--visible')
    })
  }, [llave])

  return ref
}

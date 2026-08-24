# Páginas de contenido — legales y guía de tallas

> **Estado:** en producción
> **Última revisión:** 2026-08-23

## Qué resuelve

Dos cosas distintas que comparten patrón de maquetación:

1. **Las tres páginas legales** — obligación normativa (Ley 1581 de datos personales, Ley
   1480 de protección al consumidor) y, sobre todo, **señal de que la tienda es real**.
   Quien duda de una joyería online sí abre la política de devoluciones.
2. **La guía de tallas** — quita el mayor freno para comprar un anillo por internet: *"¿y
   si no me queda?"*. Es una calculadora que funciona de verdad, no una tabla decorativa.

## Cómo funciona hoy

### Rutas

| Ruta | Componente | Líneas |
|---|---|---|
| `/politica-de-privacidad` | `src/pages/PrivacyPolicy.jsx` | 118 |
| `/terminos-de-servicio` | `src/pages/TermsOfService.jsx` | 99 |
| `/politica-de-devoluciones` | `src/pages/ReturnsPolicy.jsx` | 78 |
| `/guia-de-tallas` | `src/pages/RingSizeGuide.jsx` | 261 |

Las cuatro con Navbar + Footer. Las tres legales son componentes estáticos con el mismo
patrón `<Section title>` → `.legal-page` / `.legal-section`.

### La calculadora de tallas

| Ruta | Qué |
|---|---|
| `src/pages/RingSizeGuide.jsx:7-12` | Tabla US 3 → 12,5 con circunferencia en mm |
| `src/pages/RingSizeGuide.jsx:14-18` | Tres unidades de entrada: circunferencia en mm, en cm, o diámetro en mm (convertido por π) |
| `src/pages/RingSizeGuide.jsx:95-96` | Tolerancia de ±0,35 mm, **redondeando hacia arriba** |
| `src/pages/RingSizeGuide.jsx:88-93` | Fuera de rango → deriva a fabricación a medida |
| `src/pages/RingSizeGuide.jsx:36-56` | Cuatro FAQs propias, independientes de `Faq.jsx` |

### Tablas y variables de entorno

Ninguna. Las cuatro páginas son estáticas.

## Decisiones tomadas y por qué

**La talla se redondea hacia arriba** (`:95-96`). No es simetría: un anillo un poco holgado
se puede ajustar; uno que no entra en el dedo no sirve. La tolerancia de ±0,35 mm reconoce
que medir un dedo con un hilo no es un instrumento de precisión.

**Fuera de rango no es un error, es una venta.** Si la medida cae fuera de US 3–12,5, en
vez de decir "valor inválido" ofrece fabricación a medida (`:88-93`) — que es justamente
lo que el taller sabe hacer.

**Tres unidades de entrada** porque la gente mide como puede: con un hilo y una regla en
centímetros, con un metro de costura en milímetros, o midiendo un anillo que ya tiene por
dentro.

**La guía tiene sus propias FAQs** (`:36-56`) en vez de reutilizar `Faq.jsx`: las preguntas
de talla no son las preguntas de compra.

**La política de privacidad nombra explícitamente** los datos de navegación, las
**conversaciones de WhatsApp incluyendo fotos y notas de voz**, y la talla de anillo. Es
lo correcto: el sistema efectivamente guarda todo eso, y Valentina procesa audio e imagen.

## Límites conocidos y pendientes

- ~~**Contradicción legal viva**~~ — cerrada el 23 de agosto de 2026. El FAQ prometía 30
  días para devolver y la política decía 5 días hábiles; obligaba el más generoso, así que
  el sitio se comprometía a 30 sin quererlo. Se decidió el plazo legal —**5 días hábiles de
  retracto**— y quedaron separados del todo el retracto y la garantía contra defectos, que
  el FAQ mezclaba. Ver [pendientes #8](../pendientes.md).
- ~~**La política fechada en febrero de 2025**~~ — al día, como las otras dos.
- ~~**Ninguna llama a `ponerMeta`**~~ — las cuatro montan `<Meta>` (`src/components/Meta.jsx`),
  con su propio título, descripción y canónica. Ver [pendientes #14](../pendientes.md).
- Valentina responde de devoluciones desde `taller_conocimiento`, no desde estos archivos:
  si cambia el plazo aquí, hay que cambiarlo también allá
  (`20260823_conocimiento_devoluciones.sql`).

## Cómo probarlo

```bash
npm run dev
```

1. **Calculadora:** 54 mm de circunferencia debe dar una talla coherente; probar las tres
   unidades con la misma medida real y comprobar que coinciden.
2. **Fuera de rango:** meter 40 mm y 80 mm — debe ofrecer fabricación a medida, no un error.
3. **Redondeo:** una medida justo entre dos tallas debe dar la mayor.
4. **Coherencia legal:** comparar el plazo de devolución del FAQ de la portada con el de la
   política. Hoy **no coinciden** (30 días vs 5 días hábiles).
5. Mirar el `<title>` de cada legal en el navegador: hoy todas dicen lo mismo que la portada.

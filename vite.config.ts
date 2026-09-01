import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  /* El mismo target que ya declara `tsconfig.app.json`. Sin esto Vite
     transpila para navegadores que esta tienda no recibe —22 KiB de
     transformaciones heredadas en el bundle público— y quien paga ese peso es
     una clienta mirando el catálogo en la calle con datos. */
  build: {
    target: 'es2022',
  },

  /* Las pruebas viven al lado de lo que prueban (`src/lib/dinero.test.js`),
     no en una carpeta aparte: así se ven al abrir la carpeta y cuesta más
     olvidarlas cuando se cambia la función.

     Entorno de Node y no de navegador a propósito. Lo que se prueba hoy son
     las cuentas de plata, que son funciones puras; montar jsdom para eso son
     segundos de arranque en cada corrida a cambio de nada. El día que se
     prueben componentes, se añade jsdom para esos archivos. */
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.{js,jsx,ts,tsx}',
      /* Las edge functions corren en Deno, no en Node, así que la mayoría de
         ese código no se puede cargar desde aquí: importa de `jsr:` y llama a
         `Deno.env`. Lo que sí se prueba es `_shared/reglas.ts`, que existe
         justamente por eso — es la lógica de Valentina sin nada de Deno
         dentro, para que se pueda comprobar. */
      'supabase/functions/**/*.test.ts',
      /* El asunto de los correos vive en `emails/_render.ts` y no en la
         plantilla, que es justo donde nadie lo busca: el 1 de septiembre de
         2026 se cambió la plantilla entera del contraentrega y el asunto se
         quedó diciendo «recibimos tu pago» a quien iba a pagar en su puerta. */
      'emails/**/*.test.ts',
    ],
  },
})

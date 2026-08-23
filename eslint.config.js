import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/* Este repositorio tiene cuatro clases de código que corren en sitios
   distintos, y hasta ahora todas recibían las mismas reglas: las del navegador
   y las de React.

   Eso no era estricto, era ruido. El lint marcaba `Deno` como variable no
   definida en las edge functions —donde es un global del runtime— y pedía
   Fast Refresh en plantillas de correo que nunca se refrescan en caliente.
   Veintinueve avisos que no señalaban ningún defecto, y que por eso mismo
   hacían imposible exigir cero.

   Ahora cada contexto tiene las reglas que le corresponden. */

export default defineConfig([
  globalIgnores([
    'dist',
    /* Generado por scripts/correos.mjs en cada build, y en .gitignore. */
    'api/_plantillas.mjs',
  ]),

  /* ── La aplicación: navegador y React ──────────────────────────────── */
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  /* ── Edge functions: Deno ──────────────────────────────────────────── */
  {
    files: ['supabase/functions/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      /* `globals` no trae el juego de Deno, y de él sólo se usa el objeto
         Deno. El resto de globales son los mismos de la plataforma web. */
      globals: { ...globals.browser, Deno: 'readonly' },
    },
    rules: {
      /* Estas funciones reciben JSON de Mercado Pago, Meta, TikTok y WhatsApp.
         Son cuerpos ajenos que cambian sin avisar: escribir un tipo para cada
         uno daría una falsa sensación de garantía —el tipo no valida nada en
         tiempo de ejecución— y quedaría desactualizado en la primera versión
         nueva de su API. En la frontera, `any` es lo honesto; lo que protege
         de verdad son las comprobaciones que ya hace el código. */
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  /* ── Endpoints de Vercel y guiones de construcción: Node ───────────── */
  {
    files: ['api/**/*.js', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  /* ── Plantillas de correo: React, pero compiladas por esbuild ──────── */
  {
    files: ['emails/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    /* Sin reglas de Fast Refresh: esto no se recarga en caliente, se compila a
       api/_plantillas.mjs y se manda por correo. Un archivo que exporta la
       plantilla y sus ayudantes está bien aquí. */
  },
])

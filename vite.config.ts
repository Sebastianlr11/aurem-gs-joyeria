import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  /* Las pruebas viven al lado de lo que prueban (`src/lib/dinero.test.js`),
     no en una carpeta aparte: así se ven al abrir la carpeta y cuesta más
     olvidarlas cuando se cambia la función.

     Entorno de Node y no de navegador a propósito. Lo que se prueba hoy son
     las cuentas de plata, que son funciones puras; montar jsdom para eso son
     segundos de arranque en cada corrida a cambio de nada. El día que se
     prueben componentes, se añade jsdom para esos archivos. */
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
})

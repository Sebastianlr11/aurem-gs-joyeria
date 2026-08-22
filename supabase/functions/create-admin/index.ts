/**
 * Alta, baja y listado de quienes entran al panel.
 *
 * Esta función usa SUPABASE_SERVICE_ROLE_KEY, que se salta RLS y puede crear y
 * borrar cuentas. Comprobaba que quien llamaba estuviera autenticado, pero no
 * quién era — y como en este proyecto todo usuario de Supabase Auth es
 * administrador, eso significaba que cualquiera con una sesión podía darse de
 * alta otra cuenta o **borrar la del dueño** y quedarse con el panel.
 *
 * Ahora manda el dueño y nadie más. El rol vive en `app_metadata`, que sólo se
 * puede escribir con la llave de servicio: `user_metadata` no sirve, porque esa
 * sí la puede cambiar el propio usuario desde el navegador y se marcaría dueño
 * solo.
 *
 * Sobre el arranque: exigir el rol sin que nadie lo tenga dejaría el panel sin
 * administrador posible, y hay que acordarse de sellar al dueño ANTES de
 * desplegar — justo la clase de paso que se olvida y deja a alguien fuera de su
 * propia tienda. Así que mientras no haya ningún dueño sellado, manda la cuenta
 * más antigua y se le graba el rol en ese mismo momento. No es una puerta: nadie
 * puede crear una cuenta anterior a la primera, y en cuanto se usa una vez la
 * excepción se cierra sola.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/* Supabase pagina en 50 por omisión. El equipo es de tres personas, pero pedir
   una página corta y creer que es la lista entera es cómo se decide que "no hay
   ningún dueño" teniéndolo en la página dos. */
const POR_PAGINA = 1000

type Usuario = {
  id: string
  email?: string
  created_at: string
  app_metadata?: Record<string, unknown> | null
}

const esDueno = (u: Usuario | null | undefined) => u?.app_metadata?.rol === 'dueño'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Quién llama, según su propio token.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'No autorizado' }, 401)

    /* La lista completa hace falta antes de decidir nada: para saber si existe
       algún dueño, para resolver el arranque, y para responder a 'list'. */
    const { data: listado, error: errorListado } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: POR_PAGINA,
    })
    if (errorListado) return json({ error: errorListado.message }, 400)

    const usuarios = (listado?.users ?? []) as unknown as Usuario[]

    /* ── Autorización ──────────────────────────────────────────────────── */

    const duenos = usuarios.filter(esDueno)
    let autorizado = esDueno(usuarios.find((u) => u.id === caller.id))

    if (!autorizado && duenos.length === 0) {
      // Nadie sellado todavía: manda el más antiguo, y deja de ser una excepción.
      const masAntiguo = [...usuarios].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      if (masAntiguo?.id === caller.id) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
          app_metadata: { ...(masAntiguo.app_metadata ?? {}), rol: 'dueño' },
        })
        /* Si el sellado falla no se sigue: dejar pasar la acción sin haber
           podido grabar el rol convierte esta excepción en permanente. */
        if (error) return json({ error: 'No se pudo confirmar quién es el dueño' }, 500)
        console.log('Dueño sellado por arranque:', caller.id)
        autorizado = true
      }
    }

    if (!autorizado) {
      /* Se deja rastro: si alguien está probando puertas, esto es lo único que
         lo delata. El correo va entero porque es de una cuenta del equipo. */
      console.warn('Intento de administrar cuentas sin ser dueño:', caller.id, caller.email)
      return json({ error: 'Sólo el dueño puede administrar las cuentas del panel' }, 403)
    }

    const body = await req.json()

    /* ── Listar ────────────────────────────────────────────────────────── */

    if (body.action === 'list') {
      return json({
        users: usuarios.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          // Para que el panel pueda marcarlo y no ofrecer borrarlo.
          esDueno: esDueno(u),
        })),
      })
    }

    /* ── Borrar ────────────────────────────────────────────────────────── */

    if (body.action === 'delete' && body.userId) {
      if (body.userId === caller.id) {
        return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
      }

      /* Un dueño no se borra desde acá. Con varios dueños, uno podría echar al
         otro; y el día que se herede el negocio, quitar a alguien de dueño es
         una decisión bastante más seria que un botón en Ajustes. */
      if (esDueno(usuarios.find((u) => u.id === body.userId))) {
        return json({ error: 'No se puede eliminar la cuenta del dueño' }, 400)
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(body.userId)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    /* ── Crear ─────────────────────────────────────────────────────────── */

    const { email, password } = body

    if (!email || !password) {
      return json({ error: 'Email y contraseña son obligatorios' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
    }

    /* Sin app_metadata: quien entra por acá es administrador del panel, no
       dueño. El rol sólo se pone sellando a mano o por el arranque de arriba. */
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) return json({ error: error.message }, 400)

    return json({ success: true, user: { id: data.user.id, email: data.user.email } })

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})

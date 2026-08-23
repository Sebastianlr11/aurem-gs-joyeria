/**
 * Lo que comparten las secciones del panel.
 *
 * Vivía suelto dentro de Dashboard.jsx, que pasaba de las 4.400 líneas. Al
 * sacar cada sección a su archivo hizo falta un sitio para lo que usan varias:
 * el formato del dinero y las fechas, los metadatos de estado y canal, los
 * modales de confirmación y el despacho de un pedido.
 *
 * Criterio para que algo esté aquí: **lo usan dos secciones o más**. Lo que usa
 * una sola se fue con ella. La lista salió de calcular el cierre transitivo de
 * dependencias, no a ojo — mirar sólo el cuerpo de cada sección dejaba fuera
 * nueve símbolos que se usan dentro de otros ayudantes.
 */
import { netoDeMercadoPago } from '../../../lib/dinero';
import { supabase } from '../../../lib/supabase';

export const CARRIERS = ['Servientrega', 'Interrapidisimo', 'Coordinadora', 'Otro'];

/* Pedidos que cuentan como venta hecha: el cliente se comprometió y el
   pedido avanza. OJO: esto NO es plata recibida. En contraentrega un pedido
   "enviado" es una venta viva de la que sólo entró el abono del envío; lo
   que hay en la cuenta lo dice recibidoDe(), en src/lib/dinero.js. */

export const EMPTY_CUSTOMER = { name:'', phone:'', email:'', notes:'' };

/* ─── Webhook helper ─────────────────────────────────────────────── */
/**
 * Le cuenta la venta a TikTok y a Meta cuando se cobra un pedido que no pasó
 * por Mercado Pago —el contraentrega, o los que cargás a mano.
 *
 * Va por una edge function porque los tokens de las APIs de conversiones no
 * pueden salir al navegador. Y no se avisa si algo falla: el pedido ya quedó
 * cobrado, y un error de medición no es algo que tengas que atender en medio
 * del trabajo. Queda en la consola y en los logs de la función.
 */

export const GRUPOS = [
    { id: 'confirmar', label: 'Por confirmar', nota: 'Esperan tu llamada o mensaje',
      test: o => o.status === 'pendiente' },
    { id: 'despachar', label: 'Por despachar', nota: 'Confirmados, se despachan en 2 a 3 días',
      test: o => o.status === 'procesando' || o.status === 'confirmado' || (o.status === 'pagado' && !isCOD(o)) },
    { id: 'camino',    label: 'En camino',     nota: 'Ya salieron, falta que lleguen',
      test: o => o.status === 'enviado' },
];

export const ORDER_STATUSES = ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado'];

export const SOURCE_META = {
    web:      { label: 'Web',      cls: 'source--blue' },
    whatsapp: { label: 'WhatsApp', cls: 'source--green' },
    tiktok:   { label: 'TikTok',   cls: 'source--pink' },
    manual:   { label: 'Manual',   cls: 'source--gray' },
};

export const STATUS_META = {
    pendiente:  { label: 'Pendiente',   cls: 'badge--yellow' },
    pagado:     { label: 'Pagado',      cls: 'badge--green'  },
    procesando: { label: 'Procesando',  cls: 'badge--orange' },
    enviado:    { label: 'Enviado',     cls: 'badge--purple' },
    entregado:  { label: 'Entregado',   cls: 'badge--blue'   },
    cancelado:  { label: 'Cancelado',   cls: 'badge--red'    },
    confirmado: { label: 'Confirmado',  cls: 'badge--blue'   }, // legacy
};

/* Flujo pago anticipado: pendiente → pagado → procesando → enviado → entregado */

export const VENTAS_VIVAS = ['pagado', 'procesando', 'enviado', 'entregado'];

/* Texto comparable: en minúscula y sin tildes. Buscar "bogota" tiene que
   encontrar "Bogotá" y "martinez" a "Martínez" —nadie escribe tildes en un
   buscador con el cliente esperando al teléfono—. Aguanta nulos sin reventar. */

export const avisarDespachoPorCorreo = async (orderId) => {
    try {
        const { data, error } = await supabase.functions.invoke('correo-despacho', {
            body: { pedidoId: orderId },
        });
        if (error) return { enviado: false, motivo: error.message };
        return data ?? { enviado: false, motivo: 'Respuesta vacía' };
    } catch (e) {
        return { enviado: false, motivo: e?.message || 'No se pudo conectar' };
    }
};

export const calcMPNet = (amount) => netoDeMercadoPago(amount);

export const coincideTelefono = (guardado, consulta) => {
    const d = soloDigitos(consulta);
    return !!d && soloDigitos(guardado).includes(d);
};

export const despacharPedido = async (order, transportadora, guia) => {
    const extra = { carrier: transportadora || null, tracking_number: guia || null };
    const { error } = await supabase
        .from('orders')
        .update({ status: 'enviado', status_updated_at: new Date().toISOString(), ...extra })
        .eq('id', order.id);

    if (error) return { guardado: false, motivo: error.message };

    await fireWebhook(order, 'enviado', extra);
    return { guardado: true, correo: await avisarDespachoPorCorreo(order.id) };
};

/**
 * Lo que viene de la base puede ser null, y llamar .trim() sobre null tumba
 * el guardado y deja el botón congelado. Los formularios de edición se llenan
 * directo desde la fila, así que todo texto pasa por acá.
 */

/* NAV imported from adminNav.js */

/* ─── StatusBadge ────────────────────────────────────────────────── */

export const enGrupo = (o, id) => GRUPOS.find(g => g.id === id)?.test(o) ?? false;

export const fireWebhook = async (order, newStatus, extraFields = {}) => {
    const url = localStorage.getItem('admin_webhook_url');
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'order_status_changed', order: { ...order, status: newStatus, ...extraFields }, timestamp: new Date().toISOString() }),
        });
    } catch (e) { console.error('Webhook error:', e); }
};

/**
 * Despachar un pedido: guardar el estado con la transportadora y la guía,
 * avisar al webhook si hay uno configurado, y mandar el correo de "tu pieza va
 * en camino".
 *
 * Vive a nivel de módulo porque ahora lo hacen DOS pantallas —la tabla de
 * Pedidos y la cola del taller del dashboard— y dos copias de esto acabarían
 * divergiendo: una mandando el correo y la otra no, que es la clase de
 * diferencia que nadie nota hasta que una clienta se queda sin aviso.
 *
 * El correo va DESPUÉS de guardar, nunca antes: el despacho ya quedó
 * registrado y no puede depender de que salga un correo. Y se devuelve qué
 * pasó con él en vez de tragárselo, porque hay dos motivos legítimos para que
 * no salga —el pedido no tiene correo, o no tiene guía— y quien despacha
 * necesita saber cuál fue.
 *
 * No avisa conversión: en 'enviado' no entra plata. En contraentrega la plata
 * entra al entregar, y en prepago entró al principio.
 */

export const fmt = n => Number(n || 0).toLocaleString('es-CO');

export const fmtDate = d => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

/* Los metales que trabaja el taller. Van como sugerencia y no como lista
   cerrada —una pieza puede llevar algo que no está— pero escribirlos siempre
   igual importa: de este texto sale el punzón de ley que se muestra junto a
   la pieza, y "Plata 925" y "plata .925" darían dos punzones distintos. */

export const isCOD = (order) => order.payment_method === 'contraentrega';

/* Cómo se escribe cada método. Antes sólo 'contraentrega' tenía nombre y los
   demás se pintaban con la clave cruda de la base, así que la tabla mezclaba
   "Contra entrega" con "nequi" en minúsculas. */

export const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* Los últimos diez dígitos, que es lo que hace comparable un teléfono venga
   como venga: con +57, con espacios o pelado. Vive aquí y no dentro de una
   sección porque Pedidos y Clientes tienen que comparar igual. */

export const soloDigitos = (t) => String(t || '').replace(/\D/g, '').slice(-10);

/* Un teléfono coincide si los dígitos de lo tecleado aparecen en los del
   guardado. Comparar los textos crudos no servía: el mismo número está en la
   base como 3143602930, 573143602930 y +573143602930, y quien busca lo copia
   de WhatsApp con el +57 y los espacios puestos, así que no encontraba nada.
   Compara los últimos diez, de modo que el prefijo del país deja de estorbar,
   y por trozo, para poder buscar sólo el final del número. */

/**
 * La caja: cuánta plata entró de verdad, y en qué días.
 *
 * Lee la tabla `pagos`, el libro de movimientos que mantiene un disparador en
 * `orders`. Existe porque el panel venía calculando la plata desde el ESTADO
 * de los pedidos, y el estado no tiene fecha.
 *
 * El daño concreto estaba en el retorno de la pauta. `PautaRetorno` filtraba
 * el gasto por fecha —correcto— y la plata por pedidos CREADOS en el periodo
 * —incorrecto—. Con fabricación de 5 a 8 días más el envío, las dos fechas
 * casi nunca caen en la misma ventana: una venta cobrada dentro del periodo
 * pero pedida antes no contaba, y una pedida dentro pero cobrada después
 * contaba entera. El retorno dividía peras entre manzanas.
 *
 * Aquí las dos puntas están fechadas igual.
 */
import { supabase } from './supabase';
import { netoDeMercadoPago } from './dinero';

/**
 * ¿Este movimiento pasó por Mercado Pago?
 *
 * Hace falta porque `pagos.medio` guarda la forma de pago del PEDIDO, no el
 * riel de cada movimiento, y en contraentrega los dos movimientos van por
 * rieles distintos: el abono se cobra en línea con Mercado Pago para confirmar
 * el pedido, y el saldo lo recibe el mensajero en efectivo en la puerta.
 *
 * Sólo a lo que pasó por Mercado Pago se le descuenta la comisión. Antes se le
 * descontaba a todo lo que no fuera contraentrega —incluido Nequi y el
 * efectivo cargado a mano—, que cobra comisiones distintas y no las tenemos
 * modeladas.
 */
const porMercadoPago = (p) => p.concepto === 'abono' || p.medio === 'mercadopago';

/**
 * Lo que de verdad quedó en la cuenta por este movimiento.
 *
 * Los reversos —una venta cobrada que se cancela— pasan tal cual, en negativo
 * y por su valor bruto. Es a propósito y deja la cifra por lo bajo: Mercado
 * Pago no devuelve su comisión cuando se cae una venta, así que restar el
 * bruto se acerca más a la realidad que restar el neto.
 */
const netoDe = (p) => {
    const monto = Number(p.monto) || 0;
    if (monto <= 0) return monto;
    return porMercadoPago(p) ? netoDeMercadoPago(monto) : monto;
};

/** AAAA-MM-DD del día en Bogotá, sin que el huso lo corra un día. */
const diaEnBogota = (fecha) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(fecha));

/**
 * La caja entre dos fechas.
 *
 * Deja fuera los pedidos de prueba del equipo, que es lo que se olvida y lo
 * que ensucia el retorno desde el primer día. `incluirPruebas` existe para el
 * lente del panel: si el lente está puesto y esto siguiera escondiéndolos, la
 * caja diría cero mientras el resto de la pantalla enseña los pedidos de
 * prueba — el interruptor dejaría de valer para este bloque y volveríamos a
 * tener dos verdades en la misma pantalla.
 *
 * Devuelve `{ total, mercadoPago, efectivo, porDia, movimientos }`, donde
 * `porDia` es un Map de 'AAAA-MM-DD' a pesos — listo para un gráfico de caja
 * diaria el día que haya con qué dibujarlo.
 */
export async function cajaEntre(desde, hasta = null, { incluirPruebas = false } = {}) {
    const vacia = { total: 0, mercadoPago: 0, efectivo: 0, porDia: new Map(), movimientos: [] };

    let q = supabase
        .from('pagos')
        .select('monto, concepto, medio, ocurrido_en, orders!inner(es_prueba)')
        .order('ocurrido_en', { ascending: false });

    if (!incluirPruebas) q = q.eq('orders.es_prueba', false);

    if (desde) q = q.gte('ocurrido_en', new Date(desde).toISOString());
    if (hasta) q = q.lte('ocurrido_en', new Date(hasta).toISOString());

    const { data, error } = await q;
    if (error || !data) return vacia;

    const porDia = new Map();
    let total = 0;
    let mercadoPago = 0;
    let efectivo = 0;

    for (const p of data) {
        const neto = netoDe(p);
        total += neto;
        if (porMercadoPago(p)) mercadoPago += neto; else efectivo += neto;

        const dia = diaEnBogota(p.ocurrido_en);
        porDia.set(dia, (porDia.get(dia) || 0) + neto);
    }

    return { total, mercadoPago, efectivo, porDia, movimientos: data };
}

/** La caja de los últimos N días, contados desde ahora. */
export const cajaDeLosUltimos = (dias, opciones) =>
    cajaEntre(new Date(Date.now() - dias * 86400000), null, opciones);

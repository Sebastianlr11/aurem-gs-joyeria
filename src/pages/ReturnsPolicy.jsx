import React from 'react';

const Section = ({ title, children }) => (
  <div className="legal-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const ReturnsPolicy = () => (
  <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Política de Devoluciones</h1>
        <p>Última actualización: febrero de 2025</p>
      </div>

      <div className="legal-body">
        <Section title="1. Derecho de retracto">
          <p>De acuerdo con el Estatuto del Consumidor colombiano (Ley 1480 de 2011), tienes derecho a retractarte de una compra realizada a distancia dentro de los <strong>5 días hábiles</strong> siguientes a la recepción del producto, sin necesidad de justificación.</p>
          <p>Para ejercer este derecho, el producto debe estar en perfectas condiciones, sin uso, con su empaque original y todos los accesorios incluidos.</p>
        </Section>

        <Section title="2. Condiciones para devolución">
          <p>Aceptamos devoluciones cuando:</p>
          <ul>
            <li>El producto llegó defectuoso o dañado</li>
            <li>El producto recibido no corresponde al pedido realizado</li>
            <li>Se ejerce el derecho de retracto dentro del plazo legal</li>
          </ul>
          <p><strong>No aceptamos devoluciones cuando:</strong></p>
          <ul>
            <li>El producto ha sido usado o alterado</li>
            <li>Se han retirado etiquetas o empaque original</li>
            <li>Han transcurrido más de 5 días hábiles desde la recepción</li>
            <li>El daño es causado por mal uso del cliente</li>
          </ul>
        </Section>

        <Section title="3. Proceso de devolución">
          <p>Para iniciar una devolución:</p>
          <ol>
            <li>Contáctanos por WhatsApp dentro del plazo indicado</li>
            <li>Describe el motivo de la devolución y adjunta fotos del producto</li>
            <li>Nuestro equipo evaluará tu caso y te confirmará la aprobación</li>
            <li>Te indicaremos cómo enviar el producto de vuelta</li>
            <li>Una vez recibido e inspeccionado, procesaremos el reembolso o cambio</li>
          </ol>
        </Section>

        <Section title="4. Reembolsos">
          <ul>
            <li><strong>Pagos con Mercado Pago:</strong> el reembolso se realiza al mismo método de pago utilizado, en un plazo de 5 a 10 días hábiles dependiendo del banco o entidad.</li>
            <li><strong>Pagos contraentrega:</strong> el reembolso se realiza mediante transferencia bancaria o Nequi/Daviplata en un plazo de 3 a 5 días hábiles tras aprobación.</li>
          </ul>
        </Section>

        <Section title="5. Garantía de calidad">
          <p>Todas nuestras piezas cuentan con una garantía de <strong>30 días</strong> contra defectos de fabricación. Si tu joya presenta algún problema de calidad dentro de este período, la reemplazamos o reparamos sin costo adicional.</p>
        </Section>

        <Section title="6. Gastos de envío en devoluciones">
          <ul>
            <li>Si la devolución se debe a un error nuestro (producto incorrecto o defectuoso), cubrimos el costo del envío de retorno.</li>
            <li>Si la devolución es por derecho de retracto, el costo del envío de retorno es responsabilidad del cliente.</li>
          </ul>
        </Section>

        <Section title="7. Contacto">
          <p>Para iniciar cualquier proceso de devolución o resolver dudas, comunícate con nosotros a través del WhatsApp o formulario de contacto disponible en la tienda.</p>
        </Section>
      </div>
    </div>
  </main>
);

export default ReturnsPolicy;

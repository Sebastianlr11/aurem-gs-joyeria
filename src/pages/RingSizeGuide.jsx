import React from 'react';

const SIZES = [
  { size: '3',    mm: '44.2', cm: '4.4' },
  { size: '3.5',  mm: '45.5', cm: '4.5' },
  { size: '4',    mm: '46.8', cm: '4.7' },
  { size: '4.5',  mm: '48.0', cm: '4.8' },
  { size: '5',    mm: '49.3', cm: '4.9' },
  { size: '5.5',  mm: '50.6', cm: '5.1' },
  { size: '6',    mm: '51.9', cm: '5.2' },
  { size: '6.5',  mm: '53.1', cm: '5.3' },
  { size: '7',    mm: '54.4', cm: '5.4' },
  { size: '7.5',  mm: '55.7', cm: '5.6' },
  { size: '8',    mm: '57.0', cm: '5.7' },
  { size: '8.5',  mm: '58.3', cm: '5.8' },
  { size: '9',    mm: '59.5', cm: '5.9' },
  { size: '9.5',  mm: '60.8', cm: '6.1' },
  { size: '10',   mm: '62.1', cm: '6.2' },
  { size: '10.5', mm: '63.4', cm: '6.3' },
  { size: '11',   mm: '64.6', cm: '6.5' },
  { size: '11.5', mm: '65.9', cm: '6.6' },
  { size: '12',   mm: '67.2', cm: '6.7' },
  { size: '12.5', mm: '68.5', cm: '6.8' },
];

const half = Math.ceil(SIZES.length / 2);
const LEFT_SIZES = SIZES.slice(0, half);
const RIGHT_SIZES = SIZES.slice(half);

const SizeTable = ({ data }) => (
  <div className="ring-table-wrap">
    <table className="ring-table">
      <thead>
        <tr>
          <th>Talla</th>
          <th>mm</th>
          <th>cm</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.size}>
            <td className="ring-table-size">{row.size}</td>
            <td>{row.mm}</td>
            <td>{row.cm}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RingSizeGuide = () => (
  <main className="ring-guide-page">
    <div className="ring-guide-hero">
      <span className="section-label">Guía de Tallas</span>
      <h1 className="ring-guide-title">Encuentra tu talla ideal</h1>
      <p className="ring-guide-subtitle">
        Mide la circunferencia de tu dedo con un hilo o cinta métrica y compara con nuestra tabla.
      </p>
    </div>

    <div className="ring-guide-body">
      <div className="ring-guide-tip">
        <div className="ring-guide-tip-icon">💍</div>
        <div>
          <strong>¿Cómo medir tu dedo?</strong>
          <p>Envuelve un hilo alrededor de tu dedo, marca donde se cruza y mide la longitud con una regla. Compara el resultado con la tabla de abajo.</p>
        </div>
      </div>

      {/* Desktop: two tables side by side */}
      <div className="ring-tables-grid ring-tables-desktop">
        <SizeTable data={LEFT_SIZES} />
        <SizeTable data={RIGHT_SIZES} />
      </div>

      {/* Mobile: premium styled list */}
      <div className="ring-list-mobile">
        <div className="ring-list-header">
          <span>Talla</span>
          <span>Circunferencia</span>
          <span>Diámetro</span>
        </div>
        {SIZES.map((row, i) => (
          <div key={row.size} className={`ring-list-item${i % 2 === 0 ? ' ring-list-item--alt' : ''}`}>
            <span className="ring-list-size">{row.size}</span>
            <span className="ring-list-val">{row.mm} mm</span>
            <span className="ring-list-val">{row.cm} cm</span>
          </div>
        ))}
      </div>
    </div>
  </main>
);

export default RingSizeGuide;

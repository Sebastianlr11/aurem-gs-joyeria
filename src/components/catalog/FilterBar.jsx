import React from 'react';

const categories = ['Todos', 'Anillos', 'Collares', 'Aretes', 'Pulseras'];

const FilterBar = ({ active, onChange }) => {
    return (
        <div className="filter-bar">
            {categories.map(cat => (
                <button
                    key={cat}
                    className={`filter-btn ${active === cat ? 'filter-btn--active' : ''}`}
                    onClick={() => onChange(cat)}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
};

export default FilterBar;

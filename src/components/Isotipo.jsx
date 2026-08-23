import React from 'react';
import { isotipoPaths } from './isotipoPaths';


const Isotipo = ({ className, label = 'Aurem Gs Joyería' }) => (
    <svg
        className={className}
        viewBox="140 126 240 171"
        role="img"
        aria-label={label}
        focusable="false"
    >
        {isotipoPaths}
    </svg>
);

export default Isotipo;

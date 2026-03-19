import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

export default function AnimatedCounter({
    value = 0,
    duration = 1.3,
    prefix = '',
    suffix = '',
    formatter
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-10% 0px' });
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (!isInView) return;
        const numericValue = Number.isFinite(value) ? value : Number(value) || 0;
        const controls = animate(0, numericValue, {
            duration,
            ease: 'easeOut',
            onUpdate: (latest) => {
                setDisplayValue(latest);
            }
        });

        return () => controls.stop();
    }, [isInView, value, duration]);

    const roundedValue = Math.round(displayValue);
    const formattedValue = formatter ? formatter(roundedValue) : roundedValue.toLocaleString();

    return (
        <span ref={ref}>
            {prefix}
            {formattedValue}
            {suffix}
        </span>
    );
}

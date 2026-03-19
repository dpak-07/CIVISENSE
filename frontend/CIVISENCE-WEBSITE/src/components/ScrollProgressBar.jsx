import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgressBar() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 140,
        damping: 24,
        mass: 0.2
    });

    return (
        <motion.div
            className="scroll-progress"
            style={{ scaleX }}
        />
    );
}

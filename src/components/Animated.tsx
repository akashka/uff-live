'use client';

import { motion, type Variants } from 'framer-motion';

/** Fade in from below - for page content */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/** Fade in - simple */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Scale + fade - for modals */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

/** Stagger container - use with staggerChildren on children */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const defaultTransition = { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] };

interface AnimatedProps {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  initial?: string;
  animate?: string;
  exit?: string;
  transition?: { duration?: number; delay?: number };
}

/** Wrapper for fade-in-up animations */
export function Animated({
  children,
  className,
  variants = fadeInUp,
  initial = 'hidden',
  animate = 'visible',
  exit = 'hidden',
  transition = defaultTransition,
}: AnimatedProps) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container - animates children with delay */
export function AnimatedStagger({
  children,
  className,
  staggerDelay = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay, delayChildren: 0.03 },
        },
      }}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/** Individual item for use inside AnimatedStagger */
export function AnimatedItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerItem}
    >
      {children}
    </motion.div>
  );
}

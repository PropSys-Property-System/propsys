'use client';

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

export function AnimatedNumber({ value }: { value: number }) {
  const springValue = useSpring(0, { stiffness: 50, damping: 20 });
  const displayValue = useTransform(springValue, (current) => Math.round(current));

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return <motion.span className="font-tabular-nums">{displayValue}</motion.span>;
}

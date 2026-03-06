'use client';

import Image from 'next/image';

interface UFFLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 36, md: 48, lg: 64 };

export default function UFFLogo({ size = 'md', className = '' }: UFFLogoProps) {
  const px = sizes[size];
  return (
    <Image
      src="/uff-logo.png"
      alt="URBAN FASHION FACTORY"
      width={px}
      height={Math.round(px * (110 / 98))}
      className={`object-contain ${className}`}
      priority
    />
  );
}

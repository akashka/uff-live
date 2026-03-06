'use client';

interface UserAvatarProps {
  photo?: string | null;
  name?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitial(displayName?: string, email?: string): string {
  if (displayName && displayName.trim()) {
    const first = displayName.trim().charAt(0).toUpperCase();
    return first;
  }
  if (email && email.trim()) {
    return email.trim().charAt(0).toUpperCase();
  }
  return '?';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

export default function UserAvatar({ photo, name, email, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (photo) {
    return (
      <img
        src={photo}
        alt={name || 'Profile'}
        className={`rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  const initial = getInitial(name, email);
  return (
    <div
      className={`rounded-full bg-uff-accent text-uff-primary font-semibold flex items-center justify-center shrink-0 ${sizeClass} ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

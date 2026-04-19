import React from 'react';

const GenderBadge = ({ gender, size = 'sm' }) => {
  if (!gender) return null;

  const config = {
    'Men': {
      icon: '♂',
      bg: 'bg-blue-500',
      text: 'text-white',
      label: 'Men'
    },
    'Women': {
      icon: '♀',
      bg: 'bg-pink-500',
      text: 'text-white',
      label: 'Women'
    },
    'Unisex': {
      icon: '⚥',
      bg: 'bg-purple-500',
      text: 'text-white',
      label: 'Unisex'
    },
    'Kids': {
      icon: '👶',
      bg: 'bg-green-500',
      text: 'text-white',
      label: 'Kids'
    }
  };

  const style = config[gender];
  if (!style) return null;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${style.bg} ${style.text} ${sizeClasses[size]}`}>
      <span>{style.icon}</span>
      <span>{style.label}</span>
    </span>
  );
};

export default GenderBadge;

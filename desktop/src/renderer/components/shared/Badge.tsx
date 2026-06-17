import React from 'react'

interface BadgeProps {
  label: string
  color: string
  bgOpacity?: number
}

export const Badge: React.FC<BadgeProps> = ({ label, color, bgOpacity = 0.15 }) => {
  const bgColor = color + Math.round(bgOpacity * 255).toString(16).padStart(2, '0')

  return (
    <span
      className="badge"
      style={{
        color,
        background: bgColor,
        border: `1px solid ${color}33`
      }}
    >
      {label}
    </span>
  )
}

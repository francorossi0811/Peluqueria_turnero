import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`border-borde bg-superficie-2 rounded-lg border p-4 ${className}`}
    >
      {children}
    </div>
  )
}

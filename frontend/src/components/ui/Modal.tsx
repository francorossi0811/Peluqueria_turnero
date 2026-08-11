import type { ReactNode } from 'react'

interface ModalProps {
  titulo: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ titulo, onClose, children }: ModalProps) {
  return (
    <div
      className="bg-velo fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="border-borde bg-superficie max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-tinta text-lg font-semibold">
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="text-tinta-tenue hover:text-tinta text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

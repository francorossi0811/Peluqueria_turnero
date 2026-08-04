export function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-tinta-suave hover:text-tinta mb-2 block text-sm"
    >
      ‹ Volver
    </button>
  )
}

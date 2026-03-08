'use client'

interface FilterChip {
  id: string
  label: string
  apply: () => void
}

interface FilterChipsProps {
  activeChips: string[]
  onToggle: (chipId: string) => void
  chips: FilterChip[]
}

export default function FilterChips({ activeChips, onToggle, chips }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const isActive = activeChips.includes(chip.id)
        return (
          <button
            key={chip.id}
            onClick={() => {
              onToggle(chip.id)
              chip.apply()
            }}
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${isActive
                ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

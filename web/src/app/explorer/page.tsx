import { Suspense } from 'react'
import ExplorerView from '@/components/explorer/ExplorerView'

export const metadata = {
  title: 'Mistake Explorer',
  description:
    'Filter every mistake by the edge you held, the opening, the phase and the colour you played.',
}

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">
          Loading explorer…
        </p>
      }
    >
      <ExplorerView />
    </Suspense>
  )
}

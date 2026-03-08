import { redirect } from 'next/navigation'

export default function RecurringMistakesPage() {
  redirect('/mistakes?tab=recurring')
}

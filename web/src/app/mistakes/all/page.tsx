import { redirect } from 'next/navigation'

export default function AllMistakesPage() {
  redirect('/mistakes?tab=all')
}

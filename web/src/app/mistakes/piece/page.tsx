import { redirect } from 'next/navigation'

export default function MistakesByPiecePage() {
  redirect('/mistakes?tab=piece')
}

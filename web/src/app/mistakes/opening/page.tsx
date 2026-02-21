import { redirect } from 'next/navigation'

export default function MistakesByOpeningPage() {
  redirect('/mistakes?tab=opening')
}

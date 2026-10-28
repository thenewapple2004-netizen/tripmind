import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function PlannerPage() {
  useDocumentTitle('AI Planner')
  return (
    <div className="space-y-6">
      <PageHeader title="AI Planner" description="A future TripMind feature. Nothing here is live yet." />

      <Card className="relative isolate overflow-hidden px-6 py-14 text-center sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,var(--glow),transparent)]"
        />
        <svg
          aria-hidden
          viewBox="0 0 400 120"
          fill="none"
          className="pointer-events-none absolute inset-x-0 bottom-4 -z-10 mx-auto h-28 w-full max-w-xl text-primary/30"
        >
          <path d="M10 100 C 90 10, 150 120, 220 50 S 340 10, 390 40" stroke="currentColor" strokeWidth="2" strokeDasharray="5 8" strokeLinecap="round" />
        </svg>
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-fg shadow-glow">
          <Sparkles className="size-8" aria-hidden />
        </span>
        <p className="mx-auto mt-5 w-fit rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold tracking-wide text-primary-soft-fg uppercase">
          Coming soon
        </p>
        <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          Trip planning, with a little help
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-fg-muted">
          The AI Planner is on the roadmap: it will draft itineraries around your destination, dates and budget. It
          isn't built yet, so for now you can plan trips, activities and expenses by hand.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/trips/new" variant="primary">
            Plan a trip
          </ButtonLink>
          <ButtonLink to="/portal" variant="secondary">
            Back to overview
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}

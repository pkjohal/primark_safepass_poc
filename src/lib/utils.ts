import type { Visit, VisitDisplayStatus } from './types'

export type DateStyle = 'relative' | 'absolute' | 'date-only' | 'time-only'

export function formatDate(date: string | null | undefined, style: DateStyle): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'

  const now = new Date()

  if (style === 'time-only') {
    return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  if (style === 'date-only') {
    return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (style === 'absolute') {
    return d.toLocaleString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // relative
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)

  if (diffMs < 0) {
    // future
    const absDiffMin = Math.abs(diffMin)
    const absDiffHr = Math.abs(diffHr)
    if (absDiffMin < 60) return `in ${absDiffMin} min`
    if (absDiffHr < 24) return `in ${absDiffHr}h`
    return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) +
      ' at ' + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday at ' + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  }

  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) +
    ' at ' + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}

export function getDisplayStatus(visit: Visit): VisitDisplayStatus {
  if (visit.status === 'checked_in' && new Date(visit.planned_departure) < new Date()) {
    return 'overdue'
  }
  return visit.status
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

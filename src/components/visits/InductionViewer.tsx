import { useState } from 'react'
import type { Site } from '../../lib/types'
import MarkdownRenderer from '../ui/MarkdownRenderer'

interface Props {
  site: Site
  onComplete: () => Promise<void>
  loading?: boolean
}

export default function InductionViewer({ site, onComplete, loading = false }: Props) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="space-y-6">
      {/* Video */}
      {site.hs_video_url && (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe
            src={site.hs_video_url}
            className="w-full h-full"
            allowFullScreen
            title="Health & Safety Induction Video"
          />
        </div>
      )}

      {/* Written content */}
      {site.hs_written_content && (
        <div className="bg-light-grey rounded-xl p-5 max-h-96 overflow-y-auto">
          <MarkdownRenderer content={site.hs_written_content} />
        </div>
      )}

      {/* Confirmation */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded border-border-grey text-primark-blue focus:ring-primark-blue shrink-0"
        />
        <span className="text-sm text-charcoal leading-snug group-hover:text-navy">
          I confirm I have read and understood the Health & Safety induction for {site.name}.
        </span>
      </label>

      <button
        onClick={onComplete}
        disabled={!confirmed || loading}
        className="w-full bg-primark-blue text-white py-4 rounded-xl font-semibold hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn-primary"
      >
        {loading ? 'Completing...' : 'Complete Induction'}
      </button>
    </div>
  )
}

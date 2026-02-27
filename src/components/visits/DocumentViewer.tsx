import { useState } from 'react'
import type { VisitDocument } from '../../lib/types'
import MarkdownRenderer from '../ui/MarkdownRenderer'

interface Props {
  documents: VisitDocument[]
  onAcceptAll: () => Promise<void>
  loading?: boolean
}

export default function DocumentViewer({ documents, onAcceptAll, loading = false }: Props) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set())

  const allAccepted = documents.length > 0 && accepted.size === documents.length

  function toggle(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {documents.map((doc) => (
        <div key={doc.id} className="border border-border-grey rounded-xl overflow-hidden">
          <div className="bg-navy px-5 py-3">
            <h3 className="text-white font-semibold text-base">{doc.document_name}</h3>
          </div>
          <div className="p-5 max-h-72 overflow-y-auto bg-light-grey">
            <MarkdownRenderer content={doc.document_content} />
          </div>
          <div className="px-5 py-4 border-t border-border-grey bg-white">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted.has(doc.id)}
                onChange={() => toggle(doc.id)}
                className="w-5 h-5 rounded border-border-grey text-primark-blue focus:ring-primark-blue"
              />
              <span className="text-sm text-charcoal">
                I accept the terms of this document: <strong>{doc.document_name}</strong>
              </span>
            </label>
          </div>
        </div>
      ))}

      <button
        onClick={onAcceptAll}
        disabled={!allAccepted || loading}
        className="w-full bg-primark-blue text-white py-4 rounded-xl font-semibold hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn-primary"
      >
        {loading ? 'Saving...' : 'Accept All Documents'}
      </button>
    </div>
  )
}

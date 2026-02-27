import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVisitors } from '../hooks/useVisitors'
import { useAuth } from '../context/AuthContext'
import SearchBar from '../components/ui/SearchBar'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/layout/PageHeader'
import type { Visitor } from '../lib/types'

export default function VisitorSearchScreen() {
  const navigate = useNavigate()
  const { isReception } = useAuth()
  const { visitors, loading, search } = useVisitors()
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback((q: string) => {
    if (q.trim()) {
      setHasSearched(true)
      search(q)
    } else {
      setHasSearched(false)
    }
  }, [search])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Visitors"
        subtitle="Search for existing visitor profiles"
        actions={
          isReception ? (
            <button
              onClick={() => navigate('/visitors/new')}
              className="bg-primark-blue text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors min-h-btn"
            >
              + New Visitor
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl shadow-card p-5">
        <SearchBar
          placeholder="Search by name, email, or company..."
          onSearch={handleSearch}
          className="mb-5"
        />

        {!hasSearched && (
          <EmptyState
            icon="🔍"
            title="Search for a visitor"
            message="Enter a name, email address, or company to find existing visitor profiles."
          />
        )}

        {hasSearched && loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}
          </div>
        )}

        {hasSearched && !loading && visitors.length === 0 && (
          <EmptyState
            icon="👤"
            title="No visitors found"
            message="No matching visitor profiles. You can create a new one."
            action={isReception ? { label: 'Create New Visitor', onClick: () => navigate('/visitors/new') } : undefined}
          />
        )}

        {hasSearched && !loading && visitors.length > 0 && (
          <div className="divide-y divide-border-grey">
            {visitors.map((v) => (
              <VisitorListItem
                key={v.id}
                visitor={v}
                onClick={() => navigate(`/visitors/${v.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VisitorListItem({ visitor, onClick }: { visitor: Visitor; onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between py-4 px-2 cursor-pointer hover:bg-light-grey rounded-lg transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primark-blue-light flex items-center justify-center text-primark-blue font-bold text-sm shrink-0">
          {visitor.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-navy">{visitor.name}</div>
          <div className="text-xs text-mid-grey">{visitor.email}</div>
          {visitor.company && <div className="text-xs text-mid-grey">{visitor.company}</div>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          visitor.visitor_type === 'internal_staff'
            ? 'bg-primark-blue-light text-primark-blue'
            : 'bg-light-grey text-mid-grey'
        }`}>
          {visitor.visitor_type === 'internal_staff' ? 'Internal' : '3rd Party'}
        </span>
        <svg className="w-4 h-4 text-mid-grey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}

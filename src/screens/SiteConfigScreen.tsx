import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAuditLog } from '../hooks/useAuditLog'
import PageHeader from '../components/layout/PageHeader'
import MarkdownRenderer from '../components/ui/MarkdownRenderer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export default function SiteConfigScreen() {
  const { user, site } = useAuth()
  const { log } = useAuditLog()

  const [videoUrl, setVideoUrl] = useState(site?.hs_video_url ?? '')
  const [content, setContent] = useState(site?.hs_written_content ?? '')
  const [escalationMinutes, setEscalationMinutes] = useState(site?.notification_escalation_minutes ?? 10)
  const [preApprovalDays, setPreApprovalDays] = useState(site?.pre_approval_default_days ?? 90)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (site) {
      setVideoUrl(site.hs_video_url ?? '')
      setContent(site.hs_written_content ?? '')
      setEscalationMinutes(site.notification_escalation_minutes)
      setPreApprovalDays(site.pre_approval_default_days)
    }
  }, [site])

  async function handlePublish() {
    if (!user || !site) return
    setSaving(true)
    try {
      const newVersion = site.hs_content_version + 1
      await supabase
        .from('sites')
        .update({
          hs_video_url: videoUrl.trim() || null,
          hs_written_content: content,
          hs_content_version: newVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', site.id)

      await log('hs_content_published', 'site', site.id, user.id, {
        new_version: newVersion,
        old_version: site.hs_content_version,
      })
      toast.success(`H&S content published (v${newVersion}) — all visitors must re-complete induction`)
      setShowPublishConfirm(false)
    } catch {
      toast.error('Failed to publish content')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSettings() {
    if (!user || !site) return
    setSaving(true)
    try {
      await supabase
        .from('sites')
        .update({
          notification_escalation_minutes: escalationMinutes,
          pre_approval_default_days: preApprovalDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', site.id)
      await log('site_config_updated', 'site', site.id, user.id, {
        notification_escalation_minutes: escalationMinutes,
        pre_approval_default_days: preApprovalDays,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Site Configuration" subtitle={site?.name} />

      {/* Site details (read-only) */}
      <div className="bg-white rounded-xl shadow-card p-5 mb-6">
        <h2 className="text-base font-semibold text-navy mb-4">Site Details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Name</dt><dd className="text-charcoal">{site?.name}</dd></div>
          <div><dt className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Site Code</dt><dd className="text-charcoal">{site?.site_code}</dd></div>
          <div><dt className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">Address</dt><dd className="text-charcoal">{site?.address ?? '—'}</dd></div>
          <div><dt className="text-xs text-mid-grey uppercase tracking-wide mb-0.5">H&S Content Version</dt><dd className="text-charcoal font-semibold">v{site?.hs_content_version}</dd></div>
        </dl>
      </div>

      {/* H&S Content */}
      <div className="bg-white rounded-xl shadow-card p-5 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">Health & Safety Content</h2>
          <button
            onClick={() => setPreview((p) => !p)}
            className="text-sm text-primark-blue hover:underline"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Video URL</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/embed/..."
            className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">Written Content (Markdown)</label>
          {preview ? (
            <div className="border border-border-grey rounded-xl p-4 min-h-64 bg-light-grey">
              <MarkdownRenderer content={content} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primark-blue"
              placeholder="## Welcome to Primark&#10;&#10;Enter H&S content in Markdown format..."
            />
          )}
        </div>

        <div className="bg-warning-bg border border-warning rounded-lg p-3">
          <p className="text-sm text-warning font-medium">
            ⚠ Saving H&S content increments the version number and requires ALL visitors to re-complete their induction on their next visit.
          </p>
        </div>

        <button
          onClick={() => setShowPublishConfirm(true)}
          className="bg-primark-blue text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors min-h-btn"
        >
          Save & Publish H&S Content
        </button>
      </div>

      {/* Notification settings */}
      <div className="bg-white rounded-xl shadow-card p-5">
        <h2 className="text-base font-semibold text-navy mb-4">Notification Settings</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Escort Escalation Timeout (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={escalationMinutes}
              onChange={(e) => setEscalationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
            />
            <p className="text-xs text-mid-grey mt-1">Time before escalating to backup contact if host doesn't acknowledge</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-mid-grey uppercase tracking-wide mb-1.5">
              Pre-Approval Default Duration (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={preApprovalDays}
              onChange={(e) => setPreApprovalDays(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-border-grey rounded-lg text-sm min-h-input focus:outline-none focus:ring-2 focus:ring-primark-blue"
            />
            <p className="text-xs text-mid-grey mt-1">How long a pre-approval lasts before expiry</p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="mt-5 bg-primark-blue text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primark-blue-dark transition-colors disabled:opacity-50 min-h-btn"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {showPublishConfirm && (
        <ConfirmDialog
          title="Publish new H&S content?"
          message={`This will increment the H&S content version to v${(site?.hs_content_version ?? 0) + 1} and require ALL visitors to re-complete their induction on their next visit. This cannot be undone.`}
          confirmLabel={saving ? 'Publishing...' : 'Publish'}
          variant="danger"
          onConfirm={handlePublish}
          onCancel={() => setShowPublishConfirm(false)}
        />
      )}
    </div>
  )
}

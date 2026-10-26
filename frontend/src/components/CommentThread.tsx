import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError, api } from '../lib/api'
import type { Comment, User } from '../lib/api'
import { initials, shortDate } from '../lib/format'
import { TrashIcon } from './icons'

interface CommentThreadProps {
  taskId: string
  user: User
  taskOwnerId: string
  onCountChange: (count: number) => void
}

export default function CommentThread({ taskId, user, taskOwnerId, onCountChange }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let cancelled = false
    api
      .comments(taskId)
      .then((next) => {
        if (cancelled) return
        setComments(next)
        onCountChange(next.length)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить комментарии')
      })

    const timer = window.setInterval(() => {
      void api
        .comments(taskId)
        .then((next) => {
          if (cancelled) return
          setComments(next)
          onCountChange(next.length)
        })
        .catch(() => undefined)
    }, 12_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [taskId, onCountChange])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const created = await api.createComment(taskId, text)
      setComments((prev) => [...prev, created])
      onCountChange(comments.length + 1)
      setDraft('')
      requestAnimationFrame(() => {
        listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' })
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить комментарий')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: string) {
    const text = editDraft.trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const updated = await api.updateComment(id, text)
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить комментарий')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError('')
    try {
      await api.deleteComment(id)
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== id)
        onCountChange(next.length)
        return next
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить комментарий')
    }
  }

  const canModerate = (comment: Comment) =>
    comment.author_id === user.id || taskOwnerId === user.id || user.role === 'admin'

  return (
    <section className="comments" aria-label="Комментарии">
      <header className="comments-head">
        <h3>Комментарии</h3>
        <span>{comments.length}</span>
      </header>

      {comments.length === 0 && <p className="comments-empty">Пока нет комментариев — напишите первым.</p>}

      <ul className="comment-list" ref={listRef}>
        {comments.map((comment) => {
          const mine = comment.author_id === user.id
          return (
            <li key={comment.id} className={`comment${mine ? ' mine' : ''}`}>
              <span className="avatar">{initials(comment.author_name, comment.author_email)}</span>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{comment.author_name}</strong>
                  <em>{shortDate(comment.created_at)}</em>
                  {mine && (
                    <button
                      type="button"
                      className="btn-plain small"
                      onClick={() => {
                        setEditingId(comment.id)
                        setEditDraft(comment.body)
                      }}
                    >
                      Изменить
                    </button>
                  )}
                  {canModerate(comment) && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Удалить комментарий"
                      onClick={() => void remove(comment.id)}
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  )}
                </div>
                {editingId === comment.id ? (
                  <form
                    className="comment-edit"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void saveEdit(comment.id)
                    }}
                  >
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={2000}
                      rows={3}
                    />
                    <div className="comment-edit-actions">
                      <button type="button" className="btn-plain small" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                      <button type="submit" className="btn-primary small" disabled={busy || !editDraft.trim()}>
                        Сохранить
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{comment.body}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <form className="comment-form" onSubmit={submit}>
        <span className="avatar">{initials(user.name, user.email)}</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Комментарий для коллег…"
          maxLength={2000}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" className="btn-primary small" disabled={busy || !draft.trim()}>
          Отправить
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { XIcon } from './icons'

interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, subtitle, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal-sheet${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <XIcon width={18} height={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

interface PromptDialogProps {
  title: string
  label: string
  initial?: string
  placeholder?: string
  confirmText?: string
  onSubmit: (value: string) => Promise<void> | void
  onClose: () => void
}

export function PromptDialog({
  title,
  label,
  initial = '',
  placeholder,
  confirmText = 'Готово',
  onSubmit,
  onClose,
}: PromptDialogProps) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    try {
      await onSubmit(value.trim())
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>{label}</span>
          <input ref={inputRef} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-plain" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>
            {confirmText}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Удалить',
  destructive = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn-plain" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={destructive ? 'btn-danger' : 'btn-primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

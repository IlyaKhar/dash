import { useEffect, useRef, useState } from 'react'

import type { Folder, Task, User } from '../lib/api'
import { fromLocalInput, isOverdue, longDate, toLocalInput } from '../lib/format'
import CommentThread from './CommentThread'
import {
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleIcon,
  FolderIcon,
  ListIcon,
  PinIcon,
  TrashIcon,
} from './icons'

export type TaskPatch = {
  title?: string
  body?: string
  done?: boolean
  pinned?: boolean
  folder_id?: string | null
  due_at?: string | null
}

interface TaskEditorProps {
  task: Task | null
  folders: Folder[]
  user: User
  canEdit: boolean
  onPatch: (id: string, patch: TaskPatch) => Promise<void>
  onDelete: (task: Task) => void
  onBack: () => void
  onCreate: () => void
  onCommentsCount: (taskId: string, count: number) => void
}

const CHECKED = /^\s*-\s\[x\]\s?/i
const UNCHECKED = /^\s*-\s\[\s\]\s?/

export default function TaskEditor({
  task,
  folders,
  user,
  canEdit,
  onPatch,
  onDelete,
  onBack,
  onCreate,
  onCommentsCount,
}: TaskEditorProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [checklistMode, setChecklistMode] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const dirty = useRef(false)
  const pending = useRef<{ id: string; title: string; body: string } | null>(null)

  // Черновик берётся из выбранной задачи. Зависимость только от id: пока
  // пользователь печатает, ответы сервера не должны перезаписывать текст.
  useEffect(() => {
    const draft = pending.current
    if (draft && draft.id !== task?.id && canEdit) {
      void onPatch(draft.id, { title: draft.title, body: draft.body })
      pending.current = null
    }
    setTitle(task?.title ?? '')
    setBody(task?.body ?? '')
    setStatus('idle')
    dirty.current = false
    setChecklistMode(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  // Автосохранение с задержкой, как в «Заметках»: отдельной кнопки «Сохранить» нет.
  const taskId = task?.id
  useEffect(() => {
    if (!canEdit || !dirty.current || !taskId) return
    setStatus('saving')
    pending.current = { id: taskId, title, body }
    const timer = window.setTimeout(() => {
      void onPatch(taskId, { title, body }).then(() => {
        pending.current = null
        dirty.current = false
        setStatus('saved')
      })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [title, body, taskId, onPatch, canEdit])

  if (!task) {
    return (
      <section className="editor-pane empty">
        <div className="editor-empty">
          <p>Задача не выбрана</p>
          <button type="button" className="btn-primary" onClick={onCreate}>
            Новая задача
          </button>
        </div>
      </section>
    )
  }

  const edit = (next: { title?: string; body?: string }) => {
    dirty.current = true
    if (next.title !== undefined) setTitle(next.title)
    if (next.body !== undefined) setBody(next.body)
  }

  const insertChecklistItem = () => {
    const area = bodyRef.current
    const insertion = '- [ ] '
    if (!area) {
      edit({ body: body ? `${body}\n${insertion}` : insertion })
      return
    }
    const pos = area.selectionStart
    const before = body.slice(0, pos)
    const after = body.slice(pos)
    const prefix = before === '' || before.endsWith('\n') ? '' : '\n'
    const next = `${before}${prefix}${insertion}${after}`
    edit({ body: next })
    requestAnimationFrame(() => {
      const caret = before.length + prefix.length + insertion.length
      area.focus()
      area.setSelectionRange(caret, caret)
    })
  }

  const toggleChecklistLine = (index: number) => {
    const lines = body.split('\n')
    const line = lines[index] ?? ''
    if (CHECKED.test(line)) lines[index] = line.replace(CHECKED, '- [ ] ')
    else if (UNCHECKED.test(line)) lines[index] = line.replace(UNCHECKED, '- [x] ')
    else return
    edit({ body: lines.join('\n') })
  }

  const checklistLines = body.split('\n')
  const hasChecklist = checklistLines.some((l) => CHECKED.test(l) || UNCHECKED.test(l))

  return (
    <section className="editor-pane">
      <header className="pane-head editor-head">
        <button type="button" className="icon-btn only-mobile" onClick={onBack} aria-label="К списку">
          <ChevronLeftIcon width={19} height={19} />
        </button>

        <div className="editor-tools">
          <button
            type="button"
            className={`icon-btn${task.done ? ' active' : ''}`}
            title={task.done ? 'Вернуть в работу' : 'Отметить выполненной'}
            disabled={!canEdit}
            onClick={() => void onPatch(task.id, { done: !task.done })}
          >
            {task.done ? <CheckCircleIcon width={19} height={19} /> : <CircleIcon width={19} height={19} />}
          </button>
          <button
            type="button"
            className={`icon-btn${task.pinned ? ' active' : ''}`}
            title={task.pinned ? 'Снять отметку «важное»' : 'Отметить как важное'}
            disabled={!canEdit}
            onClick={() => void onPatch(task.id, { pinned: !task.pinned })}
          >
            <PinIcon width={19} height={19} />
          </button>
          <button type="button" className="icon-btn" title="Пункт чек-листа" disabled={!canEdit} onClick={insertChecklistItem}>
            <ListIcon width={19} height={19} />
          </button>
          {hasChecklist && (
            <button
              type="button"
              className={`icon-btn${checklistMode ? ' active' : ''}`}
              title="Интерактивный чек-лист"
              disabled={!canEdit}
              onClick={() => setChecklistMode((v) => !v)}
            >
              <CheckIcon width={19} height={19} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="icon-btn danger"
              title="Удалить задачу"
              onClick={() => onDelete(task)}
            >
              <TrashIcon width={19} height={19} />
            </button>
          )}
        </div>

        <span className="save-state">
          {status === 'saving' ? 'Сохранение…' : status === 'saved' ? 'Сохранено' : ''}
        </span>
      </header>

      <div className="editor-scroll">
        <div className="editor-date">
          {longDate(task.updated_at)}
          {task.owner_id !== user.id && <span className="editor-owner"> · {task.owner_name}</span>}
          {!canEdit && <span className="editor-owner"> · только чтение</span>}
        </div>

        <input
          className="editor-title"
          value={title}
          placeholder="Заголовок задачи"
          readOnly={!canEdit}
          onChange={(e) => edit({ title: e.target.value })}
        />

        {checklistMode ? (
          <div className="checklist">
            {checklistLines.map((line, index) => {
              const checked = CHECKED.test(line)
              const isItem = checked || UNCHECKED.test(line)
              if (!isItem) {
                return line.trim() === '' ? (
                  <div key={index} className="checklist-gap" />
                ) : (
                  <p key={index} className="checklist-text">
                    {line}
                  </p>
                )
              }
              return (
                <button
                  key={index}
                  type="button"
                  className={`checklist-item${checked ? ' checked' : ''}`}
                  disabled={!canEdit}
                  onClick={() => toggleChecklistLine(index)}
                >
                  {checked ? <CheckCircleIcon width={19} height={19} /> : <CircleIcon width={19} height={19} />}
                  <span>{line.replace(checked ? CHECKED : UNCHECKED, '')}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            className="editor-body"
            value={body}
            placeholder="Описание, шаги, результаты измерений…"
            readOnly={!canEdit}
            onChange={(e) => edit({ body: e.target.value })}
          />
        )}

        <CommentThread
          taskId={task.id}
          user={user}
          taskOwnerId={task.owner_id}
          onCountChange={(count) => onCommentsCount(task.id, count)}
        />
      </div>

      <footer className="editor-foot">
        {canEdit && task.owner_id === user.id && (
          <label className="foot-field">
            <FolderIcon width={16} height={16} />
            <select
              value={task.folder_id ?? ''}
              onChange={(e) => void onPatch(task.id, { folder_id: e.target.value || null })}
            >
              <option value="">Без папки</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {canEdit ? (
          <>
            <label className={`foot-field${task.due_at && isOverdue(task.due_at) && !task.done ? ' overdue' : ''}`}>
              <CalendarIcon width={16} height={16} />
              <input
                type="datetime-local"
                value={toLocalInput(task.due_at)}
                onChange={(e) => void onPatch(task.id, { due_at: fromLocalInput(e.target.value) })}
              />
            </label>
            {task.due_at && (
              <button type="button" className="btn-plain small" onClick={() => void onPatch(task.id, { due_at: null })}>
                Убрать срок
              </button>
            )}
          </>
        ) : (
          task.due_at && (
            <span className={`due-chip${isOverdue(task.due_at) && !task.done ? ' overdue' : ''}`}>
              срок: {longDate(task.due_at)}
            </span>
          )
        )}
      </footer>
    </section>
  )
}

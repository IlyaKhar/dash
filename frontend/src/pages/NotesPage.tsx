import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AccountSheet from '../components/AccountSheet'
import { ConfirmDialog, PromptDialog } from '../components/Modal'
import Sidebar from '../components/Sidebar'
import type { Selection } from '../components/Sidebar'
import TaskEditor from '../components/TaskEditor'
import type { TaskPatch } from '../components/TaskEditor'
import TaskList from '../components/TaskList'
import { ApiError, api } from '../lib/api'
import type { Counters, Folder, Task } from '../lib/api'
import { useAuth } from '../state/auth'

const scopeTitles: Record<string, string> = {
  all: 'Все задачи',
  today: 'Сегодня',
  pinned: 'Важные',
  done: 'Выполненные',
  lab: 'Лаборатория',
}

export default function NotesPage() {
  const { user } = useAuth()
  const [folders, setFolders] = useState<Folder[]>([])
  const [counters, setCounters] = useState<Counters | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selection, setSelection] = useState<Selection>({ kind: 'scope', scope: 'all' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pane, setPane] = useState<'sidebar' | 'list' | 'editor'>('list')
  const [dialog, setDialog] = useState<
    | { kind: 'new-folder' }
    | { kind: 'rename-folder'; folder: Folder }
    | { kind: 'delete-folder'; folder: Folder }
    | { kind: 'delete-task'; task: Task }
    | { kind: 'account' }
    | null
  >(null)
  const hideTimers = useRef<number[]>([])

  const showError = useCallback((err: unknown) => {
    setError(err instanceof ApiError ? err.message : 'Не удалось выполнить операцию')
    window.setTimeout(() => setError(''), 4000)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadSidebar = useCallback(async () => {
    try {
      const [nextFolders, nextCounters] = await Promise.all([api.folders(), api.counters()])
      setFolders(nextFolders)
      setCounters(nextCounters)
    } catch (err) {
      showError(err)
    }
  }, [showError])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params =
        selection.kind === 'folder'
          ? { folder: selection.id, q: debouncedSearch }
          : { scope: selection.scope, q: debouncedSearch }
      const next = await api.tasks(params)
      setTasks(next)
      setSelectedId((current) => (current && next.some((t) => t.id === current) ? current : (next[0]?.id ?? null)))
    } catch (err) {
      showError(err)
    } finally {
      setLoading(false)
    }
  }, [selection, debouncedSearch, showError])

  useEffect(() => {
    void loadSidebar()
  }, [loadSidebar])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  useEffect(() => () => hideTimers.current.forEach((t) => window.clearTimeout(t)), [])

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId])
  const canEditSelected = Boolean(
    selectedTask && user && (selectedTask.owner_id === user.id || user.role === 'admin'),
  )

  const listTitle = selection.kind === 'folder' ? selection.name : (scopeTitles[selection.scope] ?? 'Задачи')

  const patchTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      try {
        const updated = await api.updateTask(id, patch)
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
        void loadSidebar()

        // Если задача больше не подходит под текущий фильтр — убираем её из списка,
        // но с задержкой, чтобы пользователь увидел изменение.
        const hiddenNow =
          (selection.kind === 'scope' && selection.scope === 'all' && updated.done) ||
          (selection.kind === 'scope' && selection.scope === 'done' && !updated.done) ||
          (selection.kind === 'scope' && selection.scope === 'pinned' && !updated.pinned) ||
          (selection.kind === 'folder' && updated.folder_id !== selection.id)

        if (hiddenNow) {
          const timer = window.setTimeout(() => {
            setTasks((prev) => prev.filter((t) => t.id !== id))
            setSelectedId((current) => (current === id ? null : current))
          }, 900)
          hideTimers.current.push(timer)
        }
      } catch (err) {
        showError(err)
      }
    },
    [loadSidebar, selection, showError],
  )

  const createTask = useCallback(async () => {
    try {
      const created = await api.createTask({
        title: '',
        body: '',
        folder_id: selection.kind === 'folder' ? selection.id : null,
      })
      setTasks((prev) => [created, ...prev])
      setSelectedId(created.id)
      setPane('editor')
      void loadSidebar()
    } catch (err) {
      showError(err)
    }
  }, [selection, loadSidebar, showError])

  const onCommentsCount = useCallback((id: string, count: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, comments_count: count } : t)))
  }, [])

  if (!user) return null

  return (
    <div className={`notes-shell pane-${pane}`}>
      <Sidebar
        user={user}
        folders={folders}
        counters={counters}
        selection={selection}
        onSelect={(next) => {
          setSelection(next)
          setSelectedId(null)
          setPane('list')
        }}
        onCreateFolder={() => setDialog({ kind: 'new-folder' })}
        onRenameFolder={(folder) => setDialog({ kind: 'rename-folder', folder })}
        onDeleteFolder={(folder) => setDialog({ kind: 'delete-folder', folder })}
        onOpenAccount={() => setDialog({ kind: 'account' })}
      />

      <TaskList
        title={listTitle}
        tasks={tasks}
        selectedId={selectedId}
        currentUserId={user.id}
        loading={loading}
        search={search}
        onSearch={setSearch}
        onSelect={(task) => {
          setSelectedId(task.id)
          setPane('editor')
        }}
        onToggleDone={(task) => void patchTask(task.id, { done: !task.done })}
        onCreate={() => void createTask()}
        onToggleSidebar={() => setPane('sidebar')}
      />

      <TaskEditor
        task={selectedTask}
        folders={folders}
        user={user}
        canEdit={canEditSelected}
        onPatch={patchTask}
        onDelete={(task) => setDialog({ kind: 'delete-task', task })}
        onBack={() => setPane('list')}
        onCreate={() => void createTask()}
        onCommentsCount={onCommentsCount}
      />

      {error && <div className="toast">{error}</div>}

      {dialog?.kind === 'new-folder' && (
        <PromptDialog
          title="Новая папка"
          label="Название"
          placeholder="Например, «Пробы воды»"
          confirmText="Создать"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            try {
              const folder = await api.createFolder(name)
              await loadSidebar()
              setSelection({ kind: 'folder', id: folder.id, name: folder.name })
            } catch (err) {
              showError(err)
            }
          }}
        />
      )}

      {dialog?.kind === 'rename-folder' && (
        <PromptDialog
          title="Переименовать папку"
          label="Название"
          initial={dialog.folder.name}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            try {
              const updated = await api.renameFolder(dialog.folder.id, name)
              await loadSidebar()
              setSelection((current) =>
                current.kind === 'folder' && current.id === updated.id
                  ? { kind: 'folder', id: updated.id, name: updated.name }
                  : current,
              )
            } catch (err) {
              showError(err)
            }
          }}
        />
      )}

      {dialog?.kind === 'delete-folder' && (
        <ConfirmDialog
          title="Удалить папку?"
          message={`Папка «${dialog.folder.name}» будет удалена. Задачи из неё останутся, но переедут в раздел «без папки».`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await api.deleteFolder(dialog.folder.id)
              await loadSidebar()
              setSelection((current) =>
                current.kind === 'folder' && current.id === dialog.folder.id
                  ? { kind: 'scope', scope: 'all' }
                  : current,
              )
            } catch (err) {
              showError(err)
            }
          }}
        />
      )}

      {dialog?.kind === 'delete-task' && (
        <ConfirmDialog
          title="Удалить задачу?"
          message={`«${dialog.task.title || 'Новая задача'}» будет удалена безвозвратно.`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await api.deleteTask(dialog.task.id)
              setTasks((prev) => prev.filter((t) => t.id !== dialog.task.id))
              setSelectedId((current) => (current === dialog.task.id ? null : current))
              void loadSidebar()
            } catch (err) {
              showError(err)
            }
          }}
        />
      )}

      {dialog?.kind === 'account' && <AccountSheet onClose={() => setDialog(null)} />}
    </div>
  )
}

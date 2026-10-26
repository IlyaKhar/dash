import type { Task } from '../lib/api'
import { dueLabel, isOverdue, preview, shortDate } from '../lib/format'
import { ChatIcon, CheckCircleIcon, CircleIcon, ComposeIcon, PinIcon, SearchIcon, SidebarIcon, XIcon } from './icons'

interface TaskListProps {
  title: string
  tasks: Task[]
  selectedId: string | null
  currentUserId: string
  loading: boolean
  search: string
  onSearch: (value: string) => void
  onSelect: (task: Task) => void
  onToggleDone: (task: Task) => void
  onCreate: () => void
  onToggleSidebar: () => void
}

export default function TaskList({
  title,
  tasks,
  selectedId,
  currentUserId,
  loading,
  search,
  onSearch,
  onSelect,
  onToggleDone,
  onCreate,
  onToggleSidebar,
}: TaskListProps) {
  return (
    <section className="list-pane">
      <header className="pane-head">
        <button type="button" className="icon-btn only-mobile" onClick={onToggleSidebar} aria-label="Папки">
          <SidebarIcon width={19} height={19} />
        </button>
        <h2>{title}</h2>
        <button type="button" className="icon-btn accent" onClick={onCreate} aria-label="Новая задача">
          <ComposeIcon width={19} height={19} />
        </button>
      </header>

      <div className="search-wrap">
        <SearchIcon width={15} height={15} className="search-icon" />
        <input
          className="search-input"
          placeholder="Поиск"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="search-clear" onClick={() => onSearch('')} aria-label="Очистить">
            <XIcon width={13} height={13} />
          </button>
        )}
      </div>

      <div className="list-scroll">
        {loading && tasks.length === 0 && <div className="list-placeholder">Загрузка…</div>}

        {!loading && tasks.length === 0 && (
          <div className="list-placeholder">
            {search ? 'Ничего не найдено' : 'Здесь пока пусто. Создайте первую задачу.'}
          </div>
        )}

        <ul className="task-rows">
          {tasks.map((task) => (
            <li key={task.id}>
              <div
                className={`task-row${task.id === selectedId ? ' selected' : ''}${task.done ? ' done' : ''}`}
                onClick={() => onSelect(task)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(task)
                  }
                }}
              >
                <button
                  type="button"
                  className="check"
                  aria-label={task.done ? 'Вернуть в работу' : 'Отметить выполненной'}
                  disabled={task.owner_id !== currentUserId}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleDone(task)
                  }}
                >
                  {task.done ? <CheckCircleIcon width={21} height={21} /> : <CircleIcon width={21} height={21} />}
                </button>

                <div className="task-main">
                  <div className="task-title-line">
                    <span className="task-title">{task.title || 'Новая задача'}</span>
                    {task.pinned && <PinIcon width={13} height={13} className="pin-mark" />}
                  </div>
                  <div className="task-meta">
                    <span className="task-date">{shortDate(task.updated_at)}</span>
                    {task.owner_id !== currentUserId && <span className="task-author">{task.owner_name}</span>}
                    <span className="task-preview">{preview(task.body)}</span>
                  </div>
                  <div className="task-chips">
                    {task.due_at && (
                      <span className={`due-chip${isOverdue(task.due_at) && !task.done ? ' overdue' : ''}`}>
                        {dueLabel(task.due_at)}
                      </span>
                    )}
                    {task.comments_count > 0 && (
                      <span className="due-chip comments-chip">
                        <ChatIcon width={12} height={12} /> {task.comments_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

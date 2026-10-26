import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { Counters, Folder, TaskScope, User } from '../lib/api'
import { initials } from '../lib/format'
import {
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderIcon,
  FolderPlusIcon,
  InboxIcon,
  ListIcon,
  PinIcon,
  ShieldIcon,
} from './icons'

export type Selection = { kind: 'scope'; scope: TaskScope } | { kind: 'folder'; id: string; name: string }

interface SidebarProps {
  user: User
  folders: Folder[]
  counters: Counters | null
  selection: Selection
  onSelect: (selection: Selection) => void
  onCreateFolder: () => void
  onRenameFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  onOpenAccount: () => void
}

const scopes: { scope: TaskScope; label: string; icon: ReactNode; counter: keyof Counters }[] = [
  { scope: 'all', label: 'Все задачи', icon: <ListIcon width={17} height={17} />, counter: 'all' },
  { scope: 'lab', label: 'Лаборатория', icon: <ChatIcon width={17} height={17} />, counter: 'lab' },
  { scope: 'today', label: 'Сегодня', icon: <ClockIcon width={17} height={17} />, counter: 'today' },
  { scope: 'pinned', label: 'Важные', icon: <PinIcon width={17} height={17} />, counter: 'pinned' },
  { scope: 'done', label: 'Выполненные', icon: <CheckCircleIcon width={17} height={17} />, counter: 'done' },
]

export default function Sidebar({
  user,
  folders,
  counters,
  selection,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onOpenAccount,
}: SidebarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuFor) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuFor])

  const unfiled = counters?.inbox ?? 0

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1>Папки</h1>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-group-title">Смарт-списки</div>
        <ul className="sidebar-list">
          {scopes.map((item) => (
            <li key={item.scope}>
              <button
                type="button"
                className={`sidebar-row${selection.kind === 'scope' && selection.scope === item.scope ? ' active' : ''}`}
                onClick={() => onSelect({ kind: 'scope', scope: item.scope })}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
                <span className="sidebar-count">{counters ? counters[item.counter] : ''}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="sidebar-group-title">Мои папки</div>
        <ul className="sidebar-list">
          {folders.map((folder) => {
            const active = selection.kind === 'folder' && selection.id === folder.id
            return (
              <li key={folder.id} className="sidebar-folder-item">
                <button
                  type="button"
                  className={`sidebar-row${active ? ' active' : ''}`}
                  onClick={() => onSelect({ kind: 'folder', id: folder.id, name: folder.name })}
                >
                  <span className="sidebar-icon">
                    <FolderIcon width={17} height={17} />
                  </span>
                  <span className="sidebar-label">{folder.name}</span>
                  <span className="sidebar-count">{folder.open || ''}</span>
                </button>
                <button
                  type="button"
                  className="sidebar-more"
                  aria-label={`Действия с папкой ${folder.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuFor(menuFor === folder.id ? null : folder.id)
                  }}
                >
                  •••
                </button>
                {menuFor === folder.id && (
                  <div className="popover" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuFor(null)
                        onRenameFolder(folder)
                      }}
                    >
                      Переименовать
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMenuFor(null)
                        onDeleteFolder(folder)
                      }}
                    >
                      Удалить папку
                    </button>
                  </div>
                )}
              </li>
            )
          })}

          {folders.length === 0 && <li className="sidebar-empty">Пока нет папок</li>}
        </ul>

        {unfiled > 0 && (
          <p className="sidebar-note">
            <InboxIcon width={14} height={14} /> {unfiled} задач(и) без папки
          </p>
        )}

        <button type="button" className="sidebar-add" onClick={onCreateFolder}>
          <FolderPlusIcon width={18} height={18} />
          Новая папка
        </button>
      </div>

      <footer className="sidebar-foot">
        <button type="button" className="account-btn" onClick={onOpenAccount}>
          <span className="avatar">{initials(user.name, user.email)}</span>
          <span className="account-text">
            <strong>{user.name || user.email}</strong>
            <small>{user.role === 'admin' ? 'Администратор' : 'Лаборант'}</small>
          </span>
        </button>
        {user.role === 'admin' && (
          <Link to="/admin" className="admin-link" title="Админ-панель">
            <ShieldIcon width={18} height={18} />
          </Link>
        )}
      </footer>
    </aside>
  )
}

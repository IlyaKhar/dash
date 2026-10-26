import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmDialog, Modal, PromptDialog } from '../components/Modal'
import {
  ChartIcon,
  ChevronLeftIcon,
  ClockIcon,
  KeyIcon,
  ListIcon,
  ShieldIcon,
  TrashIcon,
  UsersIcon,
} from '../components/icons'
import { ApiError, api } from '../lib/api'
import type { AdminUser, AuditEntry, Role, Stats } from '../lib/api'
import { initials, longDate, shortDate } from '../lib/format'
import { useAuth } from '../state/auth'

type Tab = 'overview' | 'users' | 'audit'

const actionLabels: Record<string, string> = {
  'user.create': 'создан пользователь',
  'user.update': 'изменены данные',
  'user.role': 'смена роли',
  'user.block': 'доступ закрыт',
  'user.unblock': 'доступ открыт',
  'user.password': 'сброс пароля',
  'user.delete': 'пользователь удалён',
}

export default function AdminPage() {
  const { user, refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | Role>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<
    | { kind: 'create' }
    | { kind: 'edit'; target: AdminUser }
    | { kind: 'password'; target: AdminUser }
    | { kind: 'delete'; target: AdminUser }
    | null
  >(null)

  const flash = useCallback((text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 3000)
  }, [])

  const fail = useCallback((err: unknown) => {
    setError(err instanceof ApiError ? err.message : 'Операция не удалась')
    window.setTimeout(() => setError(''), 5000)
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.admin.users(query, roleFilter))
    } catch (err) {
      fail(err)
    }
  }, [query, roleFilter, fail])

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.admin.stats())
    } catch (err) {
      fail(err)
    }
  }, [fail])

  const loadAudit = useCallback(async () => {
    try {
      setAudit(await api.admin.audit())
    } catch (err) {
      fail(err)
    }
  }, [fail])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 250)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  useEffect(() => {
    void loadStats()
    void loadAudit()
  }, [loadStats, loadAudit])

  const afterChange = useCallback(async () => {
    await Promise.all([loadUsers(), loadStats(), loadAudit()])
    await refresh()
  }, [loadUsers, loadStats, loadAudit, refresh])

  async function changeRole(target: AdminUser, role: Role) {
    if (target.role === role) return
    setBusyId(target.id)
    try {
      await api.admin.setRole(target.id, role)
      flash(`${target.email}: роль изменена на «${role === 'admin' ? 'администратор' : 'лаборант'}»`)
      await afterChange()
    } catch (err) {
      fail(err)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(target: AdminUser) {
    setBusyId(target.id)
    try {
      await api.admin.setActive(target.id, !target.is_active)
      flash(target.is_active ? `${target.email}: доступ закрыт` : `${target.email}: доступ открыт`)
      await afterChange()
    } catch (err) {
      fail(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <Link to="/" className="btn-plain back">
          <ChevronLeftIcon width={16} height={16} /> Заметки
        </Link>
        <div className="admin-title">
          <ShieldIcon width={20} height={20} />
          <h1>Админ-панель</h1>
        </div>
        <span className="admin-me">{user?.email}</span>
      </header>

      <nav className="admin-tabs">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          <ChartIcon width={16} height={16} /> Обзор
        </button>
        <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          <UsersIcon width={16} height={16} /> Пользователи
        </button>
        <button type="button" className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>
          <ListIcon width={16} height={16} /> Журнал
        </button>
      </nav>

      {(error || notice) && <div className={`admin-flash${error ? ' bad' : ''}`}>{error || notice}</div>}

      <main className="admin-main">
        {tab === 'overview' && (
          <section className="cards">
            <StatCard label="Пользователей" value={stats?.users} hint={`админов: ${stats?.admins ?? 0}`} />
            <StatCard label="Лаборантов" value={stats?.labs} hint={`заблокировано: ${stats?.blocked ?? 0}`} />
            <StatCard label="Всего задач" value={stats?.tasks} hint={`в работе: ${stats?.tasks_open ?? 0}`} />
            <StatCard label="Срок сегодня" value={stats?.tasks_today} hint={`просрочено: ${stats?.overdue ?? 0}`} />
            <StatCard label="Новые за 7 дней" value={stats?.new_users_7d} hint="регистрации" />
            <StatCard label="Активны за 7 дней" value={stats?.active_users_7d} hint="заходили в систему" />
          </section>
        )}

        {tab === 'users' && (
          <section className="users-section">
            <div className="users-toolbar">
              <input
                className="search-input plain"
                placeholder="Поиск по имени или email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="segmented compact">
                <button type="button" className={roleFilter === '' ? 'active' : ''} onClick={() => setRoleFilter('')}>
                  Все
                </button>
                <button
                  type="button"
                  className={roleFilter === 'lab' ? 'active' : ''}
                  onClick={() => setRoleFilter('lab')}
                >
                  Лаборанты
                </button>
                <button
                  type="button"
                  className={roleFilter === 'admin' ? 'active' : ''}
                  onClick={() => setRoleFilter('admin')}
                >
                  Админы
                </button>
              </div>
              <button type="button" className="btn-primary" onClick={() => setDialog({ kind: 'create' })}>
                Добавить пользователя
              </button>
            </div>

            <ul className="user-list">
              {users.map((item) => {
                const isSelf = item.id === user?.id
                return (
                  <li key={item.id} className={`user-card${item.is_active ? '' : ' blocked'}`}>
                    <span className="avatar">{initials(item.name, item.email)}</span>

                    <div className="user-ident">
                      <strong>
                        {item.name || item.email}
                        {isSelf && <span className="self-tag">это вы</span>}
                      </strong>
                      <span>{item.email}</span>
                      <small>
                        задач: {item.tasks_total} · в работе: {item.tasks_open} ·{' '}
                        {item.last_login_at ? `вход ${shortDate(item.last_login_at)}` : 'ещё не входил'}
                      </small>
                    </div>

                    <div className="user-role">
                      <div className="segmented compact">
                        <button
                          type="button"
                          className={item.role === 'lab' ? 'active' : ''}
                          disabled={busyId === item.id || isSelf}
                          onClick={() => void changeRole(item, 'lab')}
                        >
                          Лаборант
                        </button>
                        <button
                          type="button"
                          className={item.role === 'admin' ? 'active' : ''}
                          disabled={busyId === item.id}
                          onClick={() => void changeRole(item, 'admin')}
                        >
                          Админ
                        </button>
                      </div>
                    </div>

                    <label className="switch" title="Доступ в систему">
                      <input
                        type="checkbox"
                        checked={item.is_active}
                        disabled={busyId === item.id || isSelf}
                        onChange={() => void toggleActive(item)}
                      />
                      <span />
                    </label>

                    <div className="user-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Изменить имя и email"
                        onClick={() => setDialog({ kind: 'edit', target: item })}
                      >
                        <UsersIcon width={17} height={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Сбросить пароль"
                        onClick={() => setDialog({ kind: 'password', target: item })}
                      >
                        <KeyIcon width={17} height={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Удалить пользователя"
                        disabled={isSelf}
                        onClick={() => setDialog({ kind: 'delete', target: item })}
                      >
                        <TrashIcon width={17} height={17} />
                      </button>
                    </div>
                  </li>
                )
              })}
              {users.length === 0 && <li className="list-placeholder">Пользователи не найдены</li>}
            </ul>
          </section>
        )}

        {tab === 'audit' && (
          <section className="audit-section">
            <ul className="audit-list">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <ClockIcon width={15} height={15} />
                  <div>
                    <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                    <span>
                      {entry.actor_email} → {entry.target_email || '—'}
                      {entry.details ? ` · ${entry.details}` : ''}
                    </span>
                  </div>
                  <em>{longDate(entry.created_at)}</em>
                </li>
              ))}
              {audit.length === 0 && <li className="list-placeholder">Пока нет записей</li>}
            </ul>
          </section>
        )}
      </main>

      {dialog?.kind === 'create' && (
        <CreateUserDialog
          onClose={() => setDialog(null)}
          onCreated={async (email) => {
            flash(`${email}: пользователь создан`)
            await afterChange()
          }}
          onError={fail}
        />
      )}

      {dialog?.kind === 'edit' && (
        <EditUserDialog
          target={dialog.target}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            flash('Данные обновлены')
            await afterChange()
          }}
          onError={fail}
        />
      )}

      {dialog?.kind === 'password' && (
        <PromptDialog
          title="Сброс пароля"
          label={`Новый пароль для ${dialog.target.email}`}
          placeholder="Минимум 8 символов"
          confirmText="Сбросить"
          onClose={() => setDialog(null)}
          onSubmit={async (password) => {
            try {
              await api.admin.resetPassword(dialog.target.id, password)
              flash('Пароль сброшен, передайте его пользователю')
              await afterChange()
            } catch (err) {
              fail(err)
            }
          }}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Удалить пользователя?"
          message={`${dialog.target.email} и все его задачи (${dialog.target.tasks_total}) будут удалены безвозвратно.`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            try {
              await api.admin.deleteUser(dialog.target.id)
              flash('Пользователь удалён')
              await afterChange()
            } catch (err) {
              fail(err)
            }
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value?: number; hint: string }) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value ?? '—'}</strong>
      <span className="stat-hint">{hint}</span>
    </article>
  )
}

function CreateUserDialog({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void
  onCreated: (email: string) => Promise<void>
  onError: (err: unknown) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('lab')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.admin.createUser({ email, name, password, role })
      await onCreated(email)
      onClose()
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Новый пользователь" subtitle="Пароль сообщите сотруднику лично" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Петров" />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            placeholder="Минимум 8 символов"
          />
        </label>
        <label className="field">
          <span>Роль</span>
          <div className="segmented compact">
            <button type="button" className={role === 'lab' ? 'active' : ''} onClick={() => setRole('lab')}>
              Лаборант
            </button>
            <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
              Администратор
            </button>
          </div>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-plain" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Создать
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserDialog({
  target,
  onClose,
  onSaved,
  onError,
}: {
  target: AdminUser
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (err: unknown) => void
}) {
  const [name, setName] = useState(target.name)
  const [email, setEmail] = useState(target.email)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.admin.updateUser(target.id, { name, email })
      await onSaved()
      onClose()
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Данные пользователя" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-plain" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}

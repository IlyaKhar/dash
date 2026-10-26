import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, api } from '../lib/api'
import { initials, longDate } from '../lib/format'
import { useTheme } from '../lib/theme'
import type { Theme } from '../lib/theme'
import { useAuth } from '../state/auth'
import { Modal } from './Modal'
import { LogoutIcon, ShieldIcon } from './icons'

const themes: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, setUser, logout, isAdmin } = useAuth()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(user?.name ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!user) return null

  async function saveName() {
    setError('')
    setMessage('')
    try {
      setUser(await api.updateProfile(name))
      setMessage('Имя обновлено')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить имя')
    }
  }

  async function savePassword() {
    setError('')
    setMessage('')
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setMessage('Пароль изменён')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить пароль')
    }
  }

  return (
    <Modal title="Учётная запись" onClose={onClose}>
      <div className="account-head">
        <span className="avatar big">{initials(user.name, user.email)}</span>
        <div>
          <strong>{user.name || user.email}</strong>
          <p>{user.email}</p>
          <span className={`role-badge ${user.role}`}>{user.role === 'admin' ? 'Администратор' : 'Лаборант'}</span>
        </div>
      </div>

      <div className="ios-group">
        <div className="ios-row">
          <span>Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn-plain small" onClick={() => void saveName()}>
            Сохранить
          </button>
        </div>
        <div className="ios-row">
          <span>В системе с</span>
          <em>{longDate(user.created_at)}</em>
        </div>
        {user.last_login_at && (
          <div className="ios-row">
            <span>Последний вход</span>
            <em>{longDate(user.last_login_at)}</em>
          </div>
        )}
      </div>

      <div className="ios-group">
        <div className="ios-row">
          <span>Оформление</span>
          <div className="segmented compact">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                className={theme === t.value ? 'active' : ''}
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ios-group">
        <div className="ios-row">
          <span>Текущий пароль</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="ios-row">
          <span>Новый пароль</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} />
          <button
            type="button"
            className="btn-plain small"
            disabled={!current || next.length < 8}
            onClick={() => void savePassword()}
          >
            Изменить
          </button>
        </div>
      </div>

      {message && <p className="form-ok">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions spread">
        {isAdmin && (
          <Link to="/admin" className="btn-plain" onClick={onClose}>
            <ShieldIcon width={16} height={16} /> Админ-панель
          </Link>
        )}
        <button type="button" className="btn-danger" onClick={() => void logout()}>
          <LogoutIcon width={16} height={16} /> Выйти
        </button>
      </div>
    </Modal>
  )
}

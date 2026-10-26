export type Role = 'lab' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminUser extends User {
  tasks_total: number
  tasks_open: number
}

export interface Folder {
  id: string
  name: string
  position: number
  created_at: string
  total: number
  open: number
}

export interface Task {
  id: string
  owner_id: string
  owner_name: string
  folder_id: string | null
  title: string
  body: string
  done: boolean
  pinned: boolean
  due_at: string | null
  comments_count: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  task_id: string
  author_id: string
  author_name: string
  author_email: string
  body: string
  created_at: string
  updated_at: string
}

export interface Counters {
  all: number
  today: number
  done: number
  pinned: number
  overdue: number
  inbox: number
  lab: number
}

export interface Stats {
  users: number
  admins: number
  labs: number
  blocked: number
  tasks: number
  tasks_open: number
  tasks_today: number
  overdue: number
  new_users_7d: number
  active_users_7d: number
}

export interface AuditEntry {
  id: number
  actor_email: string
  action: string
  target_id: string | null
  target_email: string
  details: string
  created_at: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const BASE: string = import.meta.env.VITE_API_BASE ?? '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    })
  } catch {
    throw new ApiError('Сервер недоступен. Проверьте соединение.', 0)
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data: unknown = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Ошибка ${res.status}`
    throw new ApiError(message, res.status)
  }
  return data as T
}

const body = (payload: unknown) => JSON.stringify(payload)

export type TaskScope = 'all' | 'today' | 'done' | 'pinned' | 'overdue' | 'lab'

export const api = {
  publicConfig: () => request<{ allow_registration: boolean }>('/config'),

  register: (email: string, password: string, name: string) =>
    request<User>('/auth/register', { method: 'POST', body: body({ email, password, name }) }),

  login: (email: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', body: body({ email, password, name: '' }) }),

  logout: () => request<{ status: string }>('/auth/logout', { method: 'POST' }),

  me: () => request<User>('/auth/me'),

  updateProfile: (name: string) => request<User>('/auth/me', { method: 'PATCH', body: body({ name }) }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ status: string }>('/auth/password', {
      method: 'POST',
      body: body({ current_password, new_password }),
    }),

  folders: () => request<Folder[]>('/folders'),

  createFolder: (name: string) => request<Folder>('/folders', { method: 'POST', body: body({ name }) }),

  renameFolder: (id: string, name: string) =>
    request<Folder>(`/folders/${id}`, { method: 'PATCH', body: body({ name }) }),

  deleteFolder: (id: string) => request<void>(`/folders/${id}`, { method: 'DELETE' }),

  tasks: (params: { scope?: TaskScope; folder?: string; q?: string }) => {
    const search = new URLSearchParams()
    if (params.folder) search.set('folder', params.folder)
    else if (params.scope) search.set('scope', params.scope)
    if (params.q) search.set('q', params.q)
    const qs = search.toString()
    return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`)
  },

  counters: () => request<Counters>('/tasks/counters'),

  createTask: (payload: Partial<Pick<Task, 'title' | 'body' | 'pinned'>> & { folder_id?: string | null; due_at?: string | null }) =>
    request<Task>('/tasks', { method: 'POST', body: body(payload) }),

  updateTask: (id: string, payload: Partial<Pick<Task, 'title' | 'body' | 'done' | 'pinned'>> & { folder_id?: string | null; due_at?: string | null }) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: body(payload) }),

  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  comments: (taskId: string) => request<Comment[]>(`/tasks/${taskId}/comments`),

  createComment: (taskId: string, bodyText: string) =>
    request<Comment>(`/tasks/${taskId}/comments`, { method: 'POST', body: body({ body: bodyText }) }),

  updateComment: (id: string, bodyText: string) =>
    request<Comment>(`/comments/${id}`, { method: 'PATCH', body: body({ body: bodyText }) }),

  deleteComment: (id: string) => request<void>(`/comments/${id}`, { method: 'DELETE' }),

  admin: {
    users: (q = '', role = '') => {
      const search = new URLSearchParams()
      if (q) search.set('q', q)
      if (role) search.set('role', role)
      const qs = search.toString()
      return request<AdminUser[]>(`/admin/users${qs ? `?${qs}` : ''}`)
    },

    createUser: (payload: { email: string; name: string; password: string; role: Role }) =>
      request<User>('/admin/users', { method: 'POST', body: body(payload) }),

    updateUser: (id: string, payload: { name: string; email: string }) =>
      request<User>(`/admin/users/${id}`, { method: 'PATCH', body: body(payload) }),

    setRole: (id: string, role: Role) =>
      request<User>(`/admin/users/${id}/role`, { method: 'PUT', body: body({ role }) }),

    setActive: (id: string, is_active: boolean) =>
      request<User>(`/admin/users/${id}/active`, { method: 'PUT', body: body({ is_active }) }),

    resetPassword: (id: string, password: string) =>
      request<{ status: string }>(`/admin/users/${id}/password`, { method: 'POST', body: body({ password }) }),

    deleteUser: (id: string) => request<void>(`/admin/users/${id}`, { method: 'DELETE' }),

    stats: () => request<Stats>('/admin/stats'),

    audit: (limit = 60) => request<AuditEntry[]>(`/admin/audit?limit=${limit}`),
  },
}

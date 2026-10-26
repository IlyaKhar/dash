const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const full = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const fullWithTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Короткая метка как в «Заметках»: время для сегодня, «вчера», дата для остального. */
export function shortDate(iso: string): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000)
  if (days === 0) return time.format(date)
  if (days === -1) return 'вчера'
  if (days === 1) return 'завтра'
  if (date.getFullYear() === new Date().getFullYear()) return dayMonth.format(date)
  return full.format(date)
}

export function longDate(iso: string): string {
  return fullWithTime.format(new Date(iso))
}

export function dueLabel(iso: string): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000)
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (days === 0) return hasTime ? `сегодня, ${time.format(date)}` : 'сегодня'
  if (days === -1) return 'вчера'
  if (days === 1) return hasTime ? `завтра, ${time.format(date)}` : 'завтра'
  if (days < 0) return `просрочено · ${dayMonth.format(date)}`
  return dayMonth.format(date)
}

export function isOverdue(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now()
}

/** Первая строка тела заметки — как превью в списке. */
export function preview(bodyText: string): string {
  const line = bodyText
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s*\[[ x]\]\s*/i, '').trim())
    .find((l) => l.length > 0)
  return line ?? 'Нет дополнительного текста'
}

export function initials(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0] ?? '')
  return letters.join('').toUpperCase() || '?'
}

/** ISO → значение для <input type="datetime-local"> в локальной зоне. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Значение datetime-local → ISO с учётом часового пояса пользователя. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

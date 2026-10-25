export const STANDARD_DAILY_HOURS = 8
export const MAX_DAILY_HOURS = STANDARD_DAILY_HOURS
export const MAX_LOGGED_HOURS = 24
export const MIN_DAILY_HOURS = 1 / 60
const TIME_INPUT_FORMAT_ERROR = 'Enter decimal hours (e.g. 0.30) or HH:MM (e.g. 00:30).'

export function hoursToHHMM(hours: number): string {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60))
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function parseTimeInput(value: unknown): { ok: true; hours: number } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: false, error: TIME_INPUT_FORMAT_ERROR }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'Please enter a valid time.' }
    }
    if (value < 0) {
      return { ok: false, error: 'Time cannot be negative.' }
    }
    if (value < MIN_DAILY_HOURS) {
      return { ok: false, error: 'Time must be at least 00:01.' }
    }
    if (value > MAX_LOGGED_HOURS) {
      return { ok: false, error: 'Time cannot exceed 24:00.' }
    }
    return { ok: true, hours: Math.round(value * 60) / 60 }
  }

  const raw = String(value).trim()
  if (!raw) {
    return { ok: false, error: TIME_INPUT_FORMAT_ERROR }
  }

  if (/^\d+(\.\d+)?$/.test(raw) && !raw.includes(':')) {
    return parseTimeInput(Number(raw))
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return { ok: false, error: TIME_INPUT_FORMAT_ERROR }
  }

  const hoursPart = Number(match[1])
  const minutesPart = Number(match[2])
  if (!Number.isInteger(hoursPart) || !Number.isInteger(minutesPart)) {
    return { ok: false, error: 'Use HH:MM format (example 01:30).' }
  }
  if (hoursPart < 0 || minutesPart < 0) {
    return { ok: false, error: 'Time cannot be negative.' }
  }
  if (minutesPart > 59) {
    return { ok: false, error: 'Minutes must be between 00 and 59.' }
  }

  const hours = hoursPart + minutesPart / 60
  if (hours <= 0) {
    return { ok: false, error: 'Time must be greater than 00:00.' }
  }
  if (hours > MAX_LOGGED_HOURS) {
    return { ok: false, error: 'Time cannot exceed 24:00.' }
  }

  return { ok: true, hours: Math.round(hours * 60) / 60 }
}

export function parseClockTimeInput(value: unknown): { ok: true; hours: number } | { ok: false; error: string } {
  if (typeof value === 'string') {
    const raw = value.trim()
    const dottedTime = raw.match(/^(\d{1,2})\.(\d{2})$/)
    if (dottedTime) {
      return parseTimeInput(`${dottedTime[1]}:${dottedTime[2]}`)
    }
    if (raw.includes('.') && /^\d+\.\d+$/.test(raw)) {
      return { ok: false, error: 'Use HH.MM or HH:MM (e.g. 00.15 or 00:15); minutes must have two digits.' }
    }
  }

  return parseTimeInput(value)
}

'use client'

import { Bell, BellRing } from 'lucide-react'
import { reminderKey, toggleReminder, useReminders, type Reminder } from '@/lib/reminders'

type Props = {
  source: Omit<Reminder, 'key'>
  className?: string
}

// イベントのリマインダーの付け外し（ベルのボタン）
export default function ReminderButton({ source, className = '' }: Props) {
  const reminders = useReminders()
  const active = reminders.some((r) => r.key === reminderKey(source))

  return (
    <button
      type="button"
      onClick={() => toggleReminder(source)}
      aria-pressed={active}
      aria-label={active ? 'リマインドを外す' : 'リマインドする'}
      title={active ? 'リマインド中' : 'リマインドする'}
      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${
        active ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'
      } ${className}`}
    >
      {active ? <BellRing size={18} className="fill-blue-100" /> : <Bell size={18} />}
    </button>
  )
}

'use client'

import React, { useMemo, useState } from 'react'
import { Employee, EmployeePerformance, Task } from '../types'

interface DirectorPerformanceReviewProps {
  employees: Employee[]
  performanceData: EmployeePerformance[]
  tasks: Task[]
}

const getMonday = (date: Date) => {
  const monday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return monday.toISOString().slice(0, 10)
}

const getReviewWeeks = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) return []

  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1))
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
  const cursor = new Date(`${getMonday(firstDay)}T00:00:00.000Z`)
  const weeks: Array<{ week: string; periodStart: string }> = []

  while (cursor <= lastDay) {
    weeks.push({ week: `Week ${weeks.length + 1}`, periodStart: cursor.toISOString().slice(0, 10) })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return weeks
}

const formatAverage = (values: Array<number | undefined>) => {
  const available = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (available.length === 0) return '—'
  const average = available.reduce((sum, value) => sum + value, 0) / available.length
  return Number.isInteger(average) ? String(average) : average.toFixed(1)
}

const DirectorPerformanceReview: React.FC<DirectorPerformanceReviewProps> = ({
  employees,
  performanceData
}) => {
  const [month, setMonth] = useState('2026-10')
  const [employeeId, setEmployeeId] = useState('all')
  const [directorMarks, setDirectorMarks] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const reviewWeeks = useMemo(() => getReviewWeeks(month), [month])

  const selectedEmployees = employeeId === 'all'
    ? employees.filter(employee => employee.role === 'Employee')
    : employees.filter(employee => String(employee.id || employee._id) === employeeId)
  const monthOptions = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(2026, index - 6, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      value,
      label: value === month
        ? 'Time: Year/Month'
        : date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    }
  })

  const submitMarks = async () => {
    if (selectedEmployees.length === 0) {
      setMessage('No employees are available for the selected filter.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      const results = await Promise.all(selectedEmployees.flatMap(employee =>
        reviewWeeks.map(async week => {
          const response = await fetch('/api/performance/marks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: String(employee.id || employee._id),
              projectId: 'all',
              periodStart: week.periodStart,
              rating: Number(directorMarks[week.periodStart]),
              comment: ''
            })
          })
          if (!response.ok) {
            const result = await response.json()
            throw new Error(result.error || 'Failed to save Director marks.')
          }
          return response.json()
        })
      ))

      setMessage(`Director marks submitted for ${selectedEmployees.length} employee(s).`)
      void results
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit Director marks.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="director-performance-title">
      <h2 id="director-performance-title" className="text-xl font-bold text-[#1F2937]">
        Employee performance — weekly review
      </h2>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="director-performance-month">Time: Year/Month</label>
        <select
          id="director-performance-month"
          value={month}
          onChange={event => setMonth(event.target.value)}
          className="h-10 w-full max-w-[238px] rounded-md border border-[#CBD5E1] bg-white px-3 text-sm text-[#64748B] focus:border-[#2563EB] focus:outline-none"
        >
          {monthOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="director-performance-employee">Employee</label>
        <select
          id="director-performance-employee"
          value={employeeId}
          onChange={event => setEmployeeId(event.target.value)}
          className="h-10 w-full max-w-[238px] rounded-md border border-[#CBD5E1] bg-white px-3 text-sm text-[#64748B] focus:border-[#2563EB] focus:outline-none"
        >
          <option value="all">Employee: All</option>
          {employees.filter(employee => employee.role === 'Employee').map(employee => (
            <option key={String(employee.id || employee._id)} value={String(employee.id || employee._id)}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[17%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#334155] text-xs font-bold text-white">
              <th className="border border-[#CBD5E1] px-2 py-2.5">Week 1</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Task Done</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Work hours</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Free hours</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Self marks (/10)</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Co-ordinator marks (/10)</th>
              <th className="border border-[#CBD5E1] px-2 py-2.5">Director marks (/10)</th>
            </tr>
          </thead>
          <tbody>
            {reviewWeeks.map(week => {
              const employeeRows = employeeId === 'all'
                ? performanceData
                : performanceData.filter(performance => String(performance.employeeId) === employeeId)
              const history = employeeRows.flatMap(performance =>
                (performance.weeklyHistory || []).filter(item => item.periodStart === week.periodStart)
              )
              const marks = employeeRows.flatMap(performance =>
                (performance.weeklyMarks || []).filter(mark => mark.periodStart === week.periodStart)
              )
              const taskNames = Array.from(new Set(history.flatMap(item => item.taskTitles || [])))
              const tasksDone = history.reduce((sum, item) => sum + item.tasksDone, 0)
              const workHours = history.length > 0 ? history.reduce((sum, item) => sum + item.hoursLogged, 0) : undefined
              const freeHours = history.length > 0 ? history.reduce((sum, item) => sum + item.freeHours, 0) : undefined
              const directorMark = employeeId === 'all'
                ? ''
                : marks.find(mark => String(employeeRows[0]?.employeeId) === employeeId)?.rating
              return (
                <tr key={week.periodStart} className={reviewWeeks.indexOf(week) % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{week.week}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#DC2626]">
                    {taskNames.length > 0 ? <details className="relative">
                      <summary className="w-fit cursor-pointer list-none font-medium">{tasksDone} <span aria-hidden="true">▾</span></summary>
                      <ul className="absolute left-0 top-6 z-10 min-w-48 rounded-md border border-[#E5E7EB] bg-white p-2 text-xs text-[#1F2937] shadow-lg">
                        {taskNames.map((title, taskIndex) => (
                          <li key={`${title}-${taskIndex}`} className="py-1">{title}</li>
                        ))}
                      </ul>
                    </details> : '—'}
                  </td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{workHours ?? '—'}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{freeHours ?? '—'}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{formatAverage(marks.map(mark => mark.selfRating))}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{formatAverage(marks.map(mark => mark.coordinatorRating))}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#DC2626]">
                    <label className="inline-flex items-center gap-1 font-bold">
                      <span>[</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={directorMarks[week.periodStart] ?? (directorMark === undefined ? '' : String(directorMark))}
                        onChange={event => setDirectorMarks(previous => ({
                          ...previous,
                          [week.periodStart]: event.target.value
                        }))}
                        aria-label={`Director mark for ${week.week}`}
                        className="w-8 bg-transparent text-center font-bold text-[#DC2626] outline-none"
                      />
                      <span>]</span>
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => void submitMarks()}
        disabled={isSaving || reviewWeeks.some(week => !/^(10|[1-9])$/.test(
          directorMarks[week.periodStart] ?? (employeeId === 'all' ? '' : String(
            performanceData.find(performance => String(performance.employeeId) === employeeId)
              ?.weeklyMarks?.find(mark => mark.periodStart === week.periodStart)?.rating ?? ''
          ))
        ))}
        className="h-[38px] w-full max-w-[272px] rounded-md bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Submitting...' : 'Submit Saturday Marks'}
      </button>
      {message && <p role="status" className="text-sm text-[#334155]">{message}</p>}

    </section>
  )
}

export default DirectorPerformanceReview

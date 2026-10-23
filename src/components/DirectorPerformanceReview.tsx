'use client'

import React, { useState } from 'react'
import { Employee, EmployeePerformance, Task } from '../types'

interface DirectorPerformanceReviewProps {
  employees: Employee[]
  performanceData: EmployeePerformance[]
  tasks: Task[]
}

const reviewRows = [
  { week: 'Week 1 / Month 1', tasksDone: 3, workHours: 38, freeHours: 2, selfMark: 8, coordinatorMark: 7, directorMark: 8 },
  { week: 'Week 2 / Month 2', tasksDone: 4, workHours: 35, freeHours: 5, selfMark: 7, coordinatorMark: 7, directorMark: 7 },
  { week: 'Week 3 / Month 3', tasksDone: 5, workHours: 28, freeHours: 12, selfMark: 6, coordinatorMark: 6, directorMark: 6 },
  { week: 'Week 4 / Month 4', tasksDone: 3, workHours: 40, freeHours: 0, selfMark: 9, coordinatorMark: 8, directorMark: 8 }
]

const getMonday = (date: Date) => {
  const monday = new Date(date)
  const day = monday.getDay()
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
  return monday.toISOString().slice(0, 10)
}

const DirectorPerformanceReview: React.FC<DirectorPerformanceReviewProps> = ({
  employees,
  performanceData,
  tasks
}) => {
  const [month, setMonth] = useState('2026-10')
  const [employeeId, setEmployeeId] = useState('all')
  const [directorMarks, setDirectorMarks] = useState(reviewRows.map(row => String(row.directorMark)))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  const selectedEmployees = employeeId === 'all'
    ? employees.filter(employee => employee.role === 'Employee')
    : employees.filter(employee => String(employee.id || employee._id) === employeeId)
  const taskNames = tasks.filter(task => task.status === 'Completed').map(task => task.title).filter(Boolean)
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
      const [year, selectedMonth] = month.split('-').map(Number)
      const monthStart = new Date(year, selectedMonth - 1, 1)
      const firstMonday = new Date(`${getMonday(monthStart)}T00:00:00`)
      const results = await Promise.all(selectedEmployees.flatMap(employee =>
        reviewRows.map(async (row, index) => {
          const weekStart = new Date(firstMonday)
          weekStart.setDate(firstMonday.getDate() + index * 7)
          const response = await fetch('/api/performance/marks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: String(employee.id || employee._id),
              projectId: 'all',
              periodStart: getMonday(weekStart),
              rating: Number(directorMarks[index]),
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
            {reviewRows.map((row, index) => {
              const rowTasks = taskNames.slice(index * row.tasksDone, (index + 1) * row.tasksDone)
              const employeeMarks = employeeId === 'all'
                ? performanceData
                : performanceData.filter(performance => String(performance.employeeId) === employeeId)
              const selfMark = employeeId === 'all'
                ? row.selfMark
                : employeeMarks[0]?.weeklyMark?.selfRating ?? row.selfMark
              const coordinatorMark = employeeId === 'all'
                ? row.coordinatorMark
                : employeeMarks[0]?.weeklyMark?.coordinatorRating ?? row.coordinatorMark
              return (
                <tr key={row.week} className={index % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{row.week}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#DC2626]">
                    <details className="relative">
                      <summary className="w-fit cursor-pointer list-none font-medium">{row.tasksDone} <span aria-hidden="true">▾</span></summary>
                      <ul className="absolute left-0 top-6 z-10 min-w-48 rounded-md border border-[#E5E7EB] bg-white p-2 text-xs text-[#1F2937] shadow-lg">
                        {(rowTasks.length ? rowTasks : taskNames).map((title, taskIndex) => (
                          <li key={`${title}-${taskIndex}`} className="py-1">{title}</li>
                        ))}
                        {rowTasks.length === 0 && taskNames.length === 0 && <li className="py-1">No task names available</li>}
                      </ul>
                    </details>
                  </td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{row.workHours}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{row.freeHours}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{selfMark}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#475569]">{coordinatorMark}</td>
                  <td className="border border-[#E5E7EB] px-2 py-2.5 text-[#DC2626]">
                    <label className="inline-flex items-center gap-1 font-bold">
                      <span>[</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={directorMarks[index]}
                        onChange={event => setDirectorMarks(previous => previous.map((mark, markIndex) =>
                          markIndex === index ? event.target.value : mark
                        ))}
                        aria-label={`Director mark for ${row.week}`}
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
        disabled={isSaving || directorMarks.some(mark => !/^(10|[1-9])$/.test(mark))}
        className="h-[38px] w-full max-w-[272px] rounded-md bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Submitting...' : 'Submit Saturday Marks'}
      </button>
      {message && <p role="status" className="text-sm text-[#334155]">{message}</p>}

    </section>
  )
}

export default DirectorPerformanceReview

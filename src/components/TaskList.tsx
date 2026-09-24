import React from 'react';
import { Task } from '../types';
import { Calendar, Clock, User, Flag, MessageSquare, FolderOpen, Bell, AlertTriangle } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  showActions?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskClick, showActions = true }) => {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-amber-100 text-amber-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      case 'Self': return 'bg-purple-100 text-purple-800';
      case 'Daily': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getNotificationInfo = (task: Task) => {
    const tAny = task as any;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = today.toISOString().split('T')[0];

    const hasDateReminder = tAny.reminderDates?.includes(dateStr);
    const hasWeeklyReminder = tAny.weeklyReminders?.includes(dayName);

    if (hasDateReminder || hasWeeklyReminder) {
      return { active: true, message: 'Reminder due today' };
    }

    if ((tAny.reminderDates && tAny.reminderDates.length > 0) || (tAny.weeklyReminders && tAny.weeklyReminders.length > 0)) {
      return { active: false, message: 'Reminders set' };
    }

    return null;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-2">📋</div>
        <p className="text-gray-500">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const tAny = task as any;
        const isFlagged = tAny.flagDirectorInputRequired || task.flagStatus === 'Open';
        return (
          <div
            key={task.id || task._id}
            onClick={() => onTaskClick(task)}
            style={{
              backgroundColor: isFlagged ? '#fee2e2' : '#ffffff',
              border: isFlagged ? '2px solid #ef4444' : '1px solid #e5e7eb',
              borderLeft: isFlagged ? '6px solid #b91c1c' : '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isFlagged ? '0 4px 6px -1px rgba(220, 38, 38, 0.1)' : 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              if (isFlagged) {
                e.currentTarget.style.backgroundColor = '#fecaca';
              } else {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isFlagged ? '0 4px 6px -1px rgba(220, 38, 38, 0.1)' : 'none';
              if (isFlagged) {
                e.currentTarget.style.backgroundColor = '#fee2e2';
              } else {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: isFlagged ? '#991b1b' : '#111827',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {isFlagged && <AlertTriangle size={16} color="#dc2626" />}
                    {task.title}
                  </h4>
                  {tAny.isLocked && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      🔒 Locked
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {task.description}
                </p>

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <FolderOpen className="h-3 w-3" />
                    <span>{task.projectName}</span>
                  </div>

                  {tAny.assignedToName && (
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{tAny.assignedToName}</span>
                    </div>
                  )}

                  {tAny.estimatedHours && (
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{tAny.estimatedHours}h</span>
                    </div>
                  )}

                  {tAny.comments && tAny.comments.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{tAny.comments.length}</span>
                    </div>
                  )}

                  {getNotificationInfo(task) && (
                    <div className={`flex items-center space-x-1 ${getNotificationInfo(task)?.active ? 'text-red-600 font-bold' : 'text-gray-400'}`} title={getNotificationInfo(task)?.message}>
                      <Bell className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end space-y-2 ml-4">
                <div className="flex space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    <Flag className="h-3 w-3 inline mr-1" />
                    {task.priority}
                  </span>
                </div>

                {task.rating && (
                  <div className="flex items-center space-x-1 text-yellow-600">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < task.rating! ? 'text-yellow-500' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {showActions && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Assigned by: {task.assignedByName || 'Management'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TaskList;

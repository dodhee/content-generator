// src/components/CalendarGrid.tsx
// Month/Week calendar grid with drag-drop

import React from 'react';
import type { ArticleRow } from '../lib/server/articles';
import type { CalendarSlotRow } from '../types/calendar';

interface CalendarGridProps {
  workspaceId: string;
  initialMonth: string;
  slots: CalendarSlotRow[];
  articles: ArticleRow[];
  onSlotClick: (slot: CalendarSlotRow, date: Date) => void;
  onArticleDrop: (articleId: string, slotId: string) => Promise<void>;
  onSlotCreate: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  slots: CalendarSlotRow[];
}

function getDaysInMonth(year: number, month: number): CalendarDay[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const _daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({ date, isCurrentMonth: false, isToday: false, slots: [] });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      slots: [],
    });
  }

  // Next month padding to fill 6 rows (42 days)
  while (days.length < 42) {
    const date = new Date(year, month + 1, days.length - daysInMonth - startDay + 1);
    days.push({ date, isCurrentMonth: false, isToday: false, slots: [] });
  }

  return days;
}

function getSlotColor(type: string): string {
  switch (type) {
    case 'generation':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'publish':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function CalendarGrid({
  workspaceId,
  initialMonth,
  slots: allSlots,
  articles,
  onSlotClick,
  onArticleDrop,
  onSlotCreate,
}: CalendarGridProps) {
  const [month, setMonth] = React.useState(initialMonth);
  const [_view, _setView] = React.useState<'month' | 'week'>('month');
  const [selectedSlot, setSelectedSlot] = React.useState<CalendarSlotRow | null>(null);
  const [dragArticle, setDragArticle] = React.useState<ArticleRow | null>(null);

  const [year, monthNum] = month.split('-').map(Number) as [number, number];
  const days = getDaysInMonth(year, monthNum - 1);

  // Assign slots to days
  const slotsByDay: Record<string, CalendarSlotRow[]> = {};
  for (const slot of allSlots) {
    const key = slot.slot_datetime.split('T')[0] as string;
    if (!slotsByDay[key]) slotsByDay[key] = [];
    slotsByDay[key].push(slot);
  }

  const daysWithSlots = days.map((day) => {
    const key = day.date.toISOString().split('T')[0] as string;
    return {
      ...day,
      slots: (slotsByDay as Record<string, CalendarSlotRow[]>)[key] || [],
    };
  });

  const handleDragStart = (article: ArticleRow) => {
    setDragArticle(article);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (day: CalendarDay) => {
    if (!dragArticle) return;
    const key = day.date.toISOString().split('T')[0] as string;
    const daySlots = slotsByDay[key] || [];
    if (daySlots.length > 0) {
      await onArticleDrop(dragArticle.id, daySlots[0]!.id);
    } else {
      onSlotCreate(day.date);
    }
    setDragArticle(null);
  };

  const handleSlotClick = (slot: CalendarSlotRow) => {
    setSelectedSlot(slot);
    const date = new Date(slot.slot_datetime);
    onSlotClick(slot, date);
  };

  const prevMonth = () => {
    const d = new Date(year, monthNum - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const d = new Date(year, monthNum, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return (
    <div className="calendar-grid p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded">
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {monthNames[monthNum - 1]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {daysWithSlots.map((day, idx) => (
          <div
            key={idx}
            className={`relative min-h-[100px] p-1 border ${
              day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
            } ${day.isToday ? 'ring-2 ring-blue-500' : ''}
            ${!day.isCurrentMonth ? 'text-gray-400' : ''}`}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(day)}
          >
            <div className="text-xs font-medium mb-1">{day.date.getDate()}</div>
            <div className="space-y-1 max-h-[80px] overflow-auto">
              {day.slots.slice(0, 3).map((slot: CalendarSlotRow) => (
                <div
                  key={slot.id}
                  className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer border ${getSlotColor(slot.slot_type)}`}
                  onClick={() => handleSlotClick(slot)}
                >
                  {slot.slot_type === 'generation'
                    ? '📝'
                    : slot.slot_type === 'publish'
                      ? '📤'
                      : '📌'}
                  {slot.article_id && ' Article'}
                </div>
              ))}
              {day.slots.length > 3 && (
                <div className="text-xs text-gray-500 truncate">+{day.slots.length - 3} more</div>
              )}
            </div>
            {!day.slots.length && day.isCurrentMonth && (
              <div className="text-xs text-gray-300 h-4" onClick={() => onSlotCreate(day.date)}>
                +
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Article sidebar for drag source */}
      <div className="mt-4 p-3 bg-gray-50 rounded border">
        <h3 className="text-sm font-medium mb-2">Articles to Schedule</h3>
        <div className="max-h-40 overflow-auto space-y-1">
          {articles
            .filter((a) => ['draft', 'outline', 'ready'].includes(a.status))
            .slice(0, 10)
            .map((article) => (
              <div
                key={article.id}
                draggable
                onDragStart={() => handleDragStart(article)}
                className="text-xs px-2 py-1 bg-white border rounded cursor-move hover:shadow"
              >
                {article.title || 'Untitled'} ({article.status})
              </div>
            ))}
        </div>
      </div>

      {/* Slot detail modal */}
      {selectedSlot && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedSlot(null)}
        >
          <div
            className="bg-white p-4 rounded-lg w-96 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Slot Details</h3>
            <p className="text-sm text-gray-600">Type: {selectedSlot.slot_type}</p>
            <p className="text-sm text-gray-600">
              Time: {new Date(selectedSlot.slot_datetime).toLocaleString()}
            </p>
            {selectedSlot.is_recurring && <p className="text-sm text-gray-600">Recurring: Yes</p>}
            <button
              className="mt-3 px-3 py-1 bg-blue-600 text-white rounded text-sm"
              onClick={() => setSelectedSlot(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

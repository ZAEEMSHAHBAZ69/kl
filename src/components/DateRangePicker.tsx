import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface DateRangePickerProps {
  value: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date }) => void;
  className?: string;
}

interface Preset {
  label: string;
  getValue: () => { start: Date; end: Date };
}

export default function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(new Date(value.end.getFullYear(), value.end.getMonth() - 1, 1));
  const [rightMonth, setRightMonth] = useState(new Date(value.end.getFullYear(), value.end.getMonth(), 1));
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presets: Preset[] = [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { start: today, end: today };
      },
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return { start: yesterday, end: yesterday };
      },
    },
    {
      label: 'This Week',
      getValue: () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(0, 0, 0, 0);
        return { start, end };
      },
    },
    {
      label: 'Last Week',
      getValue: () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - dayOfWeek - 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
      },
    },
    {
      label: 'This Month',
      getValue: () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today);
        end.setHours(0, 0, 0, 0);
        return { start, end };
      },
    },
    {
      label: 'Last Month',
      getValue: () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start, end };
      },
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateRange = () => {
    if (value.start.getTime() === value.end.getTime()) {
      return formatDate(value.end);
    }
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  };

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    onChange(range);
    setLeftMonth(new Date(range.end.getFullYear(), range.end.getMonth() - 1, 1));
    setRightMonth(new Date(range.end.getFullYear(), range.end.getMonth(), 1));
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + offset, 1));
    setRightMonth(new Date(rightMonth.getFullYear(), rightMonth.getMonth() + offset, 1));
  };

  const renderMonth = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    const prevMonthYear = monthIndex === 0 ? year - 1 : year;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextMonthYear = monthIndex === 11 ? year + 1 : year;

    interface DayInfo {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
    }

    const days: DayInfo[] = [];

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        month: prevMonth,
        year: prevMonthYear,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        month: monthIndex,
        year: year,
        isCurrentMonth: true,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        month: nextMonth,
        year: nextMonthYear,
        isCurrentMonth: false,
      });
    }

    const isInRange = (dayInfo: DayInfo) => {
      const date = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
      date.setHours(0, 0, 0, 0);
      const start = new Date(value.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(value.end);
      end.setHours(0, 0, 0, 0);
      return date >= start && date <= end;
    };

    const isToday = (dayInfo: DayInfo) => {
      const today = new Date();
      return dayInfo.day === today.getDate() &&
             dayInfo.month === today.getMonth() &&
             dayInfo.year === today.getFullYear();
    };

    const handleDayClick = (dayInfo: DayInfo) => {
      const clickedDate = new Date(dayInfo.year, dayInfo.month, dayInfo.day);
      clickedDate.setHours(0, 0, 0, 0);

      const start = new Date(value.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(value.end);
      end.setHours(0, 0, 0, 0);

      if (clickedDate < start) {
        onChange({ start: clickedDate, end: end });
      } else if (clickedDate > end) {
        onChange({ start: start, end: clickedDate });
      } else {
        onChange({ start: clickedDate, end: clickedDate });
      }
    };

    return (
      <div className="flex-1">
        <div className="text-center mb-4">
          <div className="font-semibold text-white">
            {month.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-xs text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((dayInfo, index) => {
            const inRange = isInRange(dayInfo);
            const todayCheck = isToday(dayInfo);

            if (!dayInfo.isCurrentMonth) {
              return (
                <div
                  key={index}
                  className="aspect-square flex items-center justify-center text-sm"
                />
              );
            }

            return (
              <button
                key={index}
                onClick={() => handleDayClick(dayInfo)}
                className={`
                  aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                  text-white hover:bg-[#2C2C2C]
                  ${inRange ? 'bg-[#48a77f] text-white font-semibold hover:bg-[#3d9169]' : ''}
                  ${todayCheck && !inRange ? 'border border-[#48a77f]' : ''}
                `}
              >
                {dayInfo.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-[#161616] text-white px-4 py-2 rounded-lg border border-[#2C2C2C] hover:border-[#48a77f] focus:outline-none focus:border-[#48a77f] transition-colors"
      >
        <Calendar className="w-5 h-5 text-gray-400" />
        <span>{formatDateRange()}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-[#161616] border border-[#2C2C2C] rounded-lg shadow-xl z-50 p-4 w-[720px]">
          <div className="flex">
            <div className="w-48 border-r border-[#2C2C2C] pr-4 mr-4">
              <h3 className="text-sm font-semibold text-white mb-3">Presets</h3>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2C2C2C] rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-[#2C2C2C] rounded transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-[#2C2C2C] rounded transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex gap-6">
                {renderMonth(leftMonth)}
                {renderMonth(rightMonth)}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseSafeDate, formatLongDate } from '../utils/date';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';

interface SmartDateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disablePastDates?: boolean;
}

export const SmartDateInput: React.FC<SmartDateInputProps> = ({ 
  value, 
  onChange, 
  label, 
  required, 
  placeholder = "ex: 04.06.2026 sau 4.6",
  className = "",
  disablePastDates = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const parsedDate = parseSafeDate(value);
  const isValid = !isNaN(parsedDate.getTime()) && value.length > 2;

  const [currentMonth, setCurrentMonth] = useState(isValid ? parsedDate : new Date());

  useEffect(() => {
    if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = value.split('-');
      onChange(`${d}.${m}.${y}`);
    }
  }, [value, onChange]);

  useEffect(() => {
    if (isValid && showPicker) {
      setCurrentMonth(parsedDate);
    }
  }, [isValid, showPicker]); // Update calendar view when opening if valid date

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = (day: Date) => {
    if (disablePastDates) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (day < today) return; // ignore past dates
    }
    onChange(format(day, 'dd.MM.yyyy'));
    setShowPicker(false);
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const dateFormat = "d";
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    
    const today = new Date();
    today.setHours(0,0,0,0);

    return (
      <div className="absolute top-full left-0 mt-2 bg-bg-card border border-border-color rounded-xl shadow-2xl p-4 w-72 z-50 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-bg-main rounded-lg text-text-secondary transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="font-bold text-main capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ro })}
          </div>
          <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-bg-main rounded-lg text-text-secondary transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[10px] font-black text-text-secondary uppercase tracking-wider">{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const isSelected = isValid && isSameDay(day, parsedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isDayToday = isToday(day);
            const isPast = disablePastDates && day < today;
            
            let dayClasses = "h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all ";
            
            if (isPast) {
              dayClasses += "text-text-secondary/20 cursor-not-allowed ";
            } else if (isSelected) {
              dayClasses += "bg-accent-color text-white font-bold shadow-md shadow-accent-color/30 ";
            } else if (!isCurrentMonth) {
              dayClasses += "text-text-secondary/40 hover:bg-bg-main hover:text-text-secondary ";
            } else if (isDayToday) {
              dayClasses += "bg-accent-color/10 text-accent-color font-bold hover:bg-accent-color/20 ";
            } else {
              dayClasses += "text-main hover:bg-bg-main font-medium ";
            }

            return (
              <button
                type="button"
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={dayClasses}
                disabled={isPast}
              >
                {format(day, dateFormat)}
              </button>
            );
          })}
        </div>
        
        <div className="mt-4 pt-3 border-t border-border-color flex justify-between">
            <button 
                type="button" 
                onClick={() => handleDayClick(new Date())}
                className="text-xs font-bold text-accent-color hover:underline"
            >
                Astăzi
            </button>
            <button 
                type="button" 
                onClick={() => setShowPicker(false)}
                className="text-xs font-bold text-text-secondary hover:text-main transition-colors"
            >
                Închide
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {!isFocused && isValid ? (
          <div 
            className="w-full bg-accent-color/10 border border-accent-color/20 text-accent-color rounded-md px-4 py-3 text-sm font-bold flex items-center justify-between cursor-pointer hover:bg-accent-color/15 transition-colors"
            onClick={() => {
              setIsFocused(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <span>{formatLongDate(parsedDate)}</span>
            <div 
              className="p-1 rounded-md hover:bg-accent-color/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker(!showPicker);
              }}
            >
              <CalendarIcon size={16} />
            </div>
          </div>
        ) : (
          <>
            <input 
              ref={inputRef}
              type="text" 
              required={required}
              className="w-full bg-bg-main border border-border-color rounded-md px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color placeholder:text-text-secondary/30 transition-all"
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                // Delay blur to allow clicks on the calendar icon to register without hiding the input instantly
                setTimeout(() => setIsFocused(false), 200);
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button 
                type="button"
                className="p-1.5 rounded-md text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPicker(!showPicker);
                }}
              >
                <CalendarIcon size={16} />
              </button>
            </div>
          </>
        )}
        
        {showPicker && renderCalendar()}
      </div>
    </div>
  );
};

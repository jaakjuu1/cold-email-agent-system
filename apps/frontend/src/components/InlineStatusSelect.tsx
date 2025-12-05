import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

type ProspectStatus = 'new' | 'researched' | 'contacted' | 'responded' | 'converted' | 'rejected';

const statusColors: Record<ProspectStatus, string> = {
  new: 'bg-surface-100 text-surface-600 hover:bg-surface-200',
  researched: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  contacted: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  responded: 'bg-green-100 text-green-700 hover:bg-green-200',
  converted: 'bg-primary-100 text-primary-700 hover:bg-primary-200',
  rejected: 'bg-red-100 text-red-700 hover:bg-red-200',
};

const statusLabels: Record<ProspectStatus, string> = {
  new: 'New',
  researched: 'Researched',
  contacted: 'Contacted',
  responded: 'Responded',
  converted: 'Converted',
  rejected: 'Rejected',
};

const allStatuses: ProspectStatus[] = ['new', 'researched', 'contacted', 'responded', 'converted', 'rejected'];

interface InlineStatusSelectProps {
  status: ProspectStatus;
  onStatusChange: (status: ProspectStatus) => void;
  disabled?: boolean;
}

export function InlineStatusSelect({ status, onStatusChange, disabled }: InlineStatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newStatus: ProspectStatus) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer',
          statusColors[status],
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {statusLabels[status]}
        <ChevronDown className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-lg border border-surface-200 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(s);
              }}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-50 transition-colors',
                s === status && 'bg-surface-50'
              )}
            >
              <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusColors[s])}>
                {statusLabels[s]}
              </span>
              {s === status && <Check className="w-4 h-4 text-primary-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

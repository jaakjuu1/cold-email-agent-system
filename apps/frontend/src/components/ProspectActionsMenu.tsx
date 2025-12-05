import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Search, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ProspectActionsMenuProps {
  onViewDetails: () => void;
  onDeepResearch: () => void;
  onDelete: () => void;
  isResearching?: boolean;
  isDeleting?: boolean;
}

export function ProspectActionsMenu({
  onViewDetails,
  onDeepResearch,
  onDelete,
  isResearching,
  isDeleting,
}: ProspectActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowDeleteConfirm(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onViewDetails();
  };

  const handleDeepResearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onDeepResearch();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowDeleteConfirm(false);
        }}
        className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-surface-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* View Details */}
          <button
            onClick={handleViewDetails}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-surface-400" />
            View Details
          </button>

          {/* Deep Research */}
          <button
            onClick={handleDeepResearch}
            disabled={isResearching}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
              isResearching
                ? 'text-surface-400 cursor-not-allowed'
                : 'text-surface-700 hover:bg-surface-50'
            )}
          >
            {isResearching ? (
              <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-surface-400" />
            )}
            {isResearching ? 'Researching...' : 'Deep Research'}
          </button>

          <div className="my-1 border-t border-surface-100" />

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="px-3 py-2">
              <p className="text-xs text-surface-500 mb-2">Delete this prospect?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  className="flex-1 px-2 py-1 text-xs font-medium text-surface-600 bg-surface-100 rounded hover:bg-surface-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

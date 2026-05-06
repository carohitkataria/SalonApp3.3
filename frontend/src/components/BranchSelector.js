import { Building2, ChevronDown, Star, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useBranch } from '@/contexts/BranchContext';

export default function BranchSelector({ compact = false }) {
  const { branches, selectedBranchId, selectedBranch, setSelectedBranchId } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!branches || branches.length === 0) return null;

  const label = selectedBranch?.branch_name || 'Select Branch';

  return (
    <div className="relative" ref={ref} data-testid="branch-selector">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border border-gold/40 bg-gold/10 hover:bg-gold/20 transition-colors text-foreground ${
          compact ? 'text-xs' : 'text-sm'
        }`}
        data-testid="branch-selector-trigger"
        title="Switch Branch"
      >
        <Building2 className="w-4 h-4 text-gold flex-shrink-0" />
        <span className="font-medium truncate max-w-[120px] md:max-w-[200px]">
          {label}
        </span>
        {selectedBranch?.is_main_branch && (
          <Star className="w-3 h-3 text-gold flex-shrink-0" />
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-auto bg-card border border-border rounded-lg shadow-2xl z-50"
          data-testid="branch-selector-dropdown"
        >
          <div className="p-2 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold px-1">
              Switch Branch
            </p>
          </div>
          {branches.map((b) => {
            const isSelected = b.id === selectedBranchId;
            return (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBranchId(b.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center justify-between gap-2 ${
                  isSelected ? 'bg-gold/10' : ''
                }`}
                data-testid={`branch-option-${b.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{b.branch_name}</span>
                    {b.is_main_branch && (
                      <Star className="w-3 h-3 text-gold flex-shrink-0" />
                    )}
                  </div>
                  {(b.city || b.branch_code) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {b.branch_code ? `${b.branch_code}` : ''}
                      {b.branch_code && b.city ? ' · ' : ''}
                      {b.city || ''}
                    </p>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-gold flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

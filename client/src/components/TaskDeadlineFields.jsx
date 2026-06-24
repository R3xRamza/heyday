import { useMemo } from 'react';
import { getTimelineSteps } from '../constants/transactionForm';
import DateText from './shared/DateText';
import {
  TIMELINE_KEY_TO_ANCHOR,
  computeTaskDueDate,
  formatTimingSummary,
} from '../utils/taskTiming';

export function getAnchorOptionsForTransaction(transaction) {
  if (!transaction) return [];
  const steps = getTimelineSteps(transaction.representing);
  const options = steps
    .map((step) => ({
      anchor: TIMELINE_KEY_TO_ANCHOR[step.key],
      label: step.label,
      date: transaction[step.key],
    }))
    .filter((o) => o.anchor);

  const createdAt = transaction.created_at?.slice(0, 10);
  if (createdAt) {
    options.push({ anchor: 'CREATED', label: 'Created date', date: createdAt });
  }
  return options;
}

export default function TaskDeadlineFields({
  transaction,
  deadlineMode,
  onDeadlineModeChange,
  dueDate,
  onDueDateChange,
  timingValue,
  onTimingValueChange,
  timingDirection,
  onTimingDirectionChange,
  timingAnchor,
  onTimingAnchorChange,
  readOnlyRelative = false,
}) {
  const anchorOptions = useMemo(
    () => getAnchorOptionsForTransaction(transaction),
    [transaction],
  );

  const previewDueDate = useMemo(() => {
    if (deadlineMode !== 'relative') return dueDate || null;
    return computeTaskDueDate(transaction, timingValue, timingDirection, timingAnchor);
  }, [deadlineMode, dueDate, transaction, timingValue, timingDirection, timingAnchor]);

  const selectedAnchor = anchorOptions.find((o) => o.anchor === timingAnchor);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase">Deadline</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={readOnlyRelative}
            onClick={() => onDeadlineModeChange('fixed')}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
              deadlineMode === 'fixed'
                ? 'bg-primary-container text-white border-primary-container'
                : 'bg-white text-on-surface-variant border-outline-variant/30 hover:bg-off-white'
            }`}
          >
            Fixed date
          </button>
          <button
            type="button"
            disabled={readOnlyRelative}
            onClick={() => onDeadlineModeChange('relative')}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
              deadlineMode === 'relative'
                ? 'bg-primary-container text-white border-primary-container'
                : 'bg-white text-on-surface-variant border-outline-variant/30 hover:bg-off-white'
            }`}
          >
            Transaction date
          </button>
        </div>
      </div>

      {deadlineMode === 'fixed' ? (
        <div>
          <label className="text-xs font-semibold text-on-surface-variant uppercase">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Days</label>
              <input
                type="number"
                min={0}
                disabled={readOnlyRelative}
                value={timingValue ?? 0}
                onChange={(e) => onTimingValueChange(Number(e.target.value))}
                className="w-full mt-1 px-2 py-2 border border-outline-variant/30 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">When</label>
              <select
                disabled={readOnlyRelative}
                value={timingDirection || 'A'}
                onChange={(e) => onTimingDirectionChange(e.target.value)}
                className="w-full mt-1 px-2 py-2 border border-outline-variant/30 rounded text-sm"
              >
                <option value="A">After</option>
                <option value="B">Before</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Milestone</label>
              <select
                disabled={readOnlyRelative}
                value={timingAnchor || ''}
                onChange={(e) => onTimingAnchorChange(e.target.value)}
                className="w-full mt-1 px-2 py-2 border border-outline-variant/30 rounded text-sm"
              >
                <option value="">Select milestone…</option>
                {anchorOptions.map((opt) => {
                  const title = opt.date
                    ? `${opt.label} (${opt.date})`
                    : `${opt.label} (not set)`;
                  return (
                    <option key={opt.anchor} value={opt.anchor} title={title}>
                      {opt.label}
                      {!opt.date ? ' (not set)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          {selectedAnchor && !selectedAnchor.date && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              {selectedAnchor.label} is not set on this transaction yet. The due date will update when you add it.
            </p>
          )}
          {previewDueDate ? (
            <p className="text-xs text-on-surface-variant">
              Due: <DateText value={previewDueDate} className="font-semibold text-primary" />
              {' · '}
              {formatTimingSummary({
                timing_value: timingValue,
                timing_direction: timingDirection,
                timing_anchor: timingAnchor,
              })}
            </p>
          ) : timingAnchor ? (
            <p className="text-xs text-on-surface-variant">Due date will be set when the milestone date is added.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

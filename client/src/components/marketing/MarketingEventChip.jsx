import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { chipStyleForPlatform } from './platformColors';
import { MARKETING_POST_DRAG_TYPE, MARKETING_TASK_DRAG_TYPE, celebrationDisplayName, celebrationChipPrefix } from './calendarUtils';

function PostChip({ event, onEditPost }) {
  const { bg, text, border, icon } = chipStyleForPlatform(event.platform);
  const draggedRef = useRef(false);
  const isDone = event.raw?.status === 'done' || event.status === 'done';

  function handleDragStart(e) {
    e.stopPropagation();
    draggedRef.current = true;
    e.dataTransfer.setData(MARKETING_POST_DRAG_TYPE, String(event.raw.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    e.stopPropagation();
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  function handleClick(e) {
    e.stopPropagation();
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onEditPost?.(event.raw);
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`w-full text-left px-2 py-1.5 text-[11px] font-semibold rounded-md truncate hover:brightness-95 transition-colors flex items-center gap-1.5 cursor-grab active:cursor-grabbing shadow-sm ${bg} ${text} ${border || ''} ${
        isDone ? 'opacity-55 saturate-50' : ''
      }`}
    >
      <Icon name={isDone ? 'check_circle' : icon} className="!text-[14px] shrink-0" />
      <span className={`truncate ${isDone ? 'line-through' : ''}`}>{event.title}</span>
    </button>
  );
}

function TaskChip({ event, onTaskClick }) {
  const isComplete = event.raw?.status === 'complete';
  const overdue = !isComplete && event.raw?.is_overdue;
  const draggedRef = useRef(false);
  const chipClass = isComplete
    ? 'border-l-4 border-l-stone-400 bg-stone-100 text-stone-500 hover:bg-stone-200/70 ring-1 ring-stone-200/80'
    : overdue
      ? 'border-l-4 border-error bg-red-50 text-error hover:bg-red-100/80 ring-1 ring-error/20'
      : 'border-l-4 border-l-stone-500 bg-stone-200 text-stone-900 hover:bg-stone-300/70 ring-1 ring-stone-300/80';

  function handleDragStart(e) {
    e.stopPropagation();
    draggedRef.current = true;
    e.dataTransfer.setData(MARKETING_TASK_DRAG_TYPE, String(event.raw.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    e.stopPropagation();
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  function handleClick(e) {
    e.stopPropagation();
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onTaskClick?.(event);
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`block w-full text-left px-2 py-2 min-h-[44px] rounded-md transition-colors cursor-grab active:cursor-grabbing shadow-sm ${chipClass} ${
        isComplete ? 'opacity-60' : ''
      }`}
      title={event.subtitle ? `${event.title} — ${event.subtitle}` : event.title}
    >
      <span className="flex items-start gap-1.5">
        <Icon
          name={isComplete ? 'check_circle' : 'task_alt'}
          className={`!text-[14px] shrink-0 mt-0.5 ${isComplete ? 'text-stone-500' : 'text-stone-600'}`}
        />
        <span className="min-w-0 flex-1">
          <span className={`text-xs font-semibold line-clamp-2 block leading-snug ${isComplete ? 'line-through' : ''}`}>
            {event.title}
          </span>
          {event.subtitle && (
            <span
              className={`text-[10px] line-clamp-1 block mt-0.5 ${
                isComplete ? 'text-stone-500 line-through' : overdue ? 'text-error/80' : 'text-stone-600'
              }`}
            >
              {event.subtitle}
            </span>
          )}
          {event.platform && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-wide line-clamp-1 block mt-0.5 ${
                isComplete ? 'text-stone-400' : 'text-stone-500'
              }`}
            >
              {event.platform}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function MarketingEventChip({ event, onEditPost, onTaskClick }) {
  if (event.kind === 'post') {
    return <PostChip event={event} onEditPost={onEditPost} />;
  }

  if (event.kind === 'task') {
    return <TaskChip event={event} onTaskClick={onTaskClick} />;
  }

  const isBirthday = event.kind === 'birthday';
  const displayName = isBirthday
    ? celebrationDisplayName({ type: 'birthday', subtype: event.subtype, name: event.title })
    : celebrationDisplayName({ type: 'anniversary', subtype: event.subtype, name: event.title });
  const chipPrefix = isBirthday
    ? 'Birthday'
    : celebrationChipPrefix({ type: 'anniversary', subtype: event.subtype });
  const isChild = event.subtype === 'child';

  return (
    <Link
      to={`/crm/${event.contactId}`}
      className="block w-full text-left px-2 py-1.5 text-[11px] font-semibold rounded-md bg-purple/10 text-purple truncate hover:bg-purple/15 transition-colors flex items-center gap-1.5 select-none"
    >
      <Icon name={isBirthday ? 'cake' : 'home'} className="!text-[14px] shrink-0" />
      <span className="truncate min-w-0 flex-1">
        {chipPrefix}: {displayName}
      </span>
      {isChild && (
        <span
          className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple/20 text-[9px] font-bold leading-none"
          title="Kid"
        >
          K
        </span>
      )}
    </Link>
  );
}

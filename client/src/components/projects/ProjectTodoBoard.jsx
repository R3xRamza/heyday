import TodoCard from './TodoCard';

export function TodoColumnList({ items, emptyMessage, onToggle, onUpdate, onDelete, readOnly }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-6">
        {emptyMessage}
      </p>
    );
  }

  return items.map((item) => (
    <TodoCard
      key={item.id}
      item={item}
      onToggle={onToggle}
      onUpdate={onUpdate}
      onDelete={onDelete}
      readOnly={readOnly}
    />
  ));
}

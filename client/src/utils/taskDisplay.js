export function displayTaskTitle(task) {
  const nick = task?.calendar_nickname?.trim();
  return nick || task?.title || '';
}

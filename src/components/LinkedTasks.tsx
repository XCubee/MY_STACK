import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, Notice } from './ui';
import type { Task, TaskSource } from '../domain/task';
import { useApp } from '../state/AppContext';
import { useActivity } from '../state/ActivityContext';
import { useTasks } from '../state/TaskContext';

export function LinkedTasks({
  source,
  onAddTask,
}: {
  source: TaskSource;
  onAddTask: () => void;
}) {
  const { theme } = useApp();
  const { recordActivity } = useActivity();
  const { tasks, ready, updateTask } = useTasks();
  const linked = tasks
    .filter(
      (task) =>
        task.source?.type === source.type && task.source.id === source.id,
    )
    .sort((a, b) => {
      if (!a.dueDate) return b.dueDate ? 1 : b.updatedAt.localeCompare(a.updatedAt);
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const complete = (task: Task) => {
    updateTask({ ...task, status: 'completed' });
    recordActivity({
      eventType: 'completed',
      sourceType: 'task',
      sourceId: task.id,
      summary: `Completed task: ${task.title}`,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        Related tasks
      </Text>
      {!ready ? (
        <Text style={[styles.muted, { color: theme.colors.muted }]}>
          Loading linked tasks…
        </Text>
      ) : linked.length ? (
        linked.map((task) => (
          <View
            key={task.id}
            style={[
              styles.task,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, { color: theme.colors.text }]}>
                {task.title}
              </Text>
              <Text style={[styles.muted, { color: theme.colors.muted }]}>
                {task.status.replace('_', ' ')}
                {task.dueDate ? ` · ${task.dueDate}` : ''}
              </Text>
            </View>
            {task.status === 'open' || task.status === 'in_progress' ? (
              <ActionButton
                label="Done"
                secondary
                onPress={() => complete(task)}
                style={styles.done}
              />
            ) : null}
          </View>
        ))
      ) : (
        <Notice>No tasks linked to this record yet.</Notice>
      )}
      <ActionButton
        label="Add related task"
        secondary
        onPress={onAddTask}
        style={styles.add}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 22 },
  heading: { fontSize: 18, fontWeight: '900', marginBottom: 9 },
  task: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 11,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskCopy: { flex: 1, gap: 4 },
  taskTitle: { fontSize: 14, fontWeight: '800' },
  muted: { fontSize: 12 },
  done: { minHeight: 40, paddingHorizontal: 12 },
  add: { marginTop: 2 },
});

"use client";

import { useMemo, useState } from "react";
import { IllustrativeBadge } from "@/components/marketing/ExampleBusinesses";
import styles from "@/components/marketing/customDemos.module.css";

type Status = "waiting" | "today" | "done";
type Priority = "high" | "normal";

type Task = {
  id: string;
  name: string;
  note: string;
  status: Status;
  priority: Priority;
};

const SYNTHETIC: Task[] = [
  { id: "t1", name: "Maya Chen", note: "Send the revised agenda.", status: "today", priority: "high" },
  { id: "t2", name: "Owen Hale", note: "Confirm next week’s window.", status: "waiting", priority: "normal" },
  { id: "t3", name: "Priya Shah", note: "Share the sample checklist.", status: "waiting", priority: "high" },
  { id: "t4", name: "Jonah West", note: "Already closed last Friday.", status: "done", priority: "normal" }
];

export function FollowUpWorkspace({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState(SYNTHETIC);
  const [status, setStatus] = useState<"all" | Status>("all");
  const [priority, setPriority] = useState<"all" | Priority>("all");

  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (status === "all" || task.status === status) && (priority === "all" || task.priority === priority)
      ),
    [priority, status, tasks]
  );

  function cycleStatus(id: string) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const next: Status = task.status === "waiting" ? "today" : task.status === "today" ? "done" : "waiting";
        return { ...task, status: next };
      })
    );
  }

  function togglePriority(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, priority: task.priority === "high" ? "normal" : "high" } : task
      )
    );
  }

  return (
    <div className={styles.panel} data-demo="follow-up-workspace">
      <IllustrativeBadge />
      <header className={styles.header}>
        <strong className={styles.word}>Follow-up</strong>
        {!compact ? (
          <div className={styles.filters} role="group" aria-label="Filter synthetic follow-ups">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["waiting", "Waiting"],
                ["done", "Done"]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={styles.filter}
                type="button"
                aria-pressed={status === id}
                onClick={() => setStatus(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      {!compact ? (
        <div className={styles.filters} style={{ padding: "10px 14px 0" }} role="group" aria-label="Filter by priority">
          {(
            [
              ["all", "Any priority"],
              ["high", "High"],
              ["normal", "Normal"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={styles.filter}
              type="button"
              aria-pressed={priority === id}
              onClick={() => setPriority(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.body}>
        {visible.length ? (
          visible.map((task) => (
            <article className={styles.card} key={task.id} data-task={task.id}>
              <p className={styles.meta} data-task-meta={task.id}>
                {task.priority} · {task.status}
              </p>
              <strong>{task.name}</strong>
              <p>{task.note}</p>
              <div className={styles.actions}>
                <button
                  className={styles.action}
                  type="button"
                  data-action="cycle-status"
                  onClick={() => cycleStatus(task.id)}
                >
                  Change status
                </button>
                <button className={styles.action} type="button" onClick={() => togglePriority(task.id)}>
                  Change priority
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className={styles.empty}>Nothing matches this view. The synthetic list is still here — change a filter.</p>
        )}
      </div>
      <p className={styles.note}>Synthetic names only. Not a live inbox or employer system.</p>
    </div>
  );
}

export type ReminderAction = {
  type: "reminder";
  fire_at: string; // ISO8601
  text: string;
  repeat?: "none" | "daily" | "weekly";
  /** Target household member slug (e.g. "sam", "alex"). If omitted, targets the sender. */
  target?: string;
  /** If true, repeats until user acknowledges (replies to the conversation) */
  critical?: boolean;
};

export type ListRemindersAction = {
  type: "list-reminders";
  all?: boolean; // owner only — list all household reminders
};

export type CancelReminderAction = {
  type: "cancel-reminder";
  id: number;
};

// Future types (define but not implement yet):
export type ExpenseAction = { type: "expense"; amount: number; currency: string; category: string; description?: string; date?: string };
export type HealthLogAction = { type: "health_log"; metric: string; value: number; unit: string; note?: string };
export type TaskAction = { type: "task"; operation: string; title: string; assignee?: string; due_date?: string };

export type HearthAction = ReminderAction | ListRemindersAction | CancelReminderAction | ExpenseAction | HealthLogAction | TaskAction;

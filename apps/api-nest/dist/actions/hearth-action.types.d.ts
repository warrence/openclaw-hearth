export type ReminderAction = {
    type: "reminder";
    fire_at: string;
    text: string;
    repeat?: "none" | "daily" | "weekly";
    target?: string;
    critical?: boolean;
};
export type ListRemindersAction = {
    type: "list-reminders";
    all?: boolean;
};
export type CancelReminderAction = {
    type: "cancel-reminder";
    id: number;
};
export type ExpenseAction = {
    type: "expense";
    amount: number;
    currency: string;
    category: string;
    description?: string;
    date?: string;
};
export type HealthLogAction = {
    type: "health_log";
    metric: string;
    value: number;
    unit: string;
    note?: string;
};
export type TaskAction = {
    type: "task";
    operation: string;
    title: string;
    assignee?: string;
    due_date?: string;
};
export type HearthAction = ReminderAction | ListRemindersAction | CancelReminderAction | ExpenseAction | HealthLogAction | TaskAction;

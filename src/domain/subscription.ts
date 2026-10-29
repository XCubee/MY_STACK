export const REMINDER_DAY_OPTIONS = [0, 1, 3, 7, 14] as const;

export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  renewalDate: string;
  billingCycle: BillingCycle;
  category: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  notes: string;
};

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function makeSubscriptionId(): string {
  return `subscription-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function subscriptionFromRow(row: Record<string, unknown>): Subscription {
  const id = row.id;
  const name = row.name;
  const amount = Number(row.amount);
  const currency = row.currency;
  const renewalDate = row.renewal_date;
  const billingCycle = row.billing_cycle;
  const reminderDaysBefore = Number(row.reminder_days_before);

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof renewalDate !== 'string' ||
    !isValidDateOnly(renewalDate) ||
    !['weekly', 'monthly', 'yearly'].includes(String(billingCycle)) ||
    typeof row.reminder_enabled !== 'boolean' ||
    !Number.isInteger(reminderDaysBefore) ||
    !REMINDER_DAY_OPTIONS.includes(
      reminderDaysBefore as (typeof REMINDER_DAY_OPTIONS)[number],
    )
  ) {
    throw new Error('Subscription data from storage has an unsupported format.');
  }

  return {
    id,
    name,
    amount,
    currency,
    renewalDate,
    billingCycle: billingCycle as BillingCycle,
    category: typeof row.category === 'string' ? row.category : 'Other',
    reminderEnabled: row.reminder_enabled === true,
    reminderDaysBefore,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}

export function subscriptionToRow(
  subscription: Subscription,
  userId: string,
) {
  return {
    id: subscription.id,
    user_id: userId,
    name: subscription.name,
    amount: subscription.amount,
    currency: subscription.currency,
    renewal_date: subscription.renewalDate,
    billing_cycle: subscription.billingCycle,
    category: subscription.category,
    reminder_enabled: subscription.reminderEnabled,
    reminder_days_before: subscription.reminderDaysBefore,
    notes: subscription.notes,
    updated_at: new Date().toISOString(),
  };
}

export function daysUntilRenewal(renewalDate: string, today = new Date()): number {
  const [year, month, day] = renewalDate.split('-').map(Number);
  const renewal = Date.UTC(year, month - 1, day);
  const current = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.ceil((renewal - current) / 86_400_000);
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatRenewalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

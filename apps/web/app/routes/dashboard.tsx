import { createFileRoute } from '@tanstack/react-router';
import { UnreadBadge } from '../components/UnreadBadge';
import { Button } from '../components/form/Button';
import { Card } from '../components/form/Card';
import { Table, type TableColumn } from '../components/form/Table';
import {
  useStats,
  useScrapeRuns,
  useEmailDeliveries,
  useTriggerRefresh,
  useUnreadCount,
} from '../lib/queries';
import type { ScrapeRun, EmailDeliveryRow } from '@kvkk/shared';

function statusPill(status: string) {
  const map: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    SENT: 'bg-green-100 text-green-700',
    PENDING: 'bg-gray-100 text-gray-700',
  };
  const cls = map[status.toUpperCase()] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('tr-TR');
}

function formatDuration(start: Date | string, end: Date | string | null): string {
  if (!end) return '-';
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  const ms = e.getTime() - s.getTime();
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function DashboardPage() {
  const { data: stats } = useStats();
  const { data: runs } = useScrapeRuns();
  const { data: deliveries } = useEmailDeliveries();
  const { data: unreadData } = useUnreadCount();
  const { mutate: refresh, isPending } = useTriggerRefresh();

  const recentRuns = (runs ?? []).slice(0, 5);
  const recentDeliveries = (deliveries?.items ?? []).slice(0, 5);

  const runColumns: TableColumn<ScrapeRun>[] = [
    { key: 'startedAt', header: 'Started', render: (r) => formatDateTime(r.startedAt) },
    { key: 'duration', header: 'Duration', render: (r) => formatDuration(r.startedAt, r.finishedAt) },
    { key: 'status', header: 'Status', render: (r) => statusPill(r.status) },
    { key: 'pagesWalked', header: 'Pages', render: (r) => r.pagesWalked },
    { key: 'postsFound', header: 'Found', render: (r) => r.postsFound },
    { key: 'postsInserted', header: 'Inserted', render: (r) => r.postsInserted },
  ];

  const deliveryColumns: TableColumn<EmailDeliveryRow>[] = [
    { key: 'sentAt', header: 'Sent At', render: (d) => formatDateTime(d.sentAt) },
    { key: 'recipient', header: 'Recipient', render: (d) => d.recipient },
    {
      key: 'postTitle',
      header: 'Post',
      render: (d) => <span className="line-clamp-1 max-w-md inline-block">{d.postTitle}</span>,
    },
    { key: 'status', header: 'Status', render: (d) => statusPill(d.status) },
  ];

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <UnreadBadge count={unreadData?.unreadCount ?? 0} />
        </div>
        <Button onClick={() => refresh()} loading={isPending}>
          {isPending ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Total Posts" value={stats?.totalPosts ?? '-'} />
          <Card title="This Week" value={stats?.postsThisWeek ?? '-'} />
          <Card title="Unread" value={stats?.unreadCount ?? '-'} />
          <Card
            title="Last Run"
            value={
              <span className="text-base font-semibold">
                {stats?.lastRunAt ? formatDateTime(stats.lastRunAt) : '-'}
              </span>
            }
            subLabel={stats?.lastRunStatus ? statusPill(stats.lastRunStatus) : null}
          />
        </div>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Scrape Runs</h3>
          <Table columns={runColumns} rows={recentRuns} empty="No scrape runs yet" />
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Email Deliveries</h3>
          <Table
            columns={deliveryColumns}
            rows={recentDeliveries}
            empty="No email deliveries yet"
          />
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/' as never)({
  component: DashboardPage,
});

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '../components/form/Button';
import { Field } from '../components/form/Field';
import { Input } from '../components/form/Input';
import { Select } from '../components/form/Select';
import { useSettings, useUpdateSettings } from '../lib/queries';
import { useToast } from '../components/Toast';
import type { AppConfigPatch, RefreshMode } from '@kvkk/shared';

interface FormState {
  cronExpression: string;
  refreshMode: RefreshMode;
  refreshMaxPages: number;
  refreshMaxConsecutiveDuplicates: number;
}

function ScrapeSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { mutateAsync: update, isPending } = useUpdateSettings();
  const toast = useToast();

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        cronExpression: settings.cronExpression,
        refreshMode: settings.refreshMode,
        refreshMaxPages: settings.refreshMaxPages,
        refreshMaxConsecutiveDuplicates: settings.refreshMaxConsecutiveDuplicates,
      });
    }
  }, [settings, form]);

  const dirty = useMemo(() => {
    if (!settings || !form) return false;
    return (
      form.cronExpression !== settings.cronExpression ||
      form.refreshMode !== settings.refreshMode ||
      form.refreshMaxPages !== settings.refreshMaxPages ||
      form.refreshMaxConsecutiveDuplicates !== settings.refreshMaxConsecutiveDuplicates
    );
  }, [settings, form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !dirty) return;
    const patch: AppConfigPatch = {
      cronExpression: form.cronExpression,
      refreshMode: form.refreshMode,
      refreshMaxPages: form.refreshMaxPages,
      refreshMaxConsecutiveDuplicates: form.refreshMaxConsecutiveDuplicates,
    };
    try {
      await update(patch);
      toast.success('Scrape settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Scrape Config</h2>
      </div>

      <div className="p-8">
        {isLoading || !form ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <form onSubmit={onSubmit} className="max-w-xl space-y-5 bg-white rounded-lg shadow-sm p-6">
            <Field label="Cron Expression" htmlFor="cron" hint="e.g. `0 * * * *` = hourly">
              <Input
                id="cron"
                value={form.cronExpression}
                onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
              />
            </Field>

            <Field label="Refresh Mode" htmlFor="refreshMode">
              <Select
                id="refreshMode"
                value={form.refreshMode}
                onChange={(e) => setForm({ ...form, refreshMode: e.target.value as RefreshMode })}
              >
                <option value="PAGES">PAGES</option>
                <option value="DUPLICATES">DUPLICATES</option>
              </Select>
            </Field>

            <Field
              label="Max Pages"
              htmlFor="maxPages"
              hint="Used when mode = PAGES (1-100)"
            >
              <Input
                id="maxPages"
                type="number"
                min={1}
                max={100}
                disabled={form.refreshMode === 'DUPLICATES'}
                value={form.refreshMaxPages}
                onChange={(e) =>
                  setForm({ ...form, refreshMaxPages: Number(e.target.value) })
                }
              />
            </Field>

            <Field
              label="Max Consecutive Duplicates"
              htmlFor="maxDupes"
              hint="Used when mode = DUPLICATES (≥1)"
            >
              <Input
                id="maxDupes"
                type="number"
                min={1}
                disabled={form.refreshMode === 'PAGES'}
                value={form.refreshMaxConsecutiveDuplicates}
                onChange={(e) =>
                  setForm({
                    ...form,
                    refreshMaxConsecutiveDuplicates: Number(e.target.value),
                  })
                }
              />
            </Field>

            <div className="pt-2">
              <Button type="submit" disabled={!dirty} loading={isPending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/scrape' as never)({
  component: ScrapeSettingsPage,
});

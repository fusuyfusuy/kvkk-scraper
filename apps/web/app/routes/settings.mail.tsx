import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '../components/form/Button';
import { Field } from '../components/form/Field';
import { Input } from '../components/form/Input';
import { Textarea } from '../components/form/Textarea';
import { useSettings, useUpdateSettings, useSendTestEmail } from '../lib/queries';
import { useToast } from '../components/Toast';
import type { AppConfigPatch } from '@kvkk/shared';

interface FormState {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  recipientsText: string;
}

function parseRecipients(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function MailSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { mutateAsync: update, isPending: isSaving } = useUpdateSettings();
  const { mutateAsync: sendTest, isPending: isSendingTest } = useSendTestEmail();
  const toast = useToast();

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        smtpPass: '',
        smtpFrom: settings.smtpFrom,
        recipientsText: settings.notificationRecipients.join('\n'),
      });
    }
  }, [settings, form]);

  const dirty = useMemo(() => {
    if (!settings || !form) return false;
    const newRecipients = parseRecipients(form.recipientsText);
    const recipientsChanged =
      newRecipients.length !== settings.notificationRecipients.length ||
      newRecipients.some((r, i) => r !== settings.notificationRecipients[i]);
    return (
      form.smtpHost !== settings.smtpHost ||
      form.smtpPort !== settings.smtpPort ||
      form.smtpUser !== settings.smtpUser ||
      form.smtpPass.length > 0 ||
      form.smtpFrom !== settings.smtpFrom ||
      recipientsChanged
    );
  }, [settings, form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !dirty) return;
    const patch: AppConfigPatch = {
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpUser: form.smtpUser,
      smtpFrom: form.smtpFrom,
      notificationRecipients: parseRecipients(form.recipientsText),
    };
    if (form.smtpPass.length > 0) {
      patch.smtpPass = form.smtpPass;
    }
    try {
      await update(patch);
      setForm((prev) => (prev ? { ...prev, smtpPass: '' } : prev));
      toast.success('Mail settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  async function onSendTest() {
    const recipient = window.prompt('Recipient email for test message:');
    if (!recipient) return;
    try {
      await sendTest(recipient);
      toast.success(`Test email sent to ${recipient}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test email');
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Mail Config</h2>
      </div>

      <div className="p-8">
        {isLoading || !form ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <form onSubmit={onSubmit} className="max-w-xl space-y-5 bg-white rounded-lg shadow-sm p-6">
            <Field label="SMTP Host" htmlFor="smtpHost">
              <Input
                id="smtpHost"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              />
            </Field>

            <Field label="SMTP Port" htmlFor="smtpPort">
              <Input
                id="smtpPort"
                type="number"
                min={1}
                max={65535}
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
              />
            </Field>

            <Field label="SMTP User" htmlFor="smtpUser">
              <Input
                id="smtpUser"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              />
            </Field>

            <Field
              label="SMTP Password"
              htmlFor="smtpPass"
              hint={`Password set: ${settings?.smtpPassSet ? 'yes' : 'no'}`}
            >
              <Input
                id="smtpPass"
                type="password"
                placeholder="leave blank to keep current"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
              />
            </Field>

            <Field label="From Address" htmlFor="smtpFrom">
              <Input
                id="smtpFrom"
                type="email"
                value={form.smtpFrom}
                onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })}
              />
            </Field>

            <Field
              label="Notification Recipients"
              htmlFor="recipients"
              hint="One email address per line"
            >
              <Textarea
                id="recipients"
                rows={5}
                value={form.recipientsText}
                onChange={(e) => setForm({ ...form, recipientsText: e.target.value })}
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={!dirty} loading={isSaving}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onSendTest}
                loading={isSendingTest}
              >
                Send test email
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/mail' as never)({
  component: MailSettingsPage,
});

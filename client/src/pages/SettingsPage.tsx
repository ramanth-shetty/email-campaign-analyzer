import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(6, 'Min 6 characters'),
});

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'profile' | 'security' | 'integrations'>('profile');

  const { register: rp, handleSubmit: hp, formState: { errors: ep, isSubmitting: isp } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  const { register: rs, handleSubmit: hs, formState: { errors: es, isSubmitting: iss }, reset: resetPwd } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const { mutate: saveProfile } = useMutation({
    mutationFn: (data: ProfileData) => api.patch('/api/users/me', data).then((r) => r.data),
    onSuccess: (updated) => {
      updateUser({ name: updated.name, email: updated.email });
      toast.success('Profile updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Update failed'),
  });

  const { mutate: changePassword } = useMutation({
    mutationFn: (data: PasswordData) => api.patch('/api/users/me/password', data),
    onSuccess: () => { toast.success('Password changed'); resetPwd(); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Password change failed'),
  });

  const { data: mcStatus } = useQuery({
    queryKey: ['mailchimpStatus'],
    queryFn: () => api.get('/api/integrations/mailchimp/status').then((r) => r.data),
  });

  const { mutate: disconnectMailchimp, isPending: disconnecting } = useMutation({
    mutationFn: () => api.delete('/api/integrations/mailchimp'),
    onSuccess: () => {
      toast.success('Mailchimp disconnected');
      qc.invalidateQueries({ queryKey: ['mailchimpStatus'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Disconnect failed'),
  });

  const TAB_CLASS = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      <div className="flex border-b border-gray-200">
        <button className={TAB_CLASS('profile')} onClick={() => setTab('profile')}>Profile</button>
        <button className={TAB_CLASS('security')} onClick={() => setTab('security')}>Security</button>
        <button className={TAB_CLASS('integrations')} onClick={() => setTab('integrations')}>Integrations</button>
      </div>

      {tab === 'profile' && (
        <form onSubmit={hp((d) => saveProfile(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...rp('name')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            {ep.name && <p className="text-red-500 text-xs mt-1">{ep.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input {...rp('email')} type="email" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            {ep.email && <p className="text-red-500 text-xs mt-1">{ep.email.message}</p>}
          </div>
          <button type="submit" disabled={isp} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isp ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={hs((d) => changePassword(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input {...rs('currentPassword')} type="password" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            {es.currentPassword && <p className="text-red-500 text-xs mt-1">{es.currentPassword.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input {...rs('newPassword')} type="password" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            {es.newPassword && <p className="text-red-500 text-xs mt-1">{es.newPassword.message}</p>}
          </div>
          <button type="submit" disabled={iss} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
            {iss ? 'Updating…' : 'Change Password'}
          </button>
        </form>
      )}

      {tab === 'integrations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Mailchimp</p>
                {mcStatus?.lastSyncAt && (
                  <p className="text-xs text-gray-400 mt-0.5">Last synced: {new Date(mcStatus.lastSyncAt).toLocaleString()}</p>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                mcStatus?.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {mcStatus?.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {mcStatus?.connected ? (
              <button
                onClick={() => disconnectMailchimp()}
                disabled={disconnecting}
                className="mt-3 text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                To connect Mailchimp, add your API key on the Campaigns page.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
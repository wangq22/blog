import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  adminFetchUserProfile,
  adminUpdateUserProfile,
  type UserProfileUpdate,
} from '../../lib/adminApi';
import { resolveProfileImage, type UserProfile } from '../../lib/api';
import AdminIcon from './AdminIcon';

interface ProfileForm {
  name: string;
  bio: string;
  avatar_url: string;
  serious_avatar_url: string;
  casual_bio: string;
  github_url: string;
  bilibili_url: string;
  timezone: string;
  city: string;
  email: string;
  affiliation: string;
}

function toForm(profile: UserProfile): ProfileForm {
  return {
    name: profile.name ?? '',
    bio: profile.bio ?? '',
    avatar_url: profile.avatar_url ?? '',
    serious_avatar_url: profile.serious_avatar_url ?? '',
    casual_bio: profile.casual_bio ?? '',
    github_url: profile.github_url ?? '',
    bilibili_url: profile.bilibili_url ?? '',
    timezone: profile.timezone ?? '',
    city: profile.city ?? '',
    email: profile.email ?? '',
    affiliation: profile.affiliation ?? '',
  };
}

function FieldLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  return (
    <span className="mb-2 flex items-center justify-between text-sm font-medium">
      <span>{children}</span>
      {optional && <span className="text-[0.68rem] font-normal uppercase tracking-wider text-base-content/35">Optional</span>}
    </span>
  );
}

export default function ProfileEditApp() {
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [previewMode, setPreviewMode] = useState<'serious' | 'casual'>('serious');

  useEffect(() => {
    adminFetchUserProfile()
      .then((user) => setProfile(toForm(user)))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field: keyof ProfileForm, value: string) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
    if (field === 'avatar_url' || field === 'serious_avatar_url') setAvatarError(false);
    setError('');
    setNote('');
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const name = profile.name.trim();
    const email = profile.email.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const payload: UserProfileUpdate = Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [key, value.trim()]),
    ) as UserProfileUpdate;

    setSaving(true);
    setError('');
    setNote('');
    try {
      await adminUpdateUserProfile({ ...payload, name });
      setProfile((current) => (current ? { ...current, name, email } : current));
      setNote('Profile saved. Public pages will rebuild automatically.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" aria-label="Loading profile">
        <div className="space-y-4">
          <span className="skeleton block h-10 w-56 bg-base-200" />
          <span className="skeleton block h-72 w-full bg-base-200" />
        </div>
        <span className="skeleton block h-96 w-full bg-base-200" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 px-6 py-12 text-center">
        <p className="font-medium">Profile unavailable</p>
        <p className="mt-2 text-sm text-error">{error}</p>
      </div>
    );
  }

  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CC';
  const previewAvatar = resolveProfileImage(
    previewMode === 'serious' ? profile.serious_avatar_url : profile.avatar_url,
    '',
  );
  const previewBio = previewMode === 'serious'
    ? profile.bio
    : profile.casual_bio || profile.bio;

  return (
    <div className="pb-8">
      <header className="flex flex-col gap-6 border-b border-base-300 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Public identity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Profile details</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-base-content/55">
            Keep the byline, About page, and sidebar introduction feeling personal and current.
          </p>
        </div>
        <a className="btn btn-ghost" href="/about/">
          View About page
          <AdminIcon name="external" className="h-4 w-4" />
        </a>
      </header>

      <form className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={saveProfile}>
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm" aria-labelledby="identity-heading">
            <div className="border-b border-base-300 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><AdminIcon name="user" className="h-4 w-4" /></span>
                <div>
                  <h2 id="identity-heading" className="font-semibold">Identity</h2>
                  <p className="text-xs text-base-content/45">The essentials visitors see first.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className="block">
                <FieldLabel>Name</FieldLabel>
                <input className="input input-bordered w-full" value={profile.name} onChange={(event) => setField('name', event.target.value)} autoComplete="name" required />
              </label>
              <label className="block">
                <FieldLabel optional>Email</FieldLabel>
                <input className="input input-bordered w-full" type="email" value={profile.email} onChange={(event) => setField('email', event.target.value)} autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel optional>Affiliation</FieldLabel>
                <input className="input input-bordered w-full" value={profile.affiliation} onChange={(event) => setField('affiliation', event.target.value)} placeholder="Company, university, or organization" />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Serious mode bio / Description</FieldLabel>
                <textarea className="textarea textarea-bordered min-h-36 w-full leading-relaxed" value={profile.bio} onChange={(event) => setField('bio', event.target.value)} placeholder="A short introduction" maxLength={500} />
                <span className="mt-1.5 block text-right text-xs tabular-nums text-base-content/35">{profile.bio.length}/500</span>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel optional>Casual mode bio</FieldLabel>
                <textarea className="textarea textarea-bordered min-h-28 w-full leading-relaxed" value={profile.casual_bio} onChange={(event) => setField('casual_bio', event.target.value)} placeholder="A more personal introduction for casual mode" maxLength={500} />
                <span className="mt-1.5 block text-right text-xs tabular-nums text-base-content/35">{profile.casual_bio.length}/500</span>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm" aria-labelledby="details-heading">
            <div className="border-b border-base-300 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info"><AdminIcon name="location" className="h-4 w-4" /></span>
                <div>
                  <h2 id="details-heading" className="font-semibold">Location &amp; presence</h2>
                  <p className="text-xs text-base-content/45">Context and destinations around the web.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className="block">
                <FieldLabel optional>City</FieldLabel>
                <input className="input input-bordered w-full" value={profile.city} onChange={(event) => setField('city', event.target.value)} placeholder="Detroit, USA" autoComplete="address-level2" />
              </label>
              <label className="block">
                <FieldLabel optional>Timezone</FieldLabel>
                <input className="input input-bordered w-full" value={profile.timezone} onChange={(event) => setField('timezone', event.target.value)} placeholder="America/Detroit" aria-describedby="timezone-help" />
                <span id="timezone-help" className="mt-1.5 block text-xs text-base-content/40">Use an IANA timezone value.</span>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel optional>Serious mode photo (R2 URL or key)</FieldLabel>
                <input className="input input-bordered w-full" value={profile.serious_avatar_url} onChange={(event) => setField('serious_avatar_url', event.target.value)} placeholder="https://…/api/media/covers/photo.jpg or covers/photo.jpg" aria-describedby="serious-avatar-help" />
                <span id="serious-avatar-help" className="mt-1.5 block text-xs leading-5 text-base-content/40">For an R2 image, paste its Worker media URL or key such as covers/your-photo.jpg.</span>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel optional>Casual mode avatar URL</FieldLabel>
                <input className="input input-bordered w-full" type="url" value={profile.avatar_url} onChange={(event) => setField('avatar_url', event.target.value)} placeholder="https://…" />
              </label>
              <label className="block">
                <FieldLabel optional>GitHub URL</FieldLabel>
                <input className="input input-bordered w-full" type="url" value={profile.github_url} onChange={(event) => setField('github_url', event.target.value)} placeholder="https://github.com/…" />
              </label>
              <label className="block">
                <FieldLabel optional>Bilibili URL</FieldLabel>
                <input className="input input-bordered w-full" type="url" value={profile.bilibili_url} onChange={(event) => setField('bilibili_url', event.target.value)} placeholder="https://space.bilibili.com/…" />
              </label>
            </div>
          </section>

          {(error || note) && (
            <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${error ? 'border-error/20 bg-error/5 text-error' : 'border-success/20 bg-success/5 text-success'}`} role="status">
              <AdminIcon name={error ? 'sparkles' : 'check'} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || note}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-5">
            <a href="/admin/" className="btn btn-ghost"><AdminIcon name="arrow-left" className="h-4 w-4" />Dashboard</a>
            <button className="btn btn-primary min-w-36" type="submit" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : <AdminIcon name="check" className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24" aria-label="Live profile preview">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/40">Live preview</p>
          <div className="join mb-3 w-full" role="group" aria-label="Preview profile mode">
            <button type="button" className={`btn btn-sm join-item flex-1 ${previewMode === 'serious' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={previewMode === 'serious'} onClick={() => { setPreviewMode('serious'); setAvatarError(false); }}>Serious</button>
            <button type="button" className={`btn btn-sm join-item flex-1 ${previewMode === 'casual' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={previewMode === 'casual'} onClick={() => { setPreviewMode('casual'); setAvatarError(false); }}>Casual</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral/10 bg-neutral text-neutral-content shadow-sm">
            <div className="h-1 bg-primary" />
            <div className="p-6">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-neutral-content/10 bg-neutral-content/10 text-xl font-semibold">
                {previewAvatar && !avatarError ? (
                  <img src={previewAvatar} alt="" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
                ) : initials}
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{profile.name || 'Your name'}</h2>
              {profile.affiliation && <p className="mt-1 text-sm text-neutral-content/50">{profile.affiliation}</p>}
              <p className="mt-4 text-sm leading-6 text-neutral-content/65">{previewBio || 'Your short introduction will appear here.'}</p>
              {previewMode === 'casual' && profile.bilibili_url && <a href={profile.bilibili_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-info btn-soft mt-3">Bilibili</a>}
              {(profile.city || profile.timezone) && (
                <div className="mt-5 border-t border-neutral-content/10 pt-4 text-xs text-neutral-content/50">
                  {profile.city && <p className="flex items-center gap-2"><AdminIcon name="location" className="h-3.5 w-3.5" />{profile.city}</p>}
                  {profile.timezone && <p className="mt-2 flex items-center gap-2"><AdminIcon name="clock" className="h-3.5 w-3.5" />{profile.timezone}</p>}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-base-content/40">Preview updates as you type. Save to publish your changes.</p>
        </aside>
      </form>
    </div>
  );
}

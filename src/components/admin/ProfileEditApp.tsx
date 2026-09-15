import { useEffect, useState, type FormEvent } from 'react';
import {
  adminFetchUserProfile,
  adminUpdateUserProfile,
  type UserProfileUpdate,
} from '../../lib/adminApi';
import type { UserProfile } from '../../lib/api';

interface ProfileForm {
  name: string;
  bio: string;
  avatar_url: string;
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
    github_url: profile.github_url ?? '',
    bilibili_url: profile.bilibili_url ?? '',
    timezone: profile.timezone ?? '',
    city: profile.city ?? '',
    email: profile.email ?? '',
    affiliation: profile.affiliation ?? '',
  };
}

export default function ProfileEditApp() {
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    adminFetchUserProfile()
      .then((user) => setProfile(toForm(user)))
      .catch((e: any) => setError(e?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field: keyof ProfileForm, value: string) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
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
      setNote('Saved. Public pages will rebuild automatically.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="opacity-60">Loading profile…</p>;
  if (!profile) return <p className="text-error">{error || 'Profile unavailable.'}</p>;

  return (
    <section className="card bg-base-100 shadow">
      <div className="card-body">
        <h1 className="card-title text-2xl">Profile</h1>
        <p className="text-sm opacity-70">
          These details appear in the sidebar and on the About page. Empty fields stay hidden.
        </p>

        <form className="mt-2 space-y-5" onSubmit={saveProfile}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="fieldset">
              <span className="fieldset-legend">Name</span>
              <input
                className="input w-full"
                value={profile.name}
                onChange={(event) => setField('name', event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="fieldset">
              <span className="fieldset-legend">Email</span>
              <input
                className="input w-full"
                type="email"
                value={profile.email}
                onChange={(event) => setField('email', event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="fieldset">
              <span className="fieldset-legend">City</span>
              <input
                className="input w-full"
                value={profile.city}
                onChange={(event) => setField('city', event.target.value)}
                placeholder="Shanghai, China"
                autoComplete="address-level2"
              />
            </label>
            <label className="fieldset">
              <span className="fieldset-legend">Timezone</span>
              <input
                className="input w-full"
                value={profile.timezone}
                onChange={(event) => setField('timezone', event.target.value)}
                placeholder="Asia/Shanghai"
                aria-describedby="timezone-help"
              />
              <span id="timezone-help" className="label text-xs opacity-60">
                Prefer an IANA value, such as America/Detroit.
              </span>
            </label>
            <label className="fieldset md:col-span-2">
              <span className="fieldset-legend">Affiliation</span>
              <input
                className="input w-full"
                value={profile.affiliation}
                onChange={(event) => setField('affiliation', event.target.value)}
                placeholder="Company, university, or organization"
              />
            </label>
            <label className="fieldset md:col-span-2">
              <span className="fieldset-legend">Bio / Description</span>
              <textarea
                className="textarea min-h-32 w-full"
                value={profile.bio}
                onChange={(event) => setField('bio', event.target.value)}
                placeholder="A short introduction"
              />
            </label>
          </div>

          <details className="collapse collapse-arrow border border-base-300">
            <summary className="collapse-title font-medium">Existing links and avatar</summary>
            <div className="collapse-content grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="fieldset">
                <span className="fieldset-legend">Avatar URL</span>
                <input
                  className="input w-full"
                  type="url"
                  value={profile.avatar_url}
                  onChange={(event) => setField('avatar_url', event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="fieldset">
                <span className="fieldset-legend">GitHub URL</span>
                <input
                  className="input w-full"
                  type="url"
                  value={profile.github_url}
                  onChange={(event) => setField('github_url', event.target.value)}
                  placeholder="https://github.com/…"
                />
              </label>
              <label className="fieldset md:col-span-2">
                <span className="fieldset-legend">Bilibili URL</span>
                <input
                  className="input w-full"
                  type="url"
                  value={profile.bilibili_url}
                  onChange={(event) => setField('bilibili_url', event.target.value)}
                  placeholder="https://space.bilibili.com/…"
                />
              </label>
            </div>
          </details>

          {error && <p className="text-sm text-error">{error}</p>}
          {note && <p className="text-sm text-success">{note}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : null}
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <a className="btn btn-ghost" href="/about/">
              View About page
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}

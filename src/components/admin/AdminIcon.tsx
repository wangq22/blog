export type AdminIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'edit'
  | 'external'
  | 'file'
  | 'image'
  | 'link'
  | 'location'
  | 'plus'
  | 'search'
  | 'sparkles'
  | 'trash'
  | 'upload'
  | 'user';

export default function AdminIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: AdminIconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const paths: Record<AdminIconName, React.ReactNode> = {
    'arrow-left': <path d="M19 12H5m6 6-6-6 6-6" />,
    'arrow-right': <path d="M5 12h14m-6-6 6 6-6 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="M13.5 6.5l4 4M4 20l4.2-.9L19 6.3a2.8 2.8 0 0 0-4-4L4.9 12.4 4 20Z" /><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" /></>,
    external: <><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h4" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sparkles: <><path d="m12 3 1.1 3.3L16 8l-2.9 1.7L12 13l-1.1-3.3L8 8l2.9-1.7L12 3Z" /><path d="m19 14 .7 2.3L22 17.5l-2.3 1.2L19 21l-.7-2.3-2.3-1.2 2.3-1.2L19 14ZM5 12l.8 2.5L8 16l-2.2 1.5L5 20l-.8-2.5L2 16l2.2-1.5L5 12Z" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 15v5h16v-5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

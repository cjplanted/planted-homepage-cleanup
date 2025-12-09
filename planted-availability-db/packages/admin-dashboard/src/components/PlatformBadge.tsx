interface PlatformBadgeProps {
  platform: string;
  url?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  'uber-eats': '#06C167',
  'lieferando': '#FF8000',
  'wolt': '#00C2E8',
  'just-eat': '#FF5A00',
  'smood': '#E91E63',
  'deliveroo': '#00CCBC',
};

const PLATFORM_NAMES: Record<string, string> = {
  'uber-eats': 'Uber Eats',
  'lieferando': 'Lieferando',
  'wolt': 'Wolt',
  'just-eat': 'Just Eat',
  'smood': 'Smood',
  'deliveroo': 'Deliveroo',
};

function PlatformBadge({ platform, url }: PlatformBadgeProps) {
  const color = PLATFORM_COLORS[platform] || 'var(--text-light)';
  const name = PLATFORM_NAMES[platform] || platform;

  const badge = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#fff',
        background: color,
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {name}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none' }}
        title={`Open on ${name}`}
      >
        {badge}
      </a>
    );
  }

  return badge;
}

export default PlatformBadge;

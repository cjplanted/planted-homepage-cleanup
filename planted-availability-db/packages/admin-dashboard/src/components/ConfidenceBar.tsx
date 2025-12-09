interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function ConfidenceBar({ score, showLabel = true, size = 'md' }: ConfidenceBarProps) {
  const getColor = (s: number): string => {
    if (s >= 70) return 'var(--success)';
    if (s >= 40) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getHeight = (): string => {
    switch (size) {
      case 'sm': return '4px';
      case 'lg': return '12px';
      default: return '8px';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          flex: 1,
          height: getHeight(),
          background: 'var(--bg-light)',
          borderRadius: '4px',
          overflow: 'hidden',
          minWidth: '60px',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: getColor(score),
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: size === 'sm' ? '0.7rem' : '0.8rem',
            fontWeight: 600,
            color: getColor(score),
            minWidth: '35px',
          }}
        >
          {score}%
        </span>
      )}
    </div>
  );
}

export default ConfidenceBar;

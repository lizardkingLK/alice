import { ImageResponse } from 'next/og';
import { appSubtitle, appTitle } from '@/app/_shared/values';

const BRAND_GRADIENT = 'linear-gradient(135deg, #2db872 0%, #088242 100%)';

type BrandMarkProps = {
  readonly size: number;
  readonly radius?: number;
};

export function BrandMark({ size, radius }: BrandMarkProps) {
  const cornerRadius = radius ?? size * 0.22;
  const fontSize = size * 0.52;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_GRADIENT,
        borderRadius: cornerRadius,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1,
          marginTop: -size * 0.04,
        }}
      >
        A
      </div>
    </div>
  );
}

export function createBrandIconResponse(size: number) {
  return new ImageResponse(<BrandMark size={size} />, {
    width: size,
    height: size,
  });
}

export function createOpenGraphImageResponse() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background:
          'linear-gradient(135deg, #f4fbf7 0%, #e8f5ee 55%, #dff0e8 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <BrandMark size={160} radius={36} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1,
            }}
          >
            {appTitle}
          </div>
          <div
            style={{
              fontSize: 34,
              color: '#475569',
              lineHeight: 1.35,
              maxWidth: 720,
            }}
          >
            {appSubtitle}
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}

export type RouletteUvPocket = {
  number: number;
  index: number;
  centerDeg: number;
  textureStartDeg: number;
  textureEndDeg: number;
  manualScale: number;
  uvOffsetDeg: number;
};

export const ZERO_POCKET_REFERENCE_DEGREES = 0;
export const ROULETTE_ANISOTROPIC_FILTERING_LEVEL = 16;
export const ROULETTE_TEXEL_DENSITY = 2;
export const ROULETTE_MANUAL_UV_SCALE = 0.985;

export function buildRouletteUvMap(
  wheel: number[],
  sectorDegrees: number,
  uvOffsetDegrees = 0,
): RouletteUvPocket[] {
  return wheel.map((number, index) => {
    const centerDeg = ZERO_POCKET_REFERENCE_DEGREES + index * sectorDegrees;
    return {
      number,
      index,
      centerDeg,
      textureStartDeg: index * sectorDegrees,
      textureEndDeg: (index + 1) * sectorDegrees,
      manualScale: ROULETTE_MANUAL_UV_SCALE,
      uvOffsetDeg: uvOffsetDegrees,
    };
  });
}

export function buildLockedPocketGradient({
  pockets,
  sectorDegrees,
  colorForNumber,
}: {
  pockets: RouletteUvPocket[];
  sectorDegrees: number;
  colorForNumber: (number: number) => string;
}) {
  const zeroPocketStartOffset = -(sectorDegrees / 2);
  return `conic-gradient(from calc(var(--wheel-uv-offset, 0deg) + ${zeroPocketStartOffset.toFixed(6)}deg), ${pockets
    .map(
      (pocket) =>
        `${colorForNumber(pocket.number)} ${pocket.textureStartDeg.toFixed(6)}deg ${pocket.textureEndDeg.toFixed(6)}deg`,
    )
    .join(", ")})`;
}

export function pocketCenterForNumber(
  pockets: RouletteUvPocket[],
  winningNumber: number,
) {
  return pockets.find((pocket) => pocket.number === winningNumber)?.centerDeg ?? 0;
}

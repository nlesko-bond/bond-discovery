const HEX_RGB_LENGTH = 6;
const HEX_CHANNEL_LENGTH = 2;
const RGB_MAX_CHANNEL = 255;
const HUE_FULL_ROTATION_DEG = 360;
const PERCENT_SCALE = 100;
const HSL_LIGHTNESS_MIDPOINT = 0.5;

interface IRgb {
  r: number;
  g: number;
  b: number;
}

interface IHsl {
  h: number;
  s: number;
  l: number;
}

function parseHexRgb(hex: string): IRgb | null {
  const normalized = hex.replace('#', '').trim();
  const rgbPart =
    normalized.length === HEX_RGB_LENGTH
      ? normalized
      : normalized.length === HEX_RGB_LENGTH + 2
        ? normalized.slice(0, HEX_RGB_LENGTH)
        : null;

  if (!rgbPart) {
    return null;
  }

  const r = Number.parseInt(rgbPart.slice(0, HEX_CHANNEL_LENGTH), 16);
  const g = Number.parseInt(rgbPart.slice(HEX_CHANNEL_LENGTH, HEX_CHANNEL_LENGTH * 2), 16);
  const b = Number.parseInt(rgbPart.slice(HEX_CHANNEL_LENGTH * 2, HEX_RGB_LENGTH), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
}

function rgbToHsl({ r, g, b }: IRgb): IHsl {
  const red = r / RGB_MAX_CHANNEL;
  const green = g / RGB_MAX_CHANNEL;
  const blue = b / RGB_MAX_CHANNEL;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation =
      lightness > HSL_LIGHTNESS_MIDPOINT
        ? delta / (2 - max - min)
        : delta / (max + min);

    if (max === red) {
      hue = ((green - blue) / delta + (green < blue ? HUE_FULL_ROTATION_DEG : 0)) / 6;
    } else if (max === green) {
      hue = ((blue - red) / delta + 2) / 6;
    } else {
      hue = ((red - green) / delta + 4) / 6;
    }
  }

  return {
    h: hue * HUE_FULL_ROTATION_DEG,
    s: saturation * PERCENT_SCALE,
    l: lightness * PERCENT_SCALE,
  };
}

function hslToHex({ h, s, l }: IHsl): string {
  const hue = ((h % HUE_FULL_ROTATION_DEG) + HUE_FULL_ROTATION_DEG) % HUE_FULL_ROTATION_DEG;
  const saturation = s / PERCENT_SCALE;
  const lightness = l / PERCENT_SCALE;

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondComponent;
  } else if (huePrime < 2) {
    red = secondComponent;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (huePrime < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (huePrime < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  const match = lightness - chroma / 2;
  const toChannel = (channel: number) =>
    Math.round((channel + match) * RGB_MAX_CHANNEL)
      .toString(16)
      .padStart(HEX_CHANNEL_LENGTH, '0');

  return `#${toChannel(red)}${toChannel(green)}${toChannel(blue)}`;
}

/**
 * Shifts a hex color's hue while preserving saturation and lightness.
 */
export function shiftHexHue(hex: string, degrees: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) {
    return hex;
  }
  const hsl = rgbToHsl(rgb);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

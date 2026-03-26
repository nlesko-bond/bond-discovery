/** Short, low-key copy shown after each step is marked complete (not distracting). */
const REQUIRED: string[] = [
  'Nice — momentum builds fast.',
  'One down. The rest gets easier.',
  'That’s a real checkbox, not a participation trophy.',
  'Progress looks good on you.',
  'Small step, big setup energy.',
  'You’re stacking wins.',
  'Chef’s kiss. Next.',
  'Ticked. Your future self says thanks.',
  'Solid. Keep that rhythm.',
  'Another brick in the Bond wall.',
];

const OPTIONAL: string[] = [
  'Extra credit unlocked.',
  'Going above — we see you.',
  'Optional but appreciated.',
  'Nice polish on the setup.',
];

export function getStepEncouragement(stepIndex: number, optional: boolean): string {
  const pool = optional ? OPTIONAL : REQUIRED;
  return pool[stepIndex % pool.length];
}

export async function fireOnboardingConfetti(): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  const confetti = (await import('canvas-confetti')).default;
  const count = 120;
  const defaults = {
    origin: { y: 0.65 },
    zIndex: 9999,
  };

  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.35),
    spread: 55,
    startVelocity: 35,
    scalar: 0.9,
  });

  await new Promise((r) => setTimeout(r, 120));
  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.45),
    spread: 80,
    startVelocity: 28,
    scalar: 1,
  });

  await new Promise((r) => setTimeout(r, 150));
  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.2),
    spread: 100,
    startVelocity: 22,
    scalar: 1.05,
    ticks: 200,
  });
}

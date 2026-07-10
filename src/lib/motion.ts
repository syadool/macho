export const SPRING_STANDARD = { type: "spring" as const, bounce: 0, duration: 0.35 };
export const REDUCED_MOTION_TRANSITION = { duration: 0.2 };

export function transitionFor(reduced: boolean) {
  return reduced ? REDUCED_MOTION_TRANSITION : SPRING_STANDARD;
}

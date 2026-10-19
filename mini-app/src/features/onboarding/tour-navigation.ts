export function nextTourIndex(steps: readonly { target: string }[], current: number, direction: 1 | -1, excluded: readonly string[]): number | null {
  for (let index = current + direction; index >= 0 && index < steps.length; index += direction) {
    if (!excluded.includes(steps[index].target)) return index;
  }
  return null;
}

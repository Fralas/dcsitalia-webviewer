/**
 * Merge class names (shadcn-compatible helper).
 */
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

// Score marks, Golf GameBook style: red circle for a birdie (with a second ring for
// an eagle or better), nothing for par, light blue square for a bogey, navy square
// for a double bogey or worse. Colour and shape only; callers set the size.
export function markClass(toPar: number | null): string {
  if (toPar === null || toPar === 0) return "";
  if (toPar <= -2)
    return "rounded-full bg-birdie text-on-birdie font-bold ring-2 ring-birdie ring-offset-2 ring-offset-card";
  if (toPar === -1) return "rounded-full bg-birdie text-on-birdie font-bold";
  if (toPar === 1) return "rounded-none bg-bogey text-on-bogey font-semibold";
  return "rounded-none bg-double text-on-double font-semibold";
}

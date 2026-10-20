import { useState } from "react";
import type { DayCount } from "../../services/admin.service";

const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });

/** A clean number for the top gridline (1, 2, 5, 10, 20, 50, ...). */
const niceMax = (n: number) => {
  if (n <= 4) return Math.max(n, 1);
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= n) ?? n;
};

/** 30-day single-series column chart with a hover/focus tooltip per day. */
const ColumnChart = ({ title, data, total }: { title: string; data: DayCount[]; total?: string }) => {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const sum = data.reduce((s, d) => s + d.count, 0);
  const shown = active !== null ? data[active] : null;

  return (
    <figure className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        <span className="text-xs text-zinc-500">{total ?? `${sum.toLocaleString()} in 30 days`}</span>
      </figcaption>

      <div className="relative h-36 pl-7" onMouseLeave={() => setActive(null)}>
        {/* Recessive grid: 0, half, max */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute left-7 right-0 border-t border-white/[0.06]" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-7 -translate-y-1/2 text-[10px] tabular-nums text-zinc-600">
              {Math.round(max * f)}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 left-7 flex items-end gap-0.5">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${fmtDay(d.day)}: ${d.count}`}
              className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
            >
              <span
                className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${
                  active === i ? "bg-teal-300" : "bg-teal-500/80 group-focus-visible:bg-teal-300"
                }`}
                style={{ height: d.count ? `max(${(d.count / max) * 100}%, 3px)` : 0 }}
              />
            </button>
          ))}
        </div>

        {shown && active !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs shadow-lg"
            style={{ left: `calc(1.75rem + (100% - 1.75rem) * ${(active + 0.5) / data.length})` }}
          >
            <span className="text-zinc-400">{fmtDay(shown.day, { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="ml-2 font-semibold tabular-nums text-white">{shown.count}</span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex justify-between pl-7 text-[10px] text-zinc-600">
        <span>{data[0] && fmtDay(data[0].day)}</span>
        <span>Today</span>
      </div>

      {/* Same numbers for screen readers */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

export default ColumnChart;

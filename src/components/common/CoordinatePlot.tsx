"use client";

export type PlotPoint = {
  x: number;
  y: number | null | undefined;
};

export type PlotSeries = {
  id: string;
  label: string;
  color: string;
  points: PlotPoint[];
  width?: number;
  dashed?: boolean;
  fillToZero?: boolean;
};

export type PlotMarker = {
  id: string;
  x: number;
  y: number | null | undefined;
  color: string;
  label?: string;
  radius?: number;
  shape?: "circle" | "diamond";
};

type CoordinatePlotProps = {
  ariaLabel: string;
  emptyMessage: string;
  height?: number;
  series: PlotSeries[];
  markers?: PlotMarker[];
  includeZeroY?: boolean;
  includeZeroX?: boolean;
};

const WIDTH = 760;
const MARGIN = {
  top: 20,
  right: 18,
  bottom: 42,
  left: 58,
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function expandRange(min: number, max: number, ratio: number) {
  if (min === max) {
    const fallback = Math.max(Math.abs(min), 1);
    return { min: min - fallback * 0.5, max: max + fallback * 0.5 };
  }

  const span = max - min;
  return { min: min - span * ratio, max: max + span * ratio };
}

function niceStep(range: number, targetCount: number) {
  const rough = Math.max(range / Math.max(targetCount - 1, 1), Number.EPSILON);
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;

  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

function makeTicks(min: number, max: number, targetCount = 6) {
  const step = niceStep(max - min, targetCount);
  const start = Math.ceil(min / step) * step;
  const end = Math.floor(max / step) * step;
  const ticks: number[] = [];

  for (let value = start; value <= end + step * 0.25; value += step) {
    ticks.push(Number(value.toPrecision(12)));
    if (ticks.length > 12) break;
  }

  if (ticks.length < 2) return [min, max];
  return ticks;
}

function formatTick(value: number) {
  if (Math.abs(value) < 1e-10) return "0";
  const abs = Math.abs(value);
  if (abs >= 10000 || abs < 0.001) return value.toExponential(1);
  return value
    .toFixed(abs >= 100 ? 0 : abs >= 10 ? 1 : 2)
    .replace(/\.?0+$/, "");
}

function buildPath(
  points: PlotPoint[],
  xScale: (x: number) => number,
  yScale: (y: number) => number,
  plotHeight: number
) {
  let path = "";
  let previous: { x: number; y: number; py: number } | null = null;

  for (const point of points) {
    if (!Number.isFinite(point.x) || !isFiniteNumber(point.y)) {
      previous = null;
      continue;
    }

    const px = xScale(point.x);
    const py = yScale(point.y);
    const command =
      previous === null || Math.abs(py - previous.py) > plotHeight * 2.4 ? "M" : "L";

    path += `${command}${px.toFixed(2)} ${py.toFixed(2)} `;
    previous = { x: point.x, y: point.y, py };
  }

  return path.trim();
}

function buildAreaPaths(
  points: PlotPoint[],
  xScale: (x: number) => number,
  yScale: (y: number) => number,
  plotHeight: number
) {
  const paths: string[] = [];
  let segment: Array<{ x: number; y: number; px: number; py: number }> = [];

  const closeSegment = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }

    const baseline = yScale(0);
    const first = segment[0];
    const last = segment[segment.length - 1];
    const line = segment.map((point) => `L${point.px.toFixed(2)} ${point.py.toFixed(2)}`).join(" ");
    paths.push(
      `M${first.px.toFixed(2)} ${baseline.toFixed(2)} ${line} L${last.px.toFixed(2)} ${baseline.toFixed(2)} Z`
    );
    segment = [];
  };

  for (const point of points) {
    if (!Number.isFinite(point.x) || !isFiniteNumber(point.y)) {
      closeSegment();
      continue;
    }

    const px = xScale(point.x);
    const py = yScale(point.y);
    const previous = segment[segment.length - 1];
    if (previous && Math.abs(py - previous.py) > plotHeight * 2.4) {
      closeSegment();
    }
    segment.push({ x: point.x, y: point.y, px, py });
  }

  closeSegment();
  return paths;
}

export function CoordinatePlot({
  ariaLabel,
  emptyMessage,
  height = 300,
  series,
  markers = [],
  includeZeroY = false,
  includeZeroX = false,
}: CoordinatePlotProps) {
  const validSeriesPoints = series.flatMap((item) =>
    item.points.filter((point) => Number.isFinite(point.x) && isFiniteNumber(point.y))
  ) as Array<{ x: number; y: number }>;
  const validMarkers = markers.filter((point) => Number.isFinite(point.x) && isFiniteNumber(point.y)) as Array<
    PlotMarker & { y: number }
  >;
  const allPoints = [...validSeriesPoints, ...validMarkers];

  if (allPoints.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const rawMinX = Math.min(...allPoints.map((point) => point.x), includeZeroX ? 0 : Infinity);
  const rawMaxX = Math.max(...allPoints.map((point) => point.x), includeZeroX ? 0 : -Infinity);
  const rawMinY = Math.min(...allPoints.map((point) => point.y), includeZeroY ? 0 : Infinity);
  const rawMaxY = Math.max(...allPoints.map((point) => point.y), includeZeroY ? 0 : -Infinity);
  const xRange = expandRange(rawMinX, rawMaxX, 0.04);
  const yRange = expandRange(rawMinY, rawMaxY, 0.12);
  const xTicks = makeTicks(xRange.min, xRange.max, 7);
  const yTicks = makeTicks(yRange.min, yRange.max, 6);
  const xScale = (x: number) => MARGIN.left + ((x - xRange.min) / (xRange.max - xRange.min)) * plotWidth;
  const yScale = (y: number) =>
    MARGIN.top + plotHeight - ((y - yRange.min) / (yRange.max - yRange.min)) * plotHeight;
  const zeroX = xScale(0);
  const zeroY = yScale(0);
  const hasZeroX = zeroX >= MARGIN.left && zeroX <= MARGIN.left + plotWidth;
  const hasZeroY = zeroY >= MARGIN.top && zeroY <= MARGIN.top + plotHeight;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full"
        style={{ height }}
      >
        <rect width={WIDTH} height={height} fill="#fffaf4" />
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          fill="#fffdf8"
          stroke="#e2e8f0"
        />
        {xTicks.map((tick) => {
          const x = xScale(tick);
          return (
            <g key={`x-grid-${tick}`}>
              <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + plotHeight} stroke="#e2e8f0" />
              <line
                x1={x}
                y1={MARGIN.top + plotHeight}
                x2={x}
                y2={MARGIN.top + plotHeight + 5}
                stroke="#94a3b8"
              />
              <text x={x} y={height - 18} textAnchor="middle" fontSize="10" fill="#64748b">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={`y-grid-${tick}`}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + plotWidth} y2={y} stroke="#e2e8f0" />
              <line x1={MARGIN.left - 5} y1={y} x2={MARGIN.left} y2={y} stroke="#94a3b8" />
              <text x={MARGIN.left - 9} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}
        {hasZeroY ? (
          <line
            x1={MARGIN.left}
            y1={zeroY}
            x2={MARGIN.left + plotWidth}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth="1.3"
          />
        ) : null}
        {hasZeroX ? (
          <line
            x1={zeroX}
            y1={MARGIN.top}
            x2={zeroX}
            y2={MARGIN.top + plotHeight}
            stroke="#94a3b8"
            strokeWidth="1.3"
          />
        ) : null}
        <text x={MARGIN.left + plotWidth + 8} y={hasZeroY ? zeroY - 5 : MARGIN.top + plotHeight - 4} fontSize="11" fill="#475569">
          x
        </text>
        <text x={hasZeroX ? zeroX + 6 : MARGIN.left + 6} y={MARGIN.top + 12} fontSize="11" fill="#475569">
          y
        </text>
        {series.flatMap((item) =>
          item.fillToZero
            ? buildAreaPaths(item.points, xScale, yScale, plotHeight).map((path, index) => (
                <path key={`${item.id}-area-${index}`} d={path} fill={item.color} opacity="0.18" />
              ))
            : []
        )}
        {series.map((item) => {
          const path = buildPath(item.points, xScale, yScale, plotHeight);
          return path ? (
            <path
              key={item.id}
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width ?? 2.4}
              strokeDasharray={item.dashed ? "8 5" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null;
        })}
        {validMarkers.map((point) => {
          const cx = xScale(point.x);
          const cy = yScale(point.y);
          const radius = point.radius ?? 4;
          return (
            <g key={point.id}>
              {point.shape === "diamond" ? (
                <rect
                  x={cx - radius}
                  y={cy - radius}
                  width={radius * 2}
                  height={radius * 2}
                  fill={point.color}
                  stroke="#fff"
                  strokeWidth="1.2"
                  transform={`rotate(45 ${cx} ${cy})`}
                />
              ) : (
                <circle cx={cx} cy={cy} r={radius} fill={point.color} stroke="#fff" strokeWidth="1.2" />
              )}
              {point.label ? (
                <text x={cx + 7} y={cy - 7} fill="#475569" fontSize="10">
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {series.length > 1 ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          {series.map((item) => (
            <div key={`legend-${item.id}`} className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

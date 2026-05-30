export type ApproximationMethod =
  | "lagrange"
  | "newton"
  | "piecewiseLinear"
  | "leastSquaresPolynomial"
  | "cubicSpline"
  | "hermite";

export type DataPoint = {
  x: number;
  y: number;
  derivative?: number;
};

export type SplineSegment = {
  interval: [number, number];
  a: number;
  b: number;
  c: number;
  d: number;
};

export type ApproximationResidual = {
  x: number;
  y: number;
  predicted: number;
  residual: number;
};

export type ApproximationMetrics = {
  sse: number;
  mse: number;
  rmse: number;
  r2: number | null;
};

export type ApproximationSample = {
  x: number;
  y: number | null;
};

export type CurveSeries = {
  label: string;
  color: string;
  samples: ApproximationSample[];
  dashed?: boolean;
};

export type FunctionExperimentKind =
  | "currentNodes"
  | "rungeCompare"
  | "chebyshevCompare"
  | "continuousLeastSquares"
  | "remez";

export type FunctionExperimentMetric = {
  label: string;
  maxError: number;
  rmsError?: number;
};

export type FunctionExperimentResult = {
  kind: FunctionExperimentKind;
  title: string;
  expression: string;
  interval: [number, number];
  nodes: DataPoint[];
  series: CurveSeries[];
  metrics: FunctionExperimentMetric[];
  summary: string;
  coefficients?: number[];
  exchangePoints?: number[];
};

export type ApproximationResult = {
  method: ApproximationMethod;
  expression: string;
  points: DataPoint[];
  powerCoefficients?: number[];
  dividedDifferenceTable?: Array<Array<number | null>>;
  normalMatrix?: number[][];
  splineSegments?: SplineSegment[];
  residuals: ApproximationResidual[];
  metrics: ApproximationMetrics;
  query: Array<{ x: number; y: number | null }>;
  samples: ApproximationSample[];
  message?: string;
};

export type ApproximationOptions = {
  method: ApproximationMethod;
  points: DataPoint[];
  degree?: number;
  queryX?: number[];
};

export type FunctionExperimentOptions = {
  kind: FunctionExperimentKind;
  functionExpression: string;
  intervalStart: number;
  intervalEnd: number;
  points?: DataPoint[];
  degree?: number;
  parts?: number;
  chebyshevCount?: number;
  sampleCount?: number;
};

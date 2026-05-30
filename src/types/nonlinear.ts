export type RootMethod =
  | "fixedPoint"
  | "steffensen"
  | "newton"
  | "dampedNewton"
  | "bisection"
  | "secant";

export type RootIterationRecord = {
  iteration: number;
  x: number;
  fx: number;
  error: number | null;
  lambda?: number;
  interval?: [number, number];
};

export type RootSolveResult = {
  method: RootMethod;
  converged: boolean;
  root: number | null;
  iterations: number;
  residual: number;
  history: RootIterationRecord[];
  message?: string;
};

export type RootSolveOptions = {
  method: RootMethod;
  fExpression: string;
  gExpression?: string;
  x0?: number;
  x1?: number;
  intervalStart?: number;
  intervalEnd?: number;
  tolerance?: number;
  maxIterations?: number;
};

export type FunctionSample = {
  x: number;
  y: number | null;
};

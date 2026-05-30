export type OdeMethod = "euler" | "improvedEuler" | "midpoint" | "rk4";

export type OdeStep = {
  index: number;
  x: number;
  y: number;
  exact?: number | null;
  error?: number | null;
  slope?: number;
};

export type OdeResult = {
  method: OdeMethod;
  expression: string;
  exactExpression?: string;
  x0: number;
  y0: number;
  xEnd: number;
  stepSize: number;
  steps: OdeStep[];
  maxError?: number | null;
  message?: string;
};

export type OdeSolveOptions = {
  method: OdeMethod;
  expression: string;
  exactExpression?: string;
  x0: number;
  y0: number;
  xEnd: number;
  stepSize: number;
};

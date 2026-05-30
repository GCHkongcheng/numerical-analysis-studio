export type IntegrationMethod =
  | "trapezoid"
  | "simpson"
  | "romberg"
  | "gaussLegendre";

export type IntegrationSample = {
  x: number;
  y: number | null;
};

export type IntegrationTableRow = {
  level: number;
  values: Array<number | null>;
};

export type IntegrationNode = {
  x: number;
  weight?: number;
  fx: number;
};

export type IntegrationResult = {
  method: IntegrationMethod;
  expression: string;
  interval: [number, number];
  value: number;
  subdivisions: number;
  samples: IntegrationSample[];
  nodes: IntegrationNode[];
  table?: IntegrationTableRow[];
  errorEstimate?: number | null;
  message?: string;
};

export type IntegrationOptions = {
  method: IntegrationMethod;
  expression: string;
  intervalStart: number;
  intervalEnd: number;
  subdivisions?: number;
  rombergLevels?: number;
  gaussPoints?: number;
  sampleCount?: number;
};

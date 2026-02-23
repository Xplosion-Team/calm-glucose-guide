const API_BASE = "https://greensdigitalsimulator-production.up.railway.app";

export interface BrainQueryRequest {
  text: string;
  current_glucose: number;
  digital_twin_id: number;
}

export interface BrainQueryResponse {
  explanation: string;
  [key: string]: unknown;
}

export interface TimelineRequest {
  current_glucose: number;
  carbs: number;
  meal_time_offset: number;
  digital_twin_id: number;
}

export interface TimelinePoint {
  minute: number;
  glucose: number;
}

export interface TimelineResponse {
  success: boolean;
  timeline: TimelinePoint[];
  summary: {
    peak_glucose: number;
    peak_at_minute: number;
  };
}

export async function queryBrain(req: BrainQueryRequest): Promise<BrainQueryResponse> {
  const res = await fetch(`${API_BASE}/v1/brain/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Brain query failed: ${res.status}`);
  return res.json();
}

export async function predictTimeline(req: TimelineRequest): Promise<TimelineResponse> {
  const res = await fetch(`${API_BASE}/v1/predict/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Timeline prediction failed: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

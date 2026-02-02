import { API_ROUTES, type AgentActionPayload } from '@agent-switchboard/shared';

export interface SwitchboardClientOptions {
  baseUrl?: string;
  apiKey: string;
}

export interface CreateRequestResult {
  requestId: number;
  status: string;
}

export interface DryRunResult {
  planId: number;
  steps: Array<{
    stepId: string;
    type: string;
    description: string;
    inputs: Record<string, unknown>;
    preview?: string;
    diff?: string;
    riskFlags: string[];
    riskScore?: number;
  }>;
  riskScore: number;
  riskSummary: {
    totalRiskScore: number;
    high: number;
    medium: number;
    low: number;
    flagsTop: string[];
  };
}

export interface ExecuteResult {
  receiptId: number;
  status: string;
  logs: unknown[];
}

export class SwitchboardClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: SwitchboardClientOptions) {
    this.baseUrl = options.baseUrl || 'http://localhost:5000';
    this.apiKey = options.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async requestAction(action: AgentActionPayload): Promise<CreateRequestResult> {
    return this.request<CreateRequestResult>(
      'POST',
      API_ROUTES.agent.createRequest,
      action
    );
  }

  async dryRun(requestId: number): Promise<DryRunResult> {
    return this.request<DryRunResult>(
      'POST',
      API_ROUTES.agent.dryRun(requestId)
    );
  }

  async execute(planId: number): Promise<ExecuteResult> {
    return this.request<ExecuteResult>(
      'POST',
      API_ROUTES.agent.execute(planId)
    );
  }

  async requestAndPreview(action: AgentActionPayload): Promise<{
    requestId: number;
    dryRun: DryRunResult;
  }> {
    const { requestId } = await this.requestAction(action);
    const dryRun = await this.dryRun(requestId);
    return { requestId, dryRun };
  }

  async executeApproved(planId: number): Promise<ExecuteResult> {
    return this.execute(planId);
  }
}

export function createClient(options: SwitchboardClientOptions): SwitchboardClient {
  return new SwitchboardClient(options);
}

export { API_ROUTES } from '@agent-switchboard/shared';
export type { AgentActionPayload } from '@agent-switchboard/shared';

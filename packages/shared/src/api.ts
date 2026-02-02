export const API_ROUTES = {
  admin: {
    login: '/api/admin/login',
    logout: '/api/admin/logout',
    me: '/api/admin/me',
    agents: '/api/admin/agents',
    agentById: (id: number) => `/api/admin/agents/${id}`,
    rotateKey: (id: number) => `/api/admin/agents/${id}/rotate-key`,
    capability: (agentId: number, type: string) => `/api/admin/agents/${agentId}/capabilities/${type}`,
    settings: '/api/admin/settings',
    settingByKey: (key: string) => `/api/admin/settings/${key}`,
    requests: '/api/admin/action-requests',
    requestById: (id: number) => `/api/admin/action-requests/${id}`,
    approvePlan: (planId: number) => `/api/admin/plans/${planId}/approve`,
    safeMode: '/api/admin/safe-mode',
    lockdown: '/api/admin/lockdown',
    plugins: '/api/admin/plugins',
    audit: '/api/admin/audit',
  },
  agent: {
    createRequest: '/api/agent/action-requests',
    dryRun: (requestId: number) => `/api/agent/action-requests/${requestId}/dry-run`,
    execute: (planId: number) => `/api/agent/plans/${planId}/execute`,
  },
} as const;

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface CreateRequestResponse {
  requestId: number;
  status: string;
}

export interface DryRunResponse {
  planId: number;
  steps: unknown[];
  riskScore: number;
  riskSummary: {
    totalRiskScore: number;
    high: number;
    medium: number;
    low: number;
    flagsTop: string[];
  };
}

export interface ExecuteResponse {
  receiptId: number;
  status: string;
  logs: unknown[];
}

export interface CreateAgentResponse {
  agent: { id: number; name: string };
  apiKey: string;
}

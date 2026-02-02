import { z } from "zod";
import { 
  insertUserSchema, 
  insertAgentSchema, 
  insertCapabilitySchema,
  AgentActionSchema,
  insertSettingSchema,
  users, agents, agentCapabilities, actionRequests, plans, executionReceipts, auditEvents, settings
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  conflict: z.object({
    message: z.string(),
  }),
};

export const api = {
  // === ADMIN AUTH ===
  admin: {
    login: {
      method: 'POST' as const,
      path: '/api/admin/login',
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.object({ message: z.string(), user: z.any() }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/admin/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/admin/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },

  // === AGENT MANAGEMENT ===
  agents: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/agents',
      responses: {
        200: z.array(z.custom<typeof agents.$inferSelect & { capabilities: any[] }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/admin/agents',
      input: z.object({ name: z.string() }),
      responses: {
        201: z.object({ agent: z.custom<typeof agents.$inferSelect>(), apiKey: z.string() }),
        409: errorSchemas.conflict,
      },
    },
    rotateKey: {
      method: 'POST' as const,
      path: '/api/admin/agents/:id/rotate-key',
      responses: {
        200: z.object({ apiKey: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    toggleCapability: {
      method: 'PATCH' as const,
      path: '/api/admin/agents/:id/capabilities/:type',
      input: z.object({ enabled: z.boolean(), config: z.record(z.any()).optional() }),
      responses: {
        200: z.custom<typeof agentCapabilities.$inferSelect>(),
      },
    },
  },

  // === SETTINGS ===
  settings: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/settings',
      responses: {
        200: z.array(z.custom<typeof settings.$inferSelect>()),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/admin/settings/:key',
      input: z.object({ value: z.any() }),
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
      },
    },
  },

  // === REQUESTS & PLANS ===
  requests: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/action-requests',
      input: z.object({ status: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof actionRequests.$inferSelect & { agentName: string }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/admin/action-requests/:id',
      responses: {
        200: z.custom<typeof actionRequests.$inferSelect & { plans: any[] }>(),
        404: errorSchemas.notFound,
      },
    },
  },
  
  plans: {
    approve: {
      method: 'POST' as const,
      path: '/api/admin/plans/:id/approve',
      input: z.object({ decision: z.enum(['approved', 'rejected']) }),
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },

  // === SAFE MODE & LOCKDOWN ===
  safeMode: {
    get: {
      method: 'GET' as const,
      path: '/api/admin/safe-mode',
      responses: {
        200: z.object({ enabled: z.boolean() }),
      },
    },
    set: {
      method: 'POST' as const,
      path: '/api/admin/safe-mode',
      input: z.object({ enabled: z.boolean() }),
      responses: {
        200: z.object({ message: z.string(), enabled: z.boolean() }),
      },
    },
    lockdown: {
      method: 'POST' as const,
      path: '/api/admin/lockdown',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },

  // === PLUGINS ===
  plugins: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/plugins',
      responses: {
        200: z.array(z.object({
          id: z.string(),
          displayName: z.string(),
          version: z.string(),
          capabilityType: z.string(),
          uiHints: z.any().optional(),
        })),
      },
    },
  },

  // === AUDIT ===
  audit: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/audit',
      responses: {
        200: z.array(z.custom<typeof auditEvents.$inferSelect>()),
      },
    },
  },

  // === AGENT API (For Bots) ===
  agentApi: {
    createRequest: {
      method: 'POST' as const,
      path: '/api/agent/action-requests',
      input: AgentActionSchema,
      responses: {
        201: z.object({ requestId: z.number(), status: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    dryRun: {
      method: 'POST' as const,
      path: '/api/agent/action-requests/:id/dry-run',
      responses: {
        200: z.object({ 
          planId: z.number(), 
          steps: z.array(z.any()),
          riskScore: z.number(),
          riskSummary: z.object({
            totalRiskScore: z.number(),
            high: z.number(),
            medium: z.number(),
            low: z.number(),
            flagsTop: z.array(z.string()),
          }),
        }),
        404: errorSchemas.notFound,
      },
    },
    execute: {
      method: 'POST' as const,
      path: '/api/agent/plans/:id/execute',
      responses: {
        200: z.object({ receiptId: z.number(), status: z.string(), logs: z.array(z.any()) }),
        400: z.object({ message: z.string() }), // Plan not approved
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

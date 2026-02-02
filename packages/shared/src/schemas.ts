import { z } from 'zod';

export const AgentActionSchema = z.object({
  type: z.enum(['filesystem', 'shell', 'network', 'echo']),
  operation: z.string(),
  params: z.record(z.unknown()),
});

export type AgentActionPayload = z.infer<typeof AgentActionSchema>;

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1),
});

export const UpdateCapabilitySchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

export const UpdateSettingSchema = z.object({
  value: z.unknown(),
});

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

export const SafeModeSchema = z.object({
  enabled: z.boolean(),
});

export const PlanStepSchema = z.object({
  stepId: z.string(),
  type: z.enum(['FS_READ', 'FS_WRITE', 'FS_DELETE', 'FS_LIST', 'FS_MOVE', 'SHELL_RUN', 'NET_ALLOW']),
  description: z.string(),
  inputs: z.record(z.unknown()),
  preview: z.string().optional(),
  diff: z.string().optional(),
  riskFlags: z.array(z.string()),
  riskScore: z.number().optional(),
});

export const RiskSummarySchema = z.object({
  totalRiskScore: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
  flagsTop: z.array(z.string()),
});

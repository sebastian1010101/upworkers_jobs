import { z } from 'zod';

const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());
const optionalPhoneId = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().regex(/^\d+$/).optional(),
);
const optionalPhoneNumber = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  UPWORK_CACHE_SWEEP_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  UPWORK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  JOB_FILTER_MIN_FIXED_BUDGET_USD: z.coerce.number().nonnegative().max(1000000).default(100),
  JOB_FILTER_MIN_HOURLY_RATE_USD: z.coerce.number().nonnegative().max(10000).default(10),
  OPENAI_API_KEY: optionalText,
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5.6-terra'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  EXTERNAL_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  EXTERNAL_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(250),
  JOB_NOTIFY_SCORE_THRESHOLD: z.coerce.number().min(0).max(10).default(8),
  WHATSAPP_ACCESS_TOKEN: optionalText,
  WHATSAPP_PHONE_NUMBER_ID: optionalPhoneId,
  WHATSAPP_RECIPIENT_PHONE_NUMBER: optionalPhoneNumber,
  WHATSAPP_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v26.0'),
  WHATSAPP_TEMPLATE_NAME: z.string().regex(/^[a-z0-9_]+$/).default('upwork_job_alert'),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/).default('en_US'),
  WHATSAPP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  WHATSAPP_APP_SECRET: optionalText,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalText,
  DATABASE_URL: z.url().refine(
    (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'DATABASE_URL must be a PostgreSQL URL',
  ),
});

export function validateEnvironment(config: Record<string, unknown>) {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }
  return { ...config, ...result.data };
}

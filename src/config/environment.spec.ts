import { validateEnvironment } from './environment';

describe('UPWORK_CACHE_SWEEP_MINUTES', () => {
  const base = { DATABASE_URL: 'postgresql://localhost:5432/radar' };

  it('defaults to 15 minutes', () => {
    expect(validateEnvironment(base).UPWORK_CACHE_SWEEP_MINUTES).toBe(15);
  });

  it('rejects an unsafe zero-minute interval', () => {
    expect(() => validateEnvironment({ ...base, UPWORK_CACHE_SWEEP_MINUTES: '0' })).toThrow('Invalid environment configuration');
  });
});

describe('deterministic job filter thresholds', () => {
  const base = { DATABASE_URL: 'postgresql://localhost:5432/radar' };

  it('uses conservative default minimum budgets', () => {
    const environment = validateEnvironment(base);
    expect(environment.JOB_FILTER_MIN_FIXED_BUDGET_USD).toBe(100);
    expect(environment.JOB_FILTER_MIN_HOURLY_RATE_USD).toBe(10);
  });

  it('rejects negative thresholds', () => {
    expect(() => validateEnvironment({ ...base, JOB_FILTER_MIN_FIXED_BUDGET_USD: '-1' }))
      .toThrow('Invalid environment configuration');
  });
});

describe('OpenAI configuration', () => {
  const base = { DATABASE_URL: 'postgresql://localhost:5432/radar' };

  it('keeps the key optional and supplies safe client defaults', () => {
    const environment = validateEnvironment({ ...base, OPENAI_API_KEY: '' });
    expect(environment.OPENAI_API_KEY).toBeUndefined();
    expect(environment.OPENAI_MODEL).toBe('gpt-5.6-terra');
    expect(environment.OPENAI_TIMEOUT_MS).toBe(30000);
    expect(environment.JOB_NOTIFY_SCORE_THRESHOLD).toBe(8);
  });

  it('rejects a timeout outside the supported range', () => {
    expect(() => validateEnvironment({ ...base, OPENAI_TIMEOUT_MS: '999' }))
      .toThrow('Invalid environment configuration');
  });

  it('rejects notification thresholds above ten', () => {
    expect(() => validateEnvironment({ ...base, JOB_NOTIFY_SCORE_THRESHOLD: '10.1' }))
      .toThrow('Invalid environment configuration');
  });
});

describe('WhatsApp configuration', () => {
  const base = { DATABASE_URL: 'postgresql://localhost:5432/radar' };

  it('keeps credentials optional and supplies versioned API defaults', () => {
    const environment = validateEnvironment({
      ...base,
      WHATSAPP_ACCESS_TOKEN: '',
      WHATSAPP_APP_SECRET: '',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: '',
    });
    expect(environment.WHATSAPP_ACCESS_TOKEN).toBeUndefined();
    expect(environment.WHATSAPP_GRAPH_API_VERSION).toBe('v26.0');
    expect(environment.WHATSAPP_TEMPLATE_NAME).toBe('upwork_job_alert');
    expect(environment.WHATSAPP_TIMEOUT_MS).toBe(15000);
    expect(environment.WHATSAPP_APP_SECRET).toBeUndefined();
    expect(environment.WHATSAPP_WEBHOOK_VERIFY_TOKEN).toBeUndefined();
  });

  it('rejects malformed phone numbers and API versions', () => {
    expect(() => validateEnvironment({ ...base, WHATSAPP_RECIPIENT_PHONE_NUMBER: '123' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnvironment({ ...base, WHATSAPP_GRAPH_API_VERSION: 'latest' }))
      .toThrow('Invalid environment configuration');
  });
});

import { ConfigService } from '@nestjs/config';
import { WhatsAppApiError, WhatsAppClient } from './whatsapp.client';

const values: Record<string, string | number> = {
  WHATSAPP_ACCESS_TOKEN: 'secret-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456',
  WHATSAPP_RECIPIENT_PHONE_NUMBER: '5511999999999',
  WHATSAPP_GRAPH_API_VERSION: 'v26.0',
  WHATSAPP_TIMEOUT_MS: 15000,
  EXTERNAL_RETRY_ATTEMPTS: 3,
  EXTERNAL_RETRY_BASE_DELAY_MS: 0,
};

const config = {
  get: (key: string) => values[key],
  getOrThrow: (key: string) => values[key],
} as unknown as ConfigService;

describe('WhatsAppClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends an approved template and returns the Meta message id', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = new WhatsAppClient(config);

    await expect(client.sendTemplate({
      templateName: 'upwork_job_alert',
      languageCode: 'en_US',
      parameters: ['Title', '8.5'],
    })).resolves.toBe('wamid.123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/123456/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'template',
      template: { name: 'upwork_job_alert', language: { code: 'en_US' } },
    });
    expect(request.headers.Authorization).toBe('Bearer secret-token');
  });

  it('normalizes provider errors without exposing the token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 131047, message: 'Template required' } }),
    }) as unknown as typeof fetch;
    const client = new WhatsAppClient(config);

    await expect(client.sendTemplate({
      templateName: 'upwork_job_alert',
      languageCode: 'en_US',
      parameters: [],
    })).rejects.toEqual(expect.objectContaining<Partial<WhatsAppApiError>>({
      code: '131047',
      message: 'Template required',
    }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries rate limits and returns the successful message id', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 4, message: 'Rate limited' } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: 'wamid.after-retry' }] }),
      }) as unknown as typeof fetch;
    const client = new WhatsAppClient(config);

    await expect(client.sendTemplate({
      templateName: 'upwork_job_alert',
      languageCode: 'en_US',
      parameters: [],
    })).resolves.toBe('wamid.after-retry');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry an ambiguous network failure that could duplicate a message', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connection reset')) as unknown as typeof fetch;
    const client = new WhatsAppClient(config);

    await expect(client.sendTemplate({
      templateName: 'upwork_job_alert',
      languageCode: 'en_US',
      parameters: [],
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

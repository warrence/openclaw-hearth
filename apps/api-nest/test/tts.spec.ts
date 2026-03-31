import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { LaravelCryptoService } from '../src/settings/laravel-crypto.service';
import { SettingsRepository } from '../src/settings/settings.repository';
import { TtsController } from '../src/tts/tts.controller';
import { TtsService } from '../src/tts/tts.service';

describe('Nest TTS migration slice', () => {
  let repository: {
    getOrCreateTtsSettings: jest.Mock;
  };
  let service: TtsService;
  let controller: TtsController;

  beforeEach(() => {
    repository = {
      getOrCreateTtsSettings: jest.fn(async () => ({
        id: 1,
        active_provider: 'openai',
        openai_api_key_encrypted: 'encrypted:openai',
        openai_default_voice: 'alloy',
        elevenlabs_api_key_encrypted: 'encrypted:eleven',
        elevenlabs_default_voice: 'Rachel',
        updated_at: '2026-03-25T01:02:03.000Z',
      })),
    };

    service = new TtsService(
      repository as unknown as SettingsRepository,
      {
        tryDecryptString(value: string | null) {
          if (value === 'encrypted:openai') {
            return 'sk-openai-secret';
          }

          if (value === 'encrypted:eleven') {
            return 'eleven-secret';
          }

          return null;
        },
      } as LaravelCryptoService,
    );
    controller = new TtsController(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('streams OpenAI speech audio with the expected response headers', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(Buffer.from('openai-audio'), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        }),
      );

    const response = {
      setHeader: jest.fn(),
    };

    const file = await controller.speak({ text: 'Speak this back.' }, response);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/speech',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-openai-secret',
        }),
      }),
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-TTS-Provider', 'openai');
    expect(response.setHeader).toHaveBeenCalledWith('X-TTS-Voice', 'alloy');
    expect(await streamableFileToString(file)).toBe('openai-audio');
  });

  it('resolves ElevenLabs voice names before generating audio', async () => {
    repository.getOrCreateTtsSettings.mockResolvedValueOnce({
      id: 1,
      active_provider: 'elevenlabs',
      openai_api_key_encrypted: null,
      openai_default_voice: null,
      elevenlabs_api_key_encrypted: 'encrypted:eleven',
      elevenlabs_default_voice: 'Rachel',
      updated_at: '2026-03-25T01:02:03.000Z',
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          voices: [{ voice_id: 'voice_rachel_123', name: 'Rachel' }],
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('eleven-audio'), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        }),
      );

    const result = await service.speak('Use ElevenLabs');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.elevenlabs.io/v1/voices',
      expect.objectContaining({
        headers: expect.objectContaining({
          'xi-api-key': 'eleven-secret',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.elevenlabs.io/v1/text-to-speech/voice_rachel_123',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.provider).toBe('elevenlabs');
    expect(result.audio.toString()).toBe('eleven-audio');
  });

  it('returns clear validation and provider configuration errors', async () => {
    await expect(
      controller.speak(
        { text: '   ' },
        { setHeader: jest.fn() },
      ),
    ).rejects.toThrow(
      new UnprocessableEntityException(
        'Text is required to generate speech audio.',
      ),
    );

    repository.getOrCreateTtsSettings.mockResolvedValueOnce({
      id: 1,
      active_provider: 'browser',
      openai_api_key_encrypted: null,
      openai_default_voice: null,
      elevenlabs_api_key_encrypted: null,
      elevenlabs_default_voice: null,
      updated_at: '2026-03-25T01:02:03.000Z',
    });

    await expect(service.speak('Use browser')).rejects.toThrow(
      new ConflictException(
        'Browser speech is active. This message should be spoken locally on the device.',
      ),
    );
  });
});

async function streamableFileToString(file: {
  getStream(): NodeJS.ReadableStream;
}): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

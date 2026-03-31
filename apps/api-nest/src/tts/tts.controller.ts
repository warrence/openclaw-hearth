import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpenClawConfig } from '../config/openclaw.config';

/**
 * TTS endpoint that proxies to the OpenClaw Hearth plugin's /tts route.
 * The plugin uses OpenClaw's built-in synthesizeSpeech() which reads
 * messages.tts config from openclaw.json — ElevenLabs, OpenAI, Edge all supported.
 */
@Controller('api')
export class TtsController {
  constructor(private readonly configService: ConfigService) {}

  @Post('tts/speak')
  @HttpCode(HttpStatus.OK)
  async speak(
    @Body() body: { text: string },
    @Res() res: any,
  ): Promise<void> {
    const text = body?.text?.trim();
    if (!text) {
      res.status(400).json({ message: 'Text is required.' });
      return;
    }

    try {
      const config = this.configService.get<OpenClawConfig>('openclaw');
      const inboundUrl = config?.hearthChannelInboundUrl ?? 'http://127.0.0.1:18789/channel/hearth-app/inbound';
      const ttsUrl = inboundUrl.replace(/\/inbound$/, '/tts');
      const token = config?.hearthChannelToken ?? '';

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, text }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok || !response.body) {
        const err = await response.text().catch(() => 'TTS failed');
        res.status(response.status || 502).json({ message: err });
        return;
      }

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'TTS failed',
      });
    }
  }
}

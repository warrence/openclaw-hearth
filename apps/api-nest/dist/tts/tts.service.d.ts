import { LaravelCryptoService } from '../settings/laravel-crypto.service';
import { SettingsRepository } from '../settings/settings.repository';
type TtsSpeakResult = {
    provider: string;
    voice: string;
    mime_type: string;
    audio: Buffer;
};
export declare class TtsService {
    private readonly repository;
    private readonly cryptoService;
    private static readonly OPENAI_API_URL;
    private static readonly OPENAI_MODEL;
    private static readonly ELEVENLABS_VOICES_URL;
    private static readonly ELEVENLABS_TTS_URL;
    private static readonly OPENAI_DEFAULT_VOICE;
    constructor(repository: SettingsRepository, cryptoService: LaravelCryptoService);
    speak(text: string): Promise<TtsSpeakResult>;
    private speakWithOpenAi;
    private speakWithElevenLabs;
    private resolveElevenLabsVoiceId;
    private looksLikeElevenLabsVoiceId;
    private decryptSecret;
    private normalizeNullableString;
    private throwIfUpstreamFailed;
}
export {};

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TtsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsService = void 0;
const common_1 = require("@nestjs/common");
const laravel_crypto_service_1 = require("../settings/laravel-crypto.service");
const settings_repository_1 = require("../settings/settings.repository");
let TtsService = class TtsService {
    static { TtsService_1 = this; }
    repository;
    cryptoService;
    static OPENAI_API_URL = 'https://api.openai.com/v1/audio/speech';
    static OPENAI_MODEL = 'gpt-4o-mini-tts';
    static ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
    static ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/';
    static OPENAI_DEFAULT_VOICE = 'alloy';
    constructor(repository, cryptoService) {
        this.repository = repository;
        this.cryptoService = cryptoService;
    }
    async speak(text) {
        const settings = await this.repository.getOrCreateTtsSettings();
        const provider = settings.active_provider || 'browser';
        if (provider === 'openai') {
            return this.speakWithOpenAi(settings, text);
        }
        if (provider === 'elevenlabs') {
            return this.speakWithElevenLabs(settings, text);
        }
        if (provider === 'browser') {
            throw new common_1.ConflictException('Browser speech is active. This message should be spoken locally on the device.');
        }
        throw new common_1.UnprocessableEntityException('The active text-to-speech provider is not supported.');
    }
    async speakWithOpenAi(settings, text) {
        const apiKey = this.decryptSecret(settings.openai_api_key_encrypted);
        if (!apiKey) {
            throw new common_1.UnprocessableEntityException('OpenAI speech is selected, but the API key is missing.');
        }
        const voice = this.normalizeNullableString(settings.openai_default_voice) ||
            TtsService_1.OPENAI_DEFAULT_VOICE;
        const response = await fetch(TtsService_1.OPENAI_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'audio/mpeg',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: TtsService_1.OPENAI_MODEL,
                voice,
                input: text,
                response_format: 'mp3',
            }),
        });
        await this.throwIfUpstreamFailed(response, 'OpenAI');
        return {
            provider: 'openai',
            voice,
            mime_type: response.headers.get('content-type') || 'audio/mpeg',
            audio: Buffer.from(await response.arrayBuffer()),
        };
    }
    async speakWithElevenLabs(settings, text) {
        const apiKey = this.decryptSecret(settings.elevenlabs_api_key_encrypted);
        if (!apiKey) {
            throw new common_1.UnprocessableEntityException('ElevenLabs speech is selected, but the API key is missing.');
        }
        const voice = this.normalizeNullableString(settings.elevenlabs_default_voice);
        if (!voice) {
            throw new common_1.UnprocessableEntityException('ElevenLabs speech is selected, but no default voice is saved.');
        }
        const voiceId = await this.resolveElevenLabsVoiceId(apiKey, voice);
        const response = await fetch(`${TtsService_1.ELEVENLABS_TTS_URL}${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                Accept: 'audio/mpeg',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
            }),
        });
        await this.throwIfUpstreamFailed(response, 'ElevenLabs');
        return {
            provider: 'elevenlabs',
            voice,
            mime_type: response.headers.get('content-type') || 'audio/mpeg',
            audio: Buffer.from(await response.arrayBuffer()),
        };
    }
    async resolveElevenLabsVoiceId(apiKey, voice) {
        if (this.looksLikeElevenLabsVoiceId(voice)) {
            return voice;
        }
        const response = await fetch(TtsService_1.ELEVENLABS_VOICES_URL, {
            headers: {
                'xi-api-key': apiKey,
                Accept: 'application/json',
            },
        });
        await this.throwIfUpstreamFailed(response, 'ElevenLabs');
        const payload = (await response.json());
        const match = payload.voices?.find((candidate) => candidate.name?.toLowerCase() === voice.toLowerCase());
        if (!match?.voice_id) {
            throw new common_1.UnprocessableEntityException(`Saved ElevenLabs voice "${voice}" was not found for the configured account.`);
        }
        return match.voice_id;
    }
    looksLikeElevenLabsVoiceId(voice) {
        return !voice.includes(' ') && /^[A-Za-z0-9_-]{10,}$/.test(voice);
    }
    decryptSecret(value) {
        return this.normalizeNullableString(this.cryptoService.tryDecryptString(value));
    }
    normalizeNullableString(value) {
        if (!value) {
            return null;
        }
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }
    async throwIfUpstreamFailed(response, provider) {
        if (response.ok) {
            return;
        }
        let message = `${provider} text-to-speech failed with status ${response.status}.`;
        try {
            const payload = (await response.json());
            message =
                payload.detail ||
                    payload.message ||
                    payload.error?.message ||
                    message;
        }
        catch {
            try {
                const text = (await response.text()).trim();
                if (text) {
                    message = text;
                }
            }
            catch {
            }
        }
        if (response.status >= 500) {
            throw new common_1.BadGatewayException(message);
        }
        throw new common_1.UnprocessableEntityException(message);
    }
};
exports.TtsService = TtsService;
exports.TtsService = TtsService = TtsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_repository_1.SettingsRepository,
        laravel_crypto_service_1.LaravelCryptoService])
], TtsService);

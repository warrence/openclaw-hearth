import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data') as typeof import('form-data');
import { join, resolve } from 'node:path';

import { AttachmentPayload } from '../attachments/attachments.types';

const OPENAI_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';

export class ImageGenerationException extends Error {
  constructor(message = 'Image generation failed.') {
    super(message);
    this.name = 'ImageGenerationException';
  }
}

export type ImageGenerationResult = {
  assistant_text: string;
  provider: string;
  model: string;
  size: string;
  quality: string;
  operation: 'generate' | 'edit';
  attachments: AttachmentPayload[];
  revised_prompt: string | null;
};

/**
 * Detect whether a message + attachments should be routed to image
 * generation, image editing, or normal chat.
 */
export type ImageIntent = 'generate' | 'edit' | 'chat';

const VISUAL_NOUNS =
  '(image|picture|photo|portrait|avatar|logo|poster|wallpaper|illustration|art|artwork|scene|sketch|drawing|painting|icon|banner|photograph|headshot|selfie|sticker|meme)';

const HARD_CHAT_GUARDS = [
  /\b(create|add|make|set\s*up|setup)\b.{0,24}\b(user|profile|member|account|person|pin)\b/i,
  /\b(reset|change|update|remove|delete)\b.{0,24}\b(user|profile|member|account|pin)\b/i,
  /\b(analyze|describe|read|extract|summari[sz]e|what(?:'|')s|what is|inspect)\b.{0,48}\b(image|photo|picture|screenshot|receipt|pdf|attachment|file)\b/i,
  /\b(system|architecture|roadmap|rollout|permissions?|offline|sync|database|schema|data model|api|backend|frontend|feature|implementation|strategy|tradeoffs?|compare|analysis|analyze|plan|workflow|reminder system|task system|design a .* system)\b/i,
];

const IMAGE_EDIT_PATTERNS = [
  /\b(edit|retouch|touch\s+up|transform|turn|convert|change|replace|remove|improve|enhance|upscale|restyle)\b/i,
  /\bkeep\b.{0,32}\b(same|this|original)\b/i,
  /\b(improve|adjust|fix)\b.{0,32}\b(lighting|background|colors?|colour|shadows?|highlights?)\b/i,
  /\b(product shot|studio photo|studio shot|same bottle|same subject|same image|same photo|background|lighting)\b/i,
  /^\s*(make|edit)\b.{0,24}\b(this|attached|same)\b.{0,24}\b(image|photo|picture)\b/i,
  /^\s*(make|put|turn|change|replace|remove|add|move|swap)\b.{0,96}\b(long\s+hair|smile|studio|desert|anime|cartoon|background|hair|eyes?|face|style|outfit|clothes|scene|setting|color|colour)s?\b/i,
  // "add X" with an image attached → edit
  /^\s*(add|give|put|attach|include|place)\b.{0,64}\b(wing|horn|hat|beard|mustache|glasses|mask|tail|ear|arm|leg|weapon|armor|armour|crown|halo|cape|cloak|sword|shield|fire|glow|shadow|wing|wings|feather|feathers|flower|flowers|tattoo|scar|fur|scale|scales)s?\b/i,
  /^\s*can\s+(you|u)\b.{0,8}\b(add|give|put|place|attach)\b/i,
  /^\s*turn\b.{0,48}\binto\b/i,
  /^\s*change\b.{0,48}\bto\b/i,
  /^\s*put\b.{0,48}\bin\b/i,
];

const STRONG_VISUAL_VERB_PATTERNS = [
  /^\s*(draw|paint|illustrate|render|sketch)\b/i,
  new RegExp(`^\\s*(generate|create|make|design)\\b.{0,24}\\b${VISUAL_NOUNS}\\b`, 'i'),
  new RegExp(`^\\s*(show me|give me)\\b.{0,24}\\b${VISUAL_NOUNS}\\b`, 'i'),
  new RegExp(
    `^\\s*(can you|could you|please)\\s+(generate|create|make|draw|paint|render|illustrate|design)\\b.{0,24}\\b${VISUAL_NOUNS}\\b`,
    'i',
  ),
];

const EXPLICIT_VISUAL_CUE_PATTERNS = [
  new RegExp(
    `\\b(generate|create|make|draw|paint|render|illustrate|design)\\b.{0,48}\\b${VISUAL_NOUNS}\\b`,
    'i',
  ),
  new RegExp(`\\b${VISUAL_NOUNS}\\b.{0,48}\\b(of|for|with|showing|featuring)\\b`, 'i'),
  new RegExp(`^\\s*(show me|give me|make me|create me)\\b.+\\b${VISUAL_NOUNS}\\b`, 'i'),
];

export function detectImageIntent(
  content: string,
  attachments: AttachmentPayload[],
): ImageIntent {
  const trimmed = content.trim();
  if (!trimmed) return 'chat';

  // Hard chat guards — never route to image
  for (const re of HARD_CHAT_GUARDS) {
    if (re.test(trimmed)) return 'chat';
  }

  const hasImageAttachment = attachments.some((a) => a.category === 'image');

  // If image attachment + edit-like prompt → edit
  if (hasImageAttachment) {
    for (const re of IMAGE_EDIT_PATTERNS) {
      if (re.test(trimmed)) return 'edit';
    }
  }

  // Explicit visual generation cues
  for (const re of STRONG_VISUAL_VERB_PATTERNS) {
    if (re.test(trimmed)) return 'generate';
  }
  for (const re of EXPLICIT_VISUAL_CUE_PATTERNS) {
    if (re.test(trimmed)) return 'generate';
  }

  return 'chat';
}

@Injectable()
export class ImageGenerationService {
  private resolveApiKey(): string {
    // Read OpenAI API key from openclaw.json — single source of truth
    try {
      const openClawJsonPath = require('node:path').join(require('node:os').homedir(), '.openclaw', 'openclaw.json');
      const raw = require('node:fs').readFileSync(openClawJsonPath, 'utf8');
      const cfg = JSON.parse(raw);

      // Check models.providers.openai.apiKey first, then env.OPENAI_API_KEY, then auth profiles
      const envKey = cfg?.env?.OPENAI_API_KEY;
      const providerKey = cfg?.models?.providers?.openai?.apiKey;
      const key = providerKey ?? envKey ?? process.env.OPENAI_API_KEY ?? '';

      if (key) return key;
    } catch { /* fall through */ }

    const envKey = process.env.OPENAI_IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
    if (!envKey) throw new ImageGenerationException("Image generation isn't available right now. No OpenAI API key found in openclaw.json.");
    return envKey;
  }

  private resolveModel(): string {
    return process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  }

  private resolveSize(): string {
    return process.env.OPENAI_IMAGE_SIZE ?? '1024x1024';
  }

  private resolveQuality(): string {
    return process.env.OPENAI_IMAGE_QUALITY ?? 'medium';
  }

  private resolveStorageRoot(): string {
    return process.env.ATTACHMENTS_STORAGE_ROOT
      ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
      : join(process.cwd(), 'storage');
  }

  private resolvePublicBaseUrl(): string {
    return (process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
  }

  private resolveInternalBaseUrl(): string {
    return (process.env.ATTACHMENTS_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
  }

  async generateForConversation(
    conversationId: number,
    prompt: string,
  ): Promise<ImageGenerationResult> {
    const apiKey = this.resolveApiKey();
    const model = this.resolveModel();
    const size = this.resolveSize();
    const quality = this.resolveQuality();

    const response = await fetch(OPENAI_GENERATIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        output_format: 'png',
        n: 1,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ImageGenerationException(
        response.status >= 500
          ? "I couldn't generate that image right now. Please try again."
          : "I couldn't generate that image from that request. Please try again.",
      );
    }

    const data = (await response.json()) as { data: { b64_json?: string; revised_prompt?: string }[] };
    const attachment = await this.storeBase64Image(
      conversationId,
      data.data[0]?.b64_json ?? '',
      'generated-image.png',
    );

    return {
      assistant_text: "Here's your image.",
      provider: 'openai',
      model,
      size,
      quality,
      operation: 'generate',
      attachments: [attachment],
      revised_prompt: data.data[0]?.revised_prompt?.trim() || null,
    };
  }

  async editForConversation(
    conversationId: number,
    prompt: string,
    attachments: AttachmentPayload[],
  ): Promise<ImageGenerationResult> {
    const apiKey = this.resolveApiKey();
    const model = this.resolveModel();
    const size = this.resolveSize();
    const quality = this.resolveQuality();

    const sourceAttachment = attachments.find((a) => a.category === 'image');
    if (!sourceAttachment) {
      throw new ImageGenerationException('I need an attached image to edit.');
    }

    if (!sourceAttachment.path) {
      throw new ImageGenerationException('That source image is no longer available to edit.');
    }

    const storageRoot = this.resolveStorageRoot();
    const absolutePath = join(storageRoot, sourceAttachment.path);

    let binary: Buffer;
    try {
      binary = await readFile(absolutePath);
    } catch {
      throw new ImageGenerationException('That source image could not be read for editing.');
    }

    // Use multipart form to call /v1/images/edits
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('output_format', 'png');
    form.append('n', '1');
    form.append('image', binary, {
      filename: sourceAttachment.name || 'source-image.png',
      contentType: sourceAttachment.mime_type || 'image/png',
    });

    const response = await fetch(OPENAI_EDITS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(form.getHeaders() as Record<string, string>),
      },
      body: form.getBuffer() as unknown as BodyInit,
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[Hearth] image edit failed:', response.status, text.slice(0, 300));
      throw new ImageGenerationException(
        response.status >= 500
          ? "I couldn't edit that image right now. Please try again."
          : "I couldn't edit that image from that request. Please try again.",
      );
    }

    const data = (await response.json()) as { data: { b64_json?: string; revised_prompt?: string }[] };
    const attachment = await this.storeBase64Image(
      conversationId,
      data.data[0]?.b64_json ?? '',
      'edited-image.png',
    );

    return {
      assistant_text: "Here's your edited image.",
      provider: 'openai',
      model,
      size,
      quality,
      operation: 'edit',
      attachments: [attachment],
      revised_prompt: data.data[0]?.revised_prompt?.trim() || null,
    };
  }

  private async storeBase64Image(
    conversationId: number,
    b64: string,
    filename: string,
  ): Promise<AttachmentPayload> {
    if (!b64) throw new ImageGenerationException();

    const binary = Buffer.from(b64, 'base64');
    if (!binary.length) throw new ImageGenerationException();

    const storageRoot = this.resolveStorageRoot();
    const publicBaseUrl = this.resolvePublicBaseUrl();
    const internalBaseUrl = this.resolveInternalBaseUrl();

    const uuid = randomUUID();
    const safeName = filename.replace(/[^a-z0-9.\-_]/gi, '-');
    const finalName = `${uuid}-${safeName}`;
    const storagePath = `attachments/messages/${conversationId}/${finalName}`;
    const destDir = join(storageRoot, 'attachments', 'messages', String(conversationId));
    const destPath = join(storageRoot, storagePath);

    await mkdir(destDir, { recursive: true });
    await writeFile(destPath, binary);

    return {
      id: randomUUID(),
      name: filename,
      mime_type: 'image/png',
      size_bytes: binary.length,
      extension: 'png',
      category: 'image',
      uploaded_at: new Date().toISOString(),
      url: `${publicBaseUrl}/${storagePath}`,
      internal_url: `${internalBaseUrl}/${storagePath}`,
      text_excerpt: null,
      text_content: null,
      extraction_note: null,
      path: storagePath,
    };
  }
}

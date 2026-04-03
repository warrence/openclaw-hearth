import type { OutboundReplyPayload } from "openclaw/plugin-sdk/reply-payload";
import type { HearthAppInboundEvent } from "./types.js";
export declare function deliverToCallbackUrl(event: HearthAppInboundEvent, payload: OutboundReplyPayload, startedAt: number): Promise<void>;
export declare function deliverErrorToCallbackUrl(event: HearthAppInboundEvent, error: unknown): Promise<void>;
/**
 * Post a streaming delta event to Nest callback — for real-time typing effect.
 */
export declare function postDeltaToCallbackUrl(event: HearthAppInboundEvent, text: string, startedAt: number): Promise<void>;
export declare function postToolStatusToCallback(callbackUrl: string, conversationId: number, toolName: string, elapsedMs?: number): Promise<void>;

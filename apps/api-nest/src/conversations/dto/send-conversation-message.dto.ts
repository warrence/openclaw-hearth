import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ConversationRecord,
  MessageRecord,
} from '../conversations.repository';

export class SendConversationMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  attachments?: string[] | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  stream?: boolean | null;
}

export type SendConversationMessageResponse = {
  user_message: MessageRecord;
  assistant_message: null;
  conversation: ConversationRecord;
  runtime: {
    transport_mode: 'nest-local-persist';
    contract_shaped: false;
  };
};

export type ConversationMessageStreamEvent = {
  event:
    | 'message.created'
    | 'assistant.placeholder'
    | 'assistant.delta'
    | 'assistant.message'
    | 'status'
    | 'progress'
    | 'done'
    | 'error'
    | 'conversation.updated';
  data: Record<string, unknown>;
};

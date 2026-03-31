export type AttachmentCategory = 'image' | 'pdf' | 'text' | 'file';

export type AttachmentPayload = {
  id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  extension: string;
  category: AttachmentCategory;
  uploaded_at: string;
  url: string | null;
  internal_url: string | null;
  text_excerpt: string | null;
  text_content: string | null;
  extraction_note: string | null;
  path: string | null;
};

export type TemporaryAttachmentPayload = AttachmentPayload & {
  token: string;
};

export type AttachmentTokenPayload = {
  conversation_id: number;
  path: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  extension: string;
  category: AttachmentCategory;
  uploaded_at: string;
  issued_at: string;
};

export type AuthenticatedUser = {
  id: number;
  name: string;
  slug: string;
  avatar: string | null;
  memory_namespace: string;
  default_agent_id: string | null;
  is_active: boolean;
  role: string;
  pin_set_at: string | null;
  last_login_at: string | null;
  requires_pin: boolean;
  created_at: string;
  updated_at: string;
  has_pin: boolean;
};

export type AuthenticatedRequest = {
  authUser?: AuthenticatedUser;
  headers?: Record<string, string | string[] | undefined>;
};

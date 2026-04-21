export type ModelPresetSettingsRecord = {
  id: number;
  fast_model_id: string;
  fast_think_level: string | null;
  fast_reasoning_enabled: boolean | null;
  deep_model_id: string;
  deep_think_level: string | null;
  deep_reasoning_enabled: boolean | null;
  updated_at: string | null;
};

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Phase = "greeting" | "surface" | "middle" | "deep";

export interface ChatResponse {
  message: string;
  phase: Phase;
  phase_label: string;
}

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

export type Industry = "manufacturing" | "finance" | "distribution" | "retail";

export interface IndustryMeta {
  label: string;
  icon: string;
  description: string;
  company: string;
  personName: string;
  role: string;
  initialGreeting: string;
}

export const INDUSTRY_META: Record<Industry, IndustryMeta> = {
  manufacturing: {
    label: "製造業",
    icon: "🏭",
    description: "金属加工・製造メーカー向け",
    company: "田中金属加工株式会社",
    personName: "田中 幸生",
    role: "代表取締役社長",
    initialGreeting:
      "…はい、田中ですが。本日はどういったご用件でしょうか？あまりお時間がないので、要点からお願いします。",
  },
  finance: {
    label: "金融業",
    icon: "🏦",
    description: "信用金庫・地方銀行向け",
    company: "中央地域信用金庫",
    personName: "中村 義雄",
    role: "営業推進部長",
    initialGreeting:
      "…中村ですが。本日はどういったご用件でしょうか？少々立て込んでいるので、手短にお願いします。",
  },
  distribution: {
    label: "流通業",
    icon: "🚚",
    description: "物流・卸売業向け",
    company: "関東中央物流株式会社",
    personName: "鈴木 雄一郎",
    role: "取締役副社長",
    initialGreeting:
      "…鈴木です。本日はどういったご用件でしょうか？今日は配送の確認で忙しいので、なるべく手短にお願いします。",
  },
  retail: {
    label: "小売業",
    icon: "🛍️",
    description: "小売チェーン・店舗向け",
    company: "株式会社やまだストア",
    personName: "山田 恵子",
    role: "代表取締役",
    initialGreeting:
      "…山田ですが。本日はどのようなご用件でしょうか？店舗の確認があるのでなるべく手短にお願いできますか。",
  },
};

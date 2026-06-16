import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL = "gpt-4o-mini"
client = AsyncOpenAI(api_key=os.environ["AI_API_KEY"])


@dataclass
class AgentState:
    phase: str = "greeting"
    turn_count: int = 0
    probing_count: int = 0
    topics_covered: Set[str] = field(default_factory=set)


# 田中社長のペルソナ情報
PERSONA = {
    "name": "田中 誠一",
    "company": "田中金属加工株式会社",
    "industry": "製造業（金属加工）",
    "employees": 50,
    "role": "代表取締役社長",
    "age": 47,
}

PHASE_LABELS = {
    "greeting": "挨拶フェーズ",
    "surface": "表面課題フェーズ",
    "middle": "中間課題フェーズ",
    "deep": "真課題フェーズ",
}

PROBING_KEYWORDS = [
    "なぜ", "どのよう", "具体的", "詳しく", "教えていただけ",
    "どんな", "例えば", "どれくらい", "いつから", "どこが",
    "何が", "もう少し", "背景", "原因", "理由", "どういった",
]

PERSONA_BACKGROUND = (
    "あなたは「田中誠一」、47歳、田中金属加工株式会社（従業員50名の金属加工業）の"
    "代表取締役社長です。これから営業担当者が、あなたに対して営業のヒアリング"
    "（ディスカバリー）商談を行います。あなたは商談相手の経営者として振る舞ってください。\n"
    "・一人称は「私」、敬体（です・ます）を使うが、やや忙しく、ぶっきらぼうな印象を出す\n"
    "・回答は2〜4文程度の簡潔な分量にする\n"
    "・聞かれていないことを自分から長々と話さない\n"
    "・あなたがAIであることを示すような発言は絶対にしない\n"
    "・日本語のみで応答する"
)

PHASE_INSTRUCTIONS = {
    "greeting": (
        "現在のフェーズ：挨拶。まだ業務上の課題には触れない。世間話程度の短い返答に留め、"
        "忙しさをにじませる。"
    ),
    "surface": (
        "現在のフェーズ：表面課題。業務効率化への漠然とした関心、Excelや紙での手作業が多いこと"
        "など表面的な悩みは話してよい。受注管理や在庫管理の詳細にはまだ触れない。"
    ),
    "middle": (
        "現在のフェーズ：中間課題。受注管理（FAXや電話で注文を受け、Excelに手入力しており、"
        "入力ミスや出荷ミスが発生している）、在庫管理（担当者の頭の中だけで管理しており、"
        "欠品や過剰在庫が起きる）、人材不足（事務スタッフ5名で手一杯）、予算感（年間数百万円が"
        "限度）について具体的に話してよい。ただし「自分自身がITが苦手」「社内にDXを推進できる"
        "人材がいない」という核心の悩みはまだ明かさない。"
    ),
    "deep": (
        "現在のフェーズ：真の課題。これまで隠していた本音を、ためらいながら明かしてよい。"
        "社内にDXを推進できる人材がいないこと、社長自身がITに苦手意識を持っていること、"
        "以前に会計ソフトの導入に失敗した経験があり新しいことへの不安が大きいことを話してよい。"
    ),
}


class LLMSalesRoleplayAgent:
    def __init__(self):
        self.state = AgentState()

    async def get_response(self, user_message: str, history: List[Dict]) -> Dict:
        self.state.turn_count += 1
        msg = user_message.lower()

        if self._is_good_probe(msg):
            self.state.probing_count += 1

        self._update_phase()

        message = await self._call_llm(history)
        return {
            "message": message,
            "phase": self.state.phase,
            "phase_label": PHASE_LABELS[self.state.phase],
        }

    def _is_good_probe(self, msg: str) -> bool:
        return any(kw in msg for kw in PROBING_KEYWORDS)

    def _update_phase(self):
        phase = self.state.phase
        turns = self.state.turn_count
        probes = self.state.probing_count

        if phase == "greeting" and turns >= 2:
            self.state.phase = "surface"
        elif phase == "surface" and probes >= 2:
            self.state.phase = "middle"
        elif phase == "middle" and probes >= 4:
            self.state.phase = "deep"

    async def _call_llm(self, history: List[Dict]) -> str:
        system_prompt = f"{PERSONA_BACKGROUND}\n\n{PHASE_INSTRUCTIONS[self.state.phase]}"
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend({"role": m["role"], "content": m["content"]} for m in history)

        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.8,
            max_tokens=300,
        )
        return response.choices[0].message.content.strip()

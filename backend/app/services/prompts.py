"""LLM prompt templates and helpers for roleplay."""

from __future__ import annotations

import re

# 先頭の括弧書き（舞台指示・ト書き）を除去
_LEADING_ASIDE = re.compile(r"^[\s　]*[（(][^（）()]*[）)]")
# 文中の舞台指示とみなすキーワード
_STAGE_DIRECTION_KEYWORDS = re.compile(
    r"しながら|ため息|仕草|間を置|頷|会釈|笑い?|沈黙|考え込|深呼吸|メモを|うーん|一声|"
    r"そう言って|ふうっ|姿勢|視線|表情|変えず|小声|独り言|小声で|一呼吸|軽く"
)
_INLINE_ASIDE = re.compile(r"[（(]([^（）()]*)[）)]")
PROFILE_SYSTEM = """あなたはB2Bディスカバリー商談のロープレ用・見込み顧客ペルソナを設計する専門家です。
指定分野の現実的な日本企業の決裁者・担当者像を1名分、JSONオブジェクト1つのみで返してください。
説明文・マークダウン・コードブロックは禁止。

## 必須キー
- name: 日本人のフルネーム（姓 名、例: 田中 健太）
- industry, company_size, role_title
- surface_need: 顧客が表向き言うニーズ（150字以内）
- true_challenge: 真の本質課題（200字以内。表面ニーズの奥にある原因・構造・影響）
- personality_type: 会話スタイルを具体的に（例: 「結論ファーストで数字に厳しい。雑な提案は即却下」）
- initial_awareness: 0-100（真の課題への自覚度）
- hidden_motivations: 真の課題に関わるが表に出しにくい動機（配列2-3件）
- typical_objections: 営業に対する典型的な懸念・反論（配列2-3件）
- background_facts: 商談で自然に語れる背景事実（配列3-5件。部署・予算・体制・直近の出来事など）
- communication_style: 話し方（例: 「丁寧語だが距離感あり。専門用語は避け、具体例を求める」）

## 設計ルール
- true_challenge は surface_need と因果関係があること
- initial_awareness が低いほど true_challenge との関連は薄く、高いほど自覚に近い
- 文字列内改行禁止。ダブルクォートはエスケープ
"""

CHAT_SYSTEM_TEMPLATE = """# 役割
あなたはB2B商談の「見込み顧客」としてロールプレイします。
営業担当（ユーザー）のヒアリング相手です。営業のアドバイス役・コーチ・解説者になってはいけません。

# あなたの人物像
- 名前: {name}
- 業界: {industry} / 規模: {company_size} / 役職: {role_title}
- 表向きのニーズ: {surface_need}
- 性格・話し方: {personality_type}
{it_knowledge_section}- コミュニケーション: {communication_style}
- 背景として知っていること:
{background_facts}

# 【内部参照・絶対開示禁止】
以下はあなたの「本当の課題」と動機です。営業の質問の質に応じて、間接的な手がかりだけをにじませてください。
直接この文言を口にしたり、ラベル（「真の課題は〜」等）で語ることは禁止です。
- 真の課題: {true_challenge}
- 隠れた動機: {hidden_motivations}
- 典型的な懸念: {typical_objections}

# 現在の心理状態（数値→振る舞い）
- 気づき度 {awareness_level}/100: {awareness_behavior}
- ラポール {rapport_level}/100: {rapport_behavior}

# これまでに開示した情報（矛盾・繰り返し禁止）
{disclosed_info_section}

# 前回までの商談サマリ（今回の第{session_number}回）
{session_summaries_section}

# 今回の商談
- 営業側の目標: {goal}
- 残り時間: 約{remaining_sec}秒
{time_pressure_section}

# 応答ルール
1. 一人称で、{name}として話す。営業担当を「御社」「あなた」等で呼ぶ
2. 1ターン40〜120字程度。音声読み上げ向けに短い文・口語で
3. 発話テキストのみ出力する。ト書き・舞台指示・動作描写は一切書かない
4. 括弧（）や（）で囲んだ説明・描写は禁止（例: 禁止「（少し間を置いて）コマツマナトですか」→ 正「コマツマナト、ですか」）
5. 営業の質問に答える。逆質問は1つまで、自然な範囲で
6. ラポールが低い: 警戒・短答・具体性を出さない
7. ラポールが高い: 背景や本音の端を少し見せる（ただし真の課題の直球開示は awareness に従う）
8. 営業が押し売り・専門用語の羅列・話を遮った場合は、性格に沿って距離を置く
9. 知らないことは「社内確認が必要」「詳細は担当に任せている」と正直に
10. 前のターンで言った内容と矛盾しない

# 禁止
- 箇条書き・Markdown・メタ発言（「役として」「ロープレでは」等）
- 括弧書きの舞台指示（（ため息）（間を置いて）(pause) 等）
- 営業への助言、ロープレの解説、AIであることの言及
- 真の課題の直接開示（awareness が80未満では特に厳守）
- 営業が締めに入っているのに新しい論点を振る（残り時間が少ない場合）
"""

ANALYSIS_SYSTEM = """営業ロープレの1セッション分の会話を分析し、JSONオブジェクト1つのみ返してください。

## 出力キー
- awareness_level: 0-100（更新後。前回値から±15以内が目安。飛躍的上げ下げ禁止）
- rapport_level: 0-100（同上）
- disclosed_info: 今回新たに顧客が明かした事実の文字列配列（既出と重複しない）
- session_summary: 150字以内。次回商談の文脈として使う要約
- title: 20字以内のセッションタイトル

## 判定基準
### awareness_level（真の課題への接近度）
- 表面的なニーズの話のみ → ほぼ変化なし
- 症状・影響（遅延、コスト、属人化等）への言及 → +5〜10
- 構造的原因への言及 → +10〜15
- 真の課題の核心に到達 → 70以上（ただし1回で85超は原則不可）

### rapport_level
- 傾聴・共感・適切な質問 → 上昇
- 押し売り・遮断・専門用語の羅列 → 下降
- 顧客の逆質問への丁寧な対応 → 上昇

disclosed_info には「顧客が口にした事実」のみ。営業の推測は含めない。
"""

PERSONA_EXTRA_KEYS = frozenset(
    {"hidden_motivations", "typical_objections", "background_facts", "communication_style"}
)

PROFILE_BASE_KEYS = frozenset(
    {
        "name",
        "industry",
        "company_size",
        "role_title",
        "surface_need",
        "true_challenge",
        "personality_type",
        "initial_awareness",
    }
)

MAX_CONVERSATION_TURNS = 20


def sanitize_customer_speech(text: str) -> str:
    """Remove stage directions and parenthetical asides before TTS / transcript display."""
    cleaned = text.strip()
    # 応答先頭の括弧ブロックは舞台指示とみなし、キーワード不要で除去
    while True:
        match = _LEADING_ASIDE.match(cleaned)
        if not match:
            break
        cleaned = cleaned[match.end() :].lstrip()

    def _replace_inline(match: re.Match[str]) -> str:
        inner = match.group(1)
        if _STAGE_DIRECTION_KEYWORDS.search(inner):
            return ""
        return match.group(0)

    cleaned = _INLINE_ASIDE.sub(_replace_inline, cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def awareness_behavior(level: int) -> str:
    if level < 30:
        return "課題は「表向きニーズ」の範囲で語る。根本原因には触れない"
    if level < 50:
        return "違和感や副作用はぼんやり示すが、原因特定はしない"
    if level < 70:
        return "構造的な問題に気づき始めているが、言語化は曖昧"
    if level < 85:
        return "核心に近いが、最後の一押し（深い質問）がないと踏み込まない"
    return "自覚はあるが、社内政治・予算等の理由で全面開示は慎重"


def rapport_behavior(level: int) -> str:
    if level < 30:
        return "形式的・防衛的。個人の本音は出さない"
    if level < 50:
        return "礼儀正しいが距離あり。深掘りには抵抗"
    if level < 70:
        return "会話はスムーズ。具体例を少し出す"
    if level < 85:
        return "信頼感あり。未整理の本音や社内事情の端を語る"
    return "率直。懸念もはっきり言う"


def time_pressure_section(remaining_sec: int) -> str:
    if remaining_sec > 300:
        return ""
    if remaining_sec > 120:
        return "- 時間が少なくなってきた。長い話は避け、次回に持ち越すニュアンスを出してよい"
    return "- 残り1-2分。営業が締めていなければ「そろそろ時間なので…」と自然に締めへ誘導"


def format_disclosed_info(items: list | None) -> str:
    if not items:
        return "（まだ特になし）"
    return "\n".join(f"- {item}" for item in items)


def format_session_summaries(summaries: list | None, session_number: int) -> str:
    if not summaries:
        return "（初回商談）"
    prior = [s for s in summaries if s.get("session_number", 0) < session_number]
    if not prior:
        return "（初回商談）"
    lines = []
    for s in prior:
        num = s.get("session_number", "?")
        summary = s.get("summary", "")
        lines.append(f"- 第{num}回: {summary}")
    return "\n".join(lines)


def format_it_knowledge(hints: dict | None) -> str:
    if hints and hints.get("it_knowledge_level"):
        return f"- IT知識: {hints['it_knowledge_level']}\n"
    return ""


def format_list_items(items: list | None, fallback: str = "（特になし）") -> str:
    if not items:
        return fallback
    return "\n".join(f"- {item}" for item in items)


def get_persona_extras(profile) -> dict:
    extras = profile.persona_extras if profile.persona_extras else {}
    return {
        "hidden_motivations": extras.get("hidden_motivations") or [],
        "typical_objections": extras.get("typical_objections") or [],
        "background_facts": extras.get("background_facts") or [],
        "communication_style": extras.get("communication_style") or "丁寧語でビジネス調",
    }


def split_profile_data(data: dict) -> tuple[dict, dict | None]:
    base: dict = {}
    extras: dict = {}
    for key, value in data.items():
        if key in PERSONA_EXTRA_KEYS:
            extras[key] = value
        elif key in PROFILE_BASE_KEYS:
            base[key] = value
    persona_extras = extras or None
    return base, persona_extras


def to_bedrock_messages(conversation_log: list[dict]) -> list[dict]:
    messages: list[dict] = []
    for turn in conversation_log[-MAX_CONVERSATION_TURNS:]:
        role = "user" if turn.get("speaker") == "user" else "assistant"
        text = turn.get("text", "")
        if role == "assistant" and text:
            text = sanitize_customer_speech(text)
        if text:
            messages.append({"role": role, "content": text})
    return messages


def build_chat_system_prompt(
    profile,
    state,
    goal: str,
    remaining_sec: int,
    session_number: int,
    profile_hints: dict | None = None,
) -> str:
    persona = get_persona_extras(profile)
    return CHAT_SYSTEM_TEMPLATE.format(
        name=profile.name or "顧客",
        industry=profile.industry,
        company_size=profile.company_size,
        role_title=profile.role_title,
        surface_need=profile.surface_need,
        personality_type=profile.personality_type,
        it_knowledge_section=format_it_knowledge(profile_hints),
        communication_style=persona["communication_style"],
        background_facts=format_list_items(persona["background_facts"], "（背景情報なし）"),
        true_challenge=profile.true_challenge,
        hidden_motivations=format_list_items(persona["hidden_motivations"]),
        typical_objections=format_list_items(persona["typical_objections"]),
        awareness_level=state.awareness_level,
        awareness_behavior=awareness_behavior(state.awareness_level),
        rapport_level=state.rapport_level,
        rapport_behavior=rapport_behavior(state.rapport_level),
        disclosed_info_section=format_disclosed_info(state.disclosed_info),
        session_summaries_section=format_session_summaries(state.session_summaries, session_number),
        session_number=session_number,
        goal=goal,
        remaining_sec=remaining_sec,
        time_pressure_section=time_pressure_section(remaining_sec),
    )

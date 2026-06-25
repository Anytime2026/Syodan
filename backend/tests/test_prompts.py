"""Unit tests for roleplay prompt helpers."""

import uuid

from app.domain.models import CustomerProfile, CustomerState
from app.services.prompts import (
    awareness_behavior,
    build_chat_system_prompt,
    rapport_behavior,
    sanitize_customer_speech,
    split_profile_data,
    to_bedrock_messages,
)


def _make_profile(**kwargs) -> CustomerProfile:
    defaults = {
        "program_id": uuid.uuid4(),
        "name": "田中 健太",
        "industry": "金融",
        "company_size": "中堅（300名）",
        "role_title": "情報システム部長",
        "surface_need": "社内システムの老朽化対応",
        "true_challenge": "部門間データ連携不全で意思決定が遅延",
        "personality_type": "慎重・数字重視",
        "initial_awareness": 25,
        "persona_extras": {
            "hidden_motivations": ["前任の失敗を繰り返したくない"],
            "typical_objections": ["予算が読めない"],
            "background_facts": ["来期に予算申請予定"],
            "communication_style": "丁寧語だが距離感あり",
        },
    }
    defaults.update(kwargs)
    return CustomerProfile(**defaults)


def _make_state(**kwargs) -> CustomerState:
    defaults = {
        "program_id": uuid.uuid4(),
        "awareness_level": 30,
        "rapport_level": 40,
        "disclosed_info": ["現行システムの老朽化"],
        "session_summaries": [
            {"session_number": 1, "summary": "予算感を確認した"},
            {"session_number": 2, "summary": "体制の課題を触れた"},
        ],
    }
    defaults.update(kwargs)
    return CustomerState(**defaults)


def test_awareness_behavior_thresholds() -> None:
    assert "表向きニーズ" in awareness_behavior(10)
    assert "構造的" in awareness_behavior(55)
    assert "核心" in awareness_behavior(75)
    assert "自覚" in awareness_behavior(90)


def test_rapport_behavior_thresholds() -> None:
    assert "防衛" in rapport_behavior(10)
    assert "距離" in rapport_behavior(40)
    assert "信頼" in rapport_behavior(80)


def test_build_system_prompt_internal_reference_section() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(),
        _make_state(),
        goal="予算感をヒアリング",
        remaining_sec=600,
        session_number=2,
        profile_hints={"it_knowledge_level": "ITが苦手"},
    )
    assert "【内部参照・絶対開示禁止】" in prompt
    assert "部門間データ連携不全" in prompt
    assert "profile_json" not in prompt
    assert "state_json" not in prompt
    assert "ITが苦手" in prompt


def test_build_system_prompt_excludes_current_session_summary() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(),
        _make_state(),
        goal="体制を確認",
        remaining_sec=600,
        session_number=2,
    )
    assert "第1回: 予算感を確認した" in prompt
    assert "第2回:" not in prompt


def test_build_system_prompt_first_session() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(persona_extras=None),
        _make_state(session_summaries=[]),
        goal="初回ヒアリング",
        remaining_sec=900,
        session_number=1,
    )
    assert "（初回商談）" in prompt
    assert "丁寧語でビジネス調" in prompt


def test_to_bedrock_messages_role_mapping() -> None:
    log = [
        {"speaker": "user", "text": "こんにちは"},
        {"speaker": "ai", "text": "よろしくお願いします"},
    ]
    messages = to_bedrock_messages(log)
    assert messages == [
        {"role": "user", "content": "こんにちは"},
        {"role": "assistant", "content": "よろしくお願いします"},
    ]


def test_sanitize_customer_speech_removes_leading_stage_direction() -> None:
    raw = "（少し間を置いて、メモを取るような仕草をしながら）コマツマナト、ですか。"
    assert sanitize_customer_speech(raw) == "コマツマナト、ですか。"


def test_sanitize_customer_speech_removes_bowing_stage_direction() -> None:
    raw = "（少し間を置いて、軽く会釈しながら） あ、どうも。宮本です。"
    assert sanitize_customer_speech(raw) == "あ、どうも。宮本です。"


def test_sanitize_customer_speech_removes_expression_stage_direction() -> None:
    raw = "（少し間を置いて、表情は変えずに） ...すみません、ちょっと聞き取りにくかったんですが、"
    assert sanitize_customer_speech(raw) == "...すみません、ちょっと聞き取りにくかったんですが、"


def test_sanitize_customer_speech_removes_product_name_parens() -> None:
    raw = "御社のサービス（コマツマナト）について教えてください。"
    assert sanitize_customer_speech(raw) == "御社のサービスについて教えてください。"


def test_sanitize_customer_speech_removes_generic_parenthetical() -> None:
    raw = "（少し驚いて）え、そうなんですか。"
    assert sanitize_customer_speech(raw) == "え、そうなんですか。"


def test_build_system_prompt_speech_only_rules() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(),
        _make_state(),
        goal="初回ヒアリング",
        remaining_sec=600,
        session_number=1,
    )
    assert "出力形式（最重要" in prompt
    assert "TTS" in prompt
    assert "括弧" in prompt


def test_build_system_prompt_with_materials() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(),
        _make_state(),
        goal="製品説明",
        remaining_sec=600,
        session_number=1,
        materials_text="当社製品は月額9,800円で提供しています。",
    )
    assert "営業担当が提示した参考資料" in prompt
    assert "月額9,800円" in prompt
    assert "記載範囲内で答える" in prompt


def test_build_system_prompt_without_materials() -> None:
    prompt = build_chat_system_prompt(
        _make_profile(),
        _make_state(),
        goal="初回ヒアリング",
        remaining_sec=600,
        session_number=1,
    )
    assert "（今回提示された資料なし）" in prompt


def test_split_profile_data() -> None:
    data = {
        "name": "田中 健太",
        "industry": "金融",
        "company_size": "300名",
        "role_title": "部長",
        "surface_need": "刷新",
        "true_challenge": "連携不全",
        "personality_type": "慎重",
        "initial_awareness": 20,
        "hidden_motivations": ["評価を上げたい"],
        "typical_objections": ["予算"],
        "background_facts": ["来期申請"],
        "communication_style": "丁寧語",
        "unknown_key": "ignored",
    }
    base, extras = split_profile_data(data)
    assert base["name"] == "田中 健太"
    assert extras is not None
    assert extras["hidden_motivations"] == ["評価を上げたい"]
    assert "unknown_key" not in base
    assert "unknown_key" not in (extras or {})

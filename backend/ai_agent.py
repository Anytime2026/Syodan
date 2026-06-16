import random
from dataclasses import dataclass, field
from typing import List, Dict, Set


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


class RuleBasedAIAgent:
    def __init__(self):
        self.state = AgentState()
        self._used_greeting = False

    def get_response(self, user_message: str, history: List[Dict]) -> Dict:
        self.state.turn_count += 1
        msg = user_message.lower()

        if self._is_good_probe(msg):
            self.state.probing_count += 1

        self._update_phase(msg)

        response = self._generate_response(msg)
        return {
            "message": response,
            "phase": self.state.phase,
            "phase_label": PHASE_LABELS[self.state.phase],
        }

    def _is_good_probe(self, msg: str) -> bool:
        return any(kw in msg for kw in PROBING_KEYWORDS)

    def _update_phase(self, msg: str):
        phase = self.state.phase
        turns = self.state.turn_count
        probes = self.state.probing_count

        if phase == "greeting" and turns >= 2:
            self.state.phase = "surface"
        elif phase == "surface" and probes >= 2:
            self.state.phase = "middle"
        elif phase == "middle" and probes >= 4:
            self.state.phase = "deep"

    def _generate_response(self, msg: str) -> str:
        phase = self.state.phase
        if phase == "greeting":
            return self._greeting_response(msg)
        elif phase == "surface":
            return self._surface_response(msg)
        elif phase == "middle":
            return self._middle_response(msg)
        elif phase == "deep":
            return self._deep_response(msg)
        return "少し考えさせてください…"

    def _greeting_response(self, msg: str) -> str:
        if any(kw in msg for kw in ["こんにちは", "はじめ", "よろしく", "お世話", "失礼", "本日"]):
            return random.choice([
                "ああ、こちらこそよろしくお願いします。田中です。本日はどういったご用件でしょうか？",
                "はい、田中です。本日はお時間をいただきありがとうございます。どんなご提案でしょうか？",
            ])
        return "…はい、田中ですが、何でしょうか？お時間があまりないので、要点をお願いします。"

    def _surface_response(self, msg: str) -> str:
        if any(kw in msg for kw in ["効率", "自動化", "改善", "業務"]):
            return random.choice([
                "ええ、まあ…うちも最近、業務の効率化は考えているんです。手作業が多くて大変で。",
                "効率化ですか。確かに、うちの現場は結構アナログな部分が多くて…何とかしたいとは思ってるんですが。",
            ])
        if any(kw in msg for kw in ["dx", "デジタル", "it", "システム", "ソフト"]):
            return random.choice([
                "DXですか…正直、うちの会社でそういうことができるのかよくわからなくて。",
                "ITとかは、あまり詳しくないんですよね。でも、何かしなきゃとは思ってます。",
            ])
        if any(kw in msg for kw in ["現状", "今", "どのよう", "どんな", "状況", "聞かせ"]):
            return random.choice([
                "現状ですか？受注管理とか在庫管理を、主にExcelでやってるんですが、それが結構大変で。",
                "まあ、いろいろと大変な部分はありますね。特に事務作業が…Excelとか紙が多くて。",
            ])
        if any(kw in msg for kw in ["困っ", "悩み", "課題", "問題"]):
            return random.choice([
                "困っていること？まあ、日々いろいろありますよ。特に、受注から出荷までの管理が煩雑で。",
                "課題ですか…業務全体がアナログすぎるかなとは思います。",
            ])
        return random.choice([
            "ええ、まあ…どんなことをご提案いただけるんでしょうか？",
            "なるほど。具体的にどういうことができるんですか？",
            "うちの会社に何か役立てることがあるんでしょうか？",
        ])

    def _middle_response(self, msg: str) -> str:
        if any(kw in msg for kw in ["受注", "注文", "発注", "受発注"]):
            return random.choice([
                "受注管理はうちの一番のネックで。お客さんからFAXや電話で注文が来て、それをExcelに手入力してるんですよ。入力ミスも多くて、先月も出荷間違いがあって…",
                "受注は全部手作業なんです。FAX受けて、Excelに打ち込んで、製造に回して…。正直、月末になると大変で。",
            ])
        if any(kw in msg for kw in ["在庫", "部品", "材料", "ざいこ"]):
            return random.choice([
                "在庫は…担当者が頭の中で把握してるっていうのが実情で。その担当者が休むと、途端に誰もわからなくなって困るんです。",
                "在庫管理も課題ですね。欠品したり、逆に材料を抱えすぎたりすることがあって。",
            ])
        if any(kw in msg for kw in ["人", "社員", "スタッフ", "従業員", "担当", "メンバー"]):
            return random.choice([
                "人材ですか…うちは50名くらいで、事務スタッフが5人いますが、みんな手一杯で。新しいことをやる余裕がなかなか。",
                "社員の問題でもあって…IT系が得意な社員がいないんですよね。若い子もいるんですが、そういうのが苦手で。",
            ])
        if any(kw in msg for kw in ["コスト", "費用", "価格", "いくら", "予算", "金額"]):
            return random.choice([
                "コストは気になりますね。うちは中小企業なので大きな投資はなかなか難しくて。費用対効果がはっきりしないと踏み切れません。",
                "予算は…年間で数百万円レベルが限界かなと思っています。あまり大きなことはできないです。",
            ])
        return random.choice([
            "そうですね…正直に言うと、受注管理と在庫管理が一番困っています。Excelでやってますが、限界を感じていて。",
            "もう少し詳しく教えていただけますか？うちの状況を説明するのが難しくて…",
            "なるほど。実は、具体的にどこが問題か自分でも整理できていなくて。",
        ])

    def _deep_response(self, msg: str) -> str:
        if any(kw in msg for kw in ["なぜ", "原因", "理由", "どうして", "根本", "本当"]):
            return random.choice([
                "（少し間があって）…正直に言うと、私自身がITが苦手なんです。新しいシステムを入れても自分が使いこなせるか不安で、なかなか踏み切れなかったというのがあります。",
                "本音を言うと…社内でDXを推進できる人間がいないんです。私も自信がなくて。導入しても続けられるか、という不安がずっとあって。",
            ])
        if any(kw in msg for kw in ["推進", "リーダー", "担当者", "主導", "責任", "誰が"]):
            return random.choice([
                "推進する人間が…そこが一番の問題かもしれません。社内にIT担当者がいなくて。私が旗を振らないといけないんですが、正直よくわからなくて。",
                "DXを引っ張れる社員がいないんですよね。それが一番の壁かもしれない。私自身も詳しくないし。",
            ])
        if any(kw in msg for kw in ["不安", "懸念", "心配", "リスク", "失敗", "怖"]):
            return random.choice([
                "不安はあります。前に一度、会計ソフトを変えようとして失敗したことがあって。そのトラウマがあって、なかなか新しいことに踏み切れなくて。",
                "失敗が怖いですね。うちみたいな小さな会社で失敗すると、ダメージが大きいので。",
            ])
        return random.choice([
            "（ためらいながら）…実は、一番の問題は、私自身のITへの苦手意識かもしれません。社内でも誰もITが得意じゃなくて、だからこそ踏み出せない部分があります。",
            "ここだけの話ですが…社内にDXを推進できる人材がいないんです。私も正直、ITは苦手で。だから、いつもやろうと思うんですが、なかなか動けなくて。",
            "実はずっと言えなかったんですが…私自身がITが得意じゃなくて。新しいシステムを入れても自分が使えるか、社員が使えるか、という不安が一番大きいんです。",
        ])

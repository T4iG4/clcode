"""
Claude API を使った SEO / LLMO 最適化コンテンツジェネレーター

SEO最適化のポイント:
  - 検索意図に合ったキーワードを自然に含む商品名
  - クリック率を高めるキャッチコピー
  - 構造化された商品説明（特徴・ベネフィット・スペック）

LLMO最適化のポイント:
  - AIが要約・引用しやすい明確な構造
  - FAQ形式でユーザーの疑問を先回り
  - エンティティ（ブランド・商品種別・属性）を明示
  - 権威性と信頼性のある文章トーン
"""

import json
import re
from dataclasses import dataclass
from typing import Optional

import anthropic

from .scraper import ProductInfo


@dataclass
class GeneratedContent:
    product_name: str          # SEO/LLMO最適化済み商品名
    catchphrase: str           # キャッチコピー
    description_short: str    # 短い商品説明（meta description / SNS用, ~120字）
    description_long: str      # 詳細な商品説明（商品ページ本文用）
    keywords: list[str]        # 推奨キーワードリスト
    faq: list[dict[str, str]]  # FAQ（LLMO対策）

    def to_markdown(self) -> str:
        lines = [
            "# 生成結果",
            "",
            "## 商品名（SEO/LLMO最適化）",
            self.product_name,
            "",
            "## キャッチコピー",
            self.catchphrase,
            "",
            "## 短い商品説明（meta description / SNS用）",
            self.description_short,
            "",
            "## 詳細な商品説明",
            self.description_long,
            "",
            "## 推奨キーワード",
        ]
        for kw in self.keywords:
            lines.append(f"- {kw}")
        lines += ["", "## FAQ（LLMO対策）"]
        for i, qa in enumerate(self.faq, 1):
            lines.append(f"\n### Q{i}. {qa['question']}")
            lines.append(f"**A.** {qa['answer']}")
        return "\n".join(lines)


SYSTEM_PROMPT = """あなたはECサイト向けのSEO・LLMO（大規模言語モデル最適化）の専門家です。
与えられた商品情報を分析し、以下の2つの観点で最適化されたコンテンツを生成してください。

【SEO最適化の原則】
- ターゲットキーワードを商品名・説明文の冒頭に自然に配置する
- 検索意図（情報収集・購買）を満たす具体的な記述をする
- 数値・固有名詞・スペックを積極的に含める
- 重複・水増し表現を避け、オリジナリティのある説明にする
- 商品名は30〜60文字が理想（モバイル検索での表示を意識）

【LLMO最適化の原則】
- AIが正確に情報を抽出・要約できるよう、主語・述語を明確にする
- 「誰に・何を・なぜ・どのように」の4要素を網羅する
- FAQ形式でユーザーの疑問を先回りして回答する
- ブランド・商品カテゴリ・主要属性をエンティティとして明示する
- 事実ベースで権威性のある文章にする（誇張表現を避ける）
- 箇条書きと文章を組み合わせてスキャナビリティを高める

必ず指定のJSON形式で返してください。"""


USER_PROMPT_TEMPLATE = """以下の商品情報をもとに、SEOとLLMOに最適化されたコンテンツを生成してください。

---
{product_text}
---

以下のJSON形式のみで返してください（マークダウンコードブロック不要）:
{{
  "product_name": "SEO/LLMO最適化された商品名（30〜60文字）",
  "catchphrase": "購買意欲を高めるキャッチコピー（20〜40文字）",
  "description_short": "meta descriptionやSNS用の短い説明（100〜120文字、キーワードを冒頭に配置）",
  "description_long": "商品ページ本文用の詳細説明（600〜1000文字）\\n\\n【ポイント】\\n・特徴1\\n・特徴2\\n・特徴3\\n\\n【こんな方におすすめ】\\n・ターゲット1\\n・ターゲット2\\n\\n【仕様・スペック】\\n主要なスペック情報",
  "keywords": ["キーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"],
  "faq": [
    {{"question": "よくある質問1", "answer": "回答1"}},
    {{"question": "よくある質問2", "answer": "回答2"}},
    {{"question": "よくある質問3", "answer": "回答3"}}
  ]
}}"""


def generate_content(
    product_info: ProductInfo,
    model: str = "claude-opus-4-6",
    api_key: Optional[str] = None,
) -> GeneratedContent:
    """
    ProductInfo を受け取り、SEO/LLMO最適化コンテンツを生成して返す。

    Args:
        product_info: スクレイピングで取得した商品情報
        model: 使用するClaudeモデル
        api_key: Anthropic APIキー（省略時は環境変数 ANTHROPIC_API_KEY を使用）
    """
    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

    product_text = product_info.to_text()
    if product_info.raw_text:
        product_text += f"\n\n【ページの追加情報】\n{product_info.raw_text[:1000]}"

    user_prompt = USER_PROMPT_TEMPLATE.format(product_text=product_text)

    message = client.messages.create(
        model=model,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()

    # JSONブロック除去（念のため）
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    data = json.loads(raw)

    return GeneratedContent(
        product_name=data.get("product_name", ""),
        catchphrase=data.get("catchphrase", ""),
        description_short=data.get("description_short", ""),
        description_long=data.get("description_long", ""),
        keywords=data.get("keywords", []),
        faq=data.get("faq", []),
    )

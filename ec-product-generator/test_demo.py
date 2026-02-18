#!/usr/bin/env python3
"""
動作確認用デモスクリプト
1. モックHTMLをスクレイピングして ProductInfo を取得
2. Claude API でコンテンツを生成（ANTHROPIC_API_KEY が設定されていれば実行）
"""

import sys
import os
import json
from unittest.mock import patch, MagicMock

# プロジェクトのルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ec_product_generator import scrape_product, generate_content
from ec_product_generator.scraper import ProductInfo, _parse_generic
from bs4 import BeautifulSoup

# ──────────────────────────────────────────────
# STEP 1: モックHTMLでスクレイパーをテスト
# ──────────────────────────────────────────────

MOCK_HTML = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>プロフェッショナル ノイズキャンセリングヘッドホン XNC-9000 | 音響堂</title>
  <meta name="description" content="最大40時間連続再生、業界最高水準のノイキャン性能を誇る完全ワイヤレスヘッドホン。">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "プロフェッショナル ノイズキャンセリングヘッドホン XNC-9000",
    "description": "AIアルゴリズムで周囲の騒音を99%カット。最大40時間連続再生で出張・通勤・テレワークをサポートするプレミアムヘッドホン。",
    "brand": {"@type": "Brand", "name": "音響堂"},
    "offers": {
      "@type": "Offer",
      "price": "29800",
      "priceCurrency": "JPY"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.6",
      "reviewCount": "1234"
    }
  }
  </script>
</head>
<body>
  <nav aria-label="パンくず">
    <a href="/">ホーム</a> &gt;
    <a href="/audio">オーディオ</a> &gt;
    <a href="/audio/headphones">ヘッドホン</a>
  </nav>

  <main id="product-detail">
    <h1>プロフェッショナル ノイズキャンセリングヘッドホン XNC-9000</h1>
    <p class="price">¥29,800（税込）</p>

    <section id="description">
      <h2>商品説明</h2>
      <p>音響堂が誇るフラッグシップモデル。独自開発のAIノイズキャンセリングチップが
      周囲の雑音をリアルタイム解析し、99%の騒音をカット。
      USB-C急速充電対応で10分充電すると3時間再生可能。</p>

      <ul>
        <li>最大40時間連続再生（ANC ON時30時間）</li>
        <li>Bluetooth 5.3 マルチポイント接続対応（最大3台同時接続）</li>
        <li>30mmドライバー搭載・Hi-Res Audio認証</li>
        <li>折りたたみ式・重量270g（軽量設計）</li>
        <li>IPX4防水規格対応</li>
      </ul>
    </section>

    <section id="reviews">
      <p>カスタマーレビュー: ★4.6（1,234件）</p>
      <p>「テレワーク中のZoom会議でも相手の声がクリアに聞こえる」</p>
      <p>「長時間装着しても耳が痛くならない」</p>
    </section>
  </main>
</body>
</html>"""

print("=" * 60)
print("STEP 1: スクレイパーのテスト（モックHTML使用）")
print("=" * 60)

soup = BeautifulSoup(MOCK_HTML, "html.parser")
product = _parse_generic(soup, "https://example.com/product/xnc-9000")

print(f"\n✓ 商品名    : {product.title}")
print(f"✓ ブランド  : {product.brand}")
print(f"✓ 価格      : {product.price}")
print(f"✓ カテゴリ  : {product.category}")
print(f"✓ 評価      : {product.rating}（{product.review_count}件）")
print(f"✓ 説明文    : {product.description[:60]}...")
print(f"✓ 生テキスト: {len(product.raw_text)} 文字取得")

print("\n─── ProductInfo.to_text() ───────────────────────────────")
print(product.to_text())

# ──────────────────────────────────────────────
# STEP 2: Claude API でコンテンツ生成
# ──────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2: コンテンツ生成テスト")
print("=" * 60)

api_key = os.environ.get("ANTHROPIC_API_KEY")
if api_key:
    print("\n✓ ANTHROPIC_API_KEY を検出。実際にAPIを呼び出します...\n")
    content = generate_content(product, model="claude-opus-4-6")
    print(content.to_markdown())
else:
    print("\n⚠ ANTHROPIC_API_KEY が未設定のため、モックレスポンスで動作を確認します。\n")

    # APIレスポンスをモック
    mock_response_json = {
        "product_name": "音響堂 XNC-9000 ノイズキャンセリングヘッドホン 40時間再生 Bluetooth5.3 Hi-Res対応",
        "catchphrase": "騒音ゼロ、集中力MAX。プロが選ぶ静寂。",
        "description_short": (
            "AIノイキャンで騒音99%カット。音響堂XNC-9000は最大40時間再生・"
            "マルチポイント接続対応のプレミアムヘッドホン。テレワーク・通勤に最適。"
        ),
        "description_long": (
            "音響堂のフラッグシップ「XNC-9000」は、独自AIチップが周囲の騒音を"
            "リアルタイム解析し業界最高水準の99%ノイズカットを実現するプレミアム"
            "ヘッドホンです。\n\n"
            "【ポイント】\n"
            "・最大40時間連続再生（ANC OFF）、ANC ONでも最大30時間の長時間駆動\n"
            "・Bluetooth 5.3 マルチポイント接続で最大3台のデバイスを同時管理\n"
            "・30mmドライバー＋Hi-Res Audio認証でスタジオクオリティのサウンド\n"
            "・USB-C急速充電対応（10分充電→3時間再生）\n"
            "・IPX4防水・折りたたみ式270gの軽量設計\n\n"
            "【こんな方におすすめ】\n"
            "・テレワーク・オンライン会議で音声品質を高めたい方\n"
            "・長距離通勤・出張が多いビジネスパーソン\n"
            "・ノイキャン音楽鑑賞を楽しみたいオーディオファン\n\n"
            "【仕様・スペック】\n"
            "接続: Bluetooth 5.3 / 再生時間: 最大40時間 / "
            "ドライバー: 30mm / 重量: 270g / 防水: IPX4"
        ),
        "keywords": [
            "ノイズキャンセリングヘッドホン テレワーク",
            "ワイヤレスヘッドホン 40時間再生",
            "音響堂 XNC-9000",
            "Bluetooth ヘッドホン マルチポイント",
            "Hi-Res Audio ヘッドホン 軽量",
        ],
        "faq": [
            {
                "question": "テレワーク中のオンライン会議でも使えますか？",
                "answer": (
                    "はい、マイク付きで通話品質も高く、AIノイキャンが周囲の雑音を"
                    "カットするためZoom・Teams・Google Meetでのクリアな音声通話に最適です。"
                ),
            },
            {
                "question": "充電はどのくらい時間がかかりますか？",
                "answer": (
                    "USB-C急速充電に対応しており、フル充電まで約2時間です。"
                    "10分の急速充電で約3時間の再生が可能です。"
                ),
            },
            {
                "question": "スマホとPCを同時に接続できますか？",
                "answer": (
                    "Bluetooth 5.3のマルチポイント接続により、最大3台のデバイスを"
                    "同時接続できます。スマホ・PC・タブレットを切り替えなしで使えます。"
                ),
            },
        ],
    }

    import importlib
    gen_mod = importlib.import_module("ec_product_generator.generator")

    mock_message = MagicMock()
    mock_message.content[0].text = json.dumps(mock_response_json, ensure_ascii=False)

    with patch.object(gen_mod.anthropic.Anthropic, "__init__", return_value=None), \
         patch.object(gen_mod.anthropic.Anthropic, "messages") as mock_msgs:
        mock_msgs.create.return_value = mock_message
        content = generate_content(product, model="claude-opus-4-6", api_key="mock")

    print(content.to_markdown())

print("\n" + "=" * 60)
print("✓ デモ完了")
print("=" * 60)

# EC商品ページ SEO/LLMO最適化コンテンツジェネレーター

ECサイトの商品ページURLを入力するだけで、**SEO対策・LLMO対策**に最適化された商品名・キャッチコピー・商品説明文を自動生成するCLIツールです。

## 生成されるコンテンツ

| 項目 | 説明 |
|------|------|
| **商品名** | 検索キーワードを自然に含む30〜60文字の最適化済み商品名 |
| **キャッチコピー** | 購買意欲を高める20〜40文字のコピー |
| **短い商品説明** | meta description・SNS用の100〜120文字説明 |
| **詳細な商品説明** | 特徴・おすすめ対象・スペックを含む600〜1000文字の本文 |
| **推奨キーワード** | SEO対策用キーワードリスト（5件） |
| **FAQ** | LLM検索に強いQ&A形式コンテンツ（3件） |

## 対応ECサイト

- **Amazon.co.jp** — 専用パーサーで商品タイトル・特徴・仕様・レビューを取得
- **楽天市場** — 専用パーサーで商品情報を取得
- **Yahoo!ショッピング** — 専用パーサーで商品情報を取得
- **その他のECサイト** — JSON-LD / Open Graph / HTMLヒューリスティクスで汎用対応

## セットアップ

```bash
# リポジトリのルートから
cd ec-product-generator

# 依存パッケージのインストール
pip install -r requirements.txt

# Anthropic APIキーを環境変数に設定
export ANTHROPIC_API_KEY=sk-ant-...
```

## 使い方

```bash
# 基本的な使い方（マークダウン形式で出力）
python main.py https://www.amazon.co.jp/dp/XXXXXXXXXX

# JSON形式で出力
python main.py https://item.rakuten.co.jp/shop/item/ --output json

# ファイルに保存
python main.py https://example.com/product --out result.md

# スクレイピング結果のみ確認（AIコンテンツ生成なし）
python main.py https://example.com/product --scrape-only

# 使用モデルを指定
python main.py https://example.com/product --model claude-opus-4-6
```

### オプション一覧

```
positional arguments:
  url                   商品ページのURL

options:
  --model MODEL         使用するClaudeモデル (デフォルト: claude-opus-4-6)
  --output {markdown,json,text}
                        出力フォーマット (デフォルト: markdown)
  --out FILE            結果をファイルに保存
  --api-key API_KEY     Anthropic APIキー（省略時は環境変数を使用）
  --scrape-only         スクレイピング結果のみ表示
```

## 出力例（マークダウン形式）

```markdown
# 生成結果

## 商品名（SEO/LLMO最適化）
ソニー ワイヤレスノイズキャンセリングヘッドホン WH-1000XM5 ブラック 最大30時間再生

## キャッチコピー
業界最高クラスのノイキャンで、集中を極める

## 短い商品説明（meta description / SNS用）
ソニーの最高峰ノイズキャンセリングヘッドホン。AIで環境音を自動認識し最大30時間の長時間再生を実現。テレワーク・通勤・音楽鑑賞に最適。

## 詳細な商品説明
...（600〜1000文字）

## 推奨キーワード
- ワイヤレスヘッドホン ノイズキャンセリング
- ソニー WH-1000XM5
...

## FAQ（LLMO対策）

### Q1. このヘッドホンはテレワークに向いていますか？
**A.** はい、...
```

## SEO / LLMO 最適化の考え方

### SEO最適化
- 主要キーワードを商品名・説明文冒頭に自然に配置
- 検索意図（情報収集・比較・購買）を満たす具体的な記述
- 数値・スペック・固有名詞を明示して信頼性を向上
- meta descriptionの適切な文字数（120文字前後）管理

### LLMO最適化（AI検索対策）
- ChatGPT・Perplexity・Gemini等のAI検索でも正確に引用されるよう、主語・述語・事実を明確化
- FAQ形式で「誰が・何を・なぜ・どのように」を網羅
- ブランド名・商品カテゴリ・主要属性をエンティティとして繰り返し明示
- 権威性のある文章で信頼スコアを向上

## ライセンス

MIT

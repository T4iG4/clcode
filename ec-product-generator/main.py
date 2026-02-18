#!/usr/bin/env python3
"""
EC商品ページ SEO/LLMO最適化コンテンツジェネレーター

使い方:
  python main.py <商品ページURL> [オプション]

例:
  python main.py https://www.amazon.co.jp/dp/B0XXXXXXXX
  python main.py https://item.rakuten.co.jp/shop/item/ --output json
  python main.py https://example.com/product --model claude-opus-4-6 --out result.md
"""

import argparse
import json
import os
import sys

from ec_product_generator import scrape_product, generate_content


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ECサイトの商品URLからSEO/LLMO最適化コンテンツを自動生成します",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("url", help="商品ページのURL")
    parser.add_argument(
        "--model",
        default="claude-opus-4-6",
        help="使用するClaudeモデル (デフォルト: claude-opus-4-6)",
    )
    parser.add_argument(
        "--output",
        choices=["markdown", "json", "text"],
        default="markdown",
        help="出力フォーマット: markdown / json / text (デフォルト: markdown)",
    )
    parser.add_argument(
        "--out",
        metavar="FILE",
        help="結果をファイルに保存する場合はパスを指定",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Anthropic APIキー (省略時は環境変数 ANTHROPIC_API_KEY を使用)",
    )
    parser.add_argument(
        "--scrape-only",
        action="store_true",
        help="スクレイピング結果のみ表示（AIコンテンツ生成なし）",
    )
    return parser.parse_args()


def step(msg: str) -> None:
    print(f"\033[36m▶ {msg}\033[0m", file=sys.stderr)


def success(msg: str) -> None:
    print(f"\033[32m✓ {msg}\033[0m", file=sys.stderr)


def error(msg: str) -> None:
    print(f"\033[31m✗ {msg}\033[0m", file=sys.stderr)


def main() -> None:
    args = parse_args()

    # APIキーチェック（scrape-onlyでない場合）
    if not args.scrape_only:
        api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            error(
                "ANTHROPIC_API_KEY が設定されていません。\n"
                "  export ANTHROPIC_API_KEY=sk-ant-... を実行するか、\n"
                "  --api-key オプションで指定してください。"
            )
            sys.exit(1)
    else:
        api_key = None

    # ─── Step 1: スクレイピング ───
    step(f"商品ページを取得中: {args.url}")
    try:
        product_info = scrape_product(args.url)
        success(f"スクレイピング完了: {product_info.title or '(タイトル未取得)'}")
    except Exception as e:
        error(f"スクレイピングに失敗しました: {e}")
        sys.exit(1)

    if args.scrape_only:
        print("\n" + product_info.to_text())
        return

    # ─── Step 2: AI コンテンツ生成 ───
    step(f"SEO/LLMOコンテンツを生成中 (モデル: {args.model}) ...")
    try:
        content = generate_content(
            product_info,
            model=args.model,
            api_key=api_key,
        )
        success("コンテンツ生成完了")
    except Exception as e:
        error(f"コンテンツ生成に失敗しました: {e}")
        sys.exit(1)

    # ─── Step 3: 出力 ───
    if args.output == "json":
        output_text = json.dumps(
            {
                "product_name": content.product_name,
                "catchphrase": content.catchphrase,
                "description_short": content.description_short,
                "description_long": content.description_long,
                "keywords": content.keywords,
                "faq": content.faq,
                "source_url": args.url,
                "scraped": {
                    "title": product_info.title,
                    "brand": product_info.brand,
                    "price": product_info.price,
                    "category": product_info.category,
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    elif args.output == "text":
        lines = [
            "=" * 60,
            "【商品名】",
            content.product_name,
            "",
            "【キャッチコピー】",
            content.catchphrase,
            "",
            "【短い商品説明】",
            content.description_short,
            "",
            "【詳細な商品説明】",
            content.description_long,
            "",
            "【推奨キーワード】",
            "、".join(content.keywords),
            "",
            "【FAQ】",
        ]
        for i, qa in enumerate(content.faq, 1):
            lines.append(f"Q{i}. {qa['question']}")
            lines.append(f"A.  {qa['answer']}")
            lines.append("")
        lines.append("=" * 60)
        output_text = "\n".join(lines)
    else:
        output_text = content.to_markdown()

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output_text)
        success(f"結果を保存しました: {args.out}")
    else:
        print("\n" + output_text)


if __name__ == "__main__":
    main()

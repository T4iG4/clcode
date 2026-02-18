"""
ECサイト商品ページのスクレイパー
対応サイト: Amazon.co.jp, 楽天市場, Yahoo!ショッピング, 汎用ECサイト
"""

import re
import time
import random
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


@dataclass
class ProductInfo:
    url: str
    title: str = ""
    price: str = ""
    brand: str = ""
    category: str = ""
    description: str = ""
    features: list[str] = field(default_factory=list)
    specs: dict[str, str] = field(default_factory=dict)
    review_summary: str = ""
    rating: str = ""
    review_count: str = ""
    raw_text: str = ""

    def to_text(self) -> str:
        """スクレイピング結果をテキストとしてまとめる"""
        parts = []
        if self.title:
            parts.append(f"商品名: {self.title}")
        if self.brand:
            parts.append(f"ブランド: {self.brand}")
        if self.price:
            parts.append(f"価格: {self.price}")
        if self.category:
            parts.append(f"カテゴリ: {self.category}")
        if self.description:
            parts.append(f"\n商品説明:\n{self.description}")
        if self.features:
            parts.append(f"\n特徴・仕様:\n" + "\n".join(f"・{f}" for f in self.features))
        if self.specs:
            parts.append("\nスペック:")
            for k, v in self.specs.items():
                parts.append(f"  {k}: {v}")
        if self.rating:
            parts.append(f"\n評価: {self.rating} ({self.review_count}件のレビュー)")
        if self.review_summary:
            parts.append(f"レビュー概要:\n{self.review_summary}")
        return "\n".join(parts)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _get_html(url: str, timeout: int = 15) -> str:
    """URLからHTMLを取得する"""
    session = requests.Session()
    session.headers.update(HEADERS)
    # 短いランダム待機でボット検出を回避
    time.sleep(random.uniform(0.5, 1.5))
    resp = session.get(url, timeout=timeout, allow_redirects=True)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def _clean_text(text: str) -> str:
    """余分な空白・改行を除去"""
    return re.sub(r"\s+", " ", text).strip()


# ─────────────────────────────────────────────
# Amazon.co.jp 専用パーサー
# ─────────────────────────────────────────────
def _parse_amazon(soup: BeautifulSoup, url: str) -> ProductInfo:
    info = ProductInfo(url=url)

    # 商品名
    title_el = soup.select_one("#productTitle, #title span")
    if title_el:
        info.title = _clean_text(title_el.get_text())

    # ブランド
    brand_el = soup.select_one("#bylineInfo, #brand")
    if brand_el:
        info.brand = _clean_text(brand_el.get_text())

    # 価格
    price_el = soup.select_one(
        ".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, "
        ".priceToPay .a-offscreen"
    )
    if price_el:
        info.price = _clean_text(price_el.get_text())

    # カテゴリ（パンくず）
    breadcrumb = soup.select("#wayfinding-breadcrumbs_feature_div li")
    if breadcrumb:
        info.category = " > ".join(
            _clean_text(b.get_text()) for b in breadcrumb if _clean_text(b.get_text())
        )

    # 商品説明（feature bullets）
    bullets = soup.select("#feature-bullets li span.a-list-item")
    for b in bullets:
        text = _clean_text(b.get_text())
        if text:
            info.features.append(text)

    # 商品説明文
    desc_el = soup.select_one("#productDescription p, #productDescription")
    if desc_el:
        info.description = _clean_text(desc_el.get_text())

    # 仕様テーブル
    for row in soup.select("#productDetails_techSpec_section_1 tr, "
                           "#productDetails_detailBullets_sections1 tr"):
        cells = row.select("th, td")
        if len(cells) >= 2:
            key = _clean_text(cells[0].get_text())
            val = _clean_text(cells[1].get_text())
            if key and val:
                info.specs[key] = val

    # レビュー
    rating_el = soup.select_one("#acrPopover span.a-icon-alt")
    if rating_el:
        info.rating = _clean_text(rating_el.get_text())
    count_el = soup.select_one("#acrCustomerReviewText")
    if count_el:
        info.review_count = _clean_text(count_el.get_text())

    # レビューテキスト（上位3件）
    reviews = soup.select(".review-text-content span")
    review_texts = [_clean_text(r.get_text()) for r in reviews[:3] if r.get_text().strip()]
    if review_texts:
        info.review_summary = "\n".join(review_texts)

    return info


# ─────────────────────────────────────────────
# 楽天市場 専用パーサー
# ─────────────────────────────────────────────
def _parse_rakuten(soup: BeautifulSoup, url: str) -> ProductInfo:
    info = ProductInfo(url=url)

    # 商品名
    title_el = soup.select_one("h1.item_name, h1.b-ttl-main, [itemprop='name']")
    if title_el:
        info.title = _clean_text(title_el.get_text())

    # 価格
    price_el = soup.select_one(
        "span.price2, .price--OFiZs, [class*='price'] span, [itemprop='price']"
    )
    if price_el:
        info.price = price_el.get("content") or _clean_text(price_el.get_text())

    # 商品説明
    desc_el = soup.select_one(
        "#item-description, .item-description, [id*='description'], "
        "[class*='description']"
    )
    if desc_el:
        info.description = _clean_text(desc_el.get_text())

    # 評価
    rating_el = soup.select_one("[class*='review'] [class*='rate'], [itemprop='ratingValue']")
    if rating_el:
        info.rating = rating_el.get("content") or _clean_text(rating_el.get_text())

    return info


# ─────────────────────────────────────────────
# Yahoo!ショッピング 専用パーサー
# ─────────────────────────────────────────────
def _parse_yahoo_shopping(soup: BeautifulSoup, url: str) -> ProductInfo:
    info = ProductInfo(url=url)

    title_el = soup.select_one("h1.ItemDetail__name, [data-e2e='item-name'], h1")
    if title_el:
        info.title = _clean_text(title_el.get_text())

    price_el = soup.select_one(
        "[class*='Price__selling'], [class*='price-selling'], [itemprop='price']"
    )
    if price_el:
        info.price = price_el.get("content") or _clean_text(price_el.get_text())

    desc_el = soup.select_one(
        "[class*='Description'], [id*='description'], [class*='description']"
    )
    if desc_el:
        info.description = _clean_text(desc_el.get_text())

    rating_el = soup.select_one("[itemprop='ratingValue'], [class*='Rating']")
    if rating_el:
        info.rating = rating_el.get("content") or _clean_text(rating_el.get_text())

    return info


# ─────────────────────────────────────────────
# 汎用パーサー（Open Graph / JSON-LD / HTMLヒューリスティクス）
# ─────────────────────────────────────────────
def _parse_generic(soup: BeautifulSoup, url: str) -> ProductInfo:
    import json

    info = ProductInfo(url=url)

    # JSON-LDから商品情報を取得
    for script in soup.select("script[type='application/ld+json']"):
        try:
            data = json.loads(script.string or "")
            # リスト形式の場合もある
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") in ("Product", "ItemPage"):
                    info.title = info.title or item.get("name", "")
                    info.description = info.description or item.get("description", "")
                    info.brand = info.brand or (
                        item.get("brand", {}).get("name", "")
                        if isinstance(item.get("brand"), dict)
                        else item.get("brand", "")
                    )
                    offers = item.get("offers", {})
                    if isinstance(offers, list):
                        offers = offers[0] if offers else {}
                    info.price = info.price or str(offers.get("price", ""))
                    agg = item.get("aggregateRating", {})
                    info.rating = info.rating or str(agg.get("ratingValue", ""))
                    info.review_count = info.review_count or str(agg.get("reviewCount", ""))
        except (json.JSONDecodeError, AttributeError):
            pass

    # Open Graph
    og_title = soup.select_one("meta[property='og:title']")
    og_desc = soup.select_one("meta[property='og:description']")
    if og_title and not info.title:
        info.title = og_title.get("content", "")
    if og_desc and not info.description:
        info.description = og_desc.get("content", "")

    # meta description
    if not info.description:
        meta_desc = soup.select_one("meta[name='description']")
        if meta_desc:
            info.description = meta_desc.get("content", "")

    # h1タグ（フォールバック）
    if not info.title:
        h1 = soup.select_one("h1")
        if h1:
            info.title = _clean_text(h1.get_text())

    # 価格フォールバック: itemprop="price"
    if not info.price:
        price_el = soup.select_one("[itemprop='price']")
        if price_el:
            info.price = price_el.get("content") or _clean_text(price_el.get_text())

    # ブランドフォールバック: itemprop="brand"
    if not info.brand:
        brand_el = soup.select_one("[itemprop='brand']")
        if brand_el:
            info.brand = brand_el.get("content") or _clean_text(brand_el.get_text())

    # カテゴリ（パンくず）
    breadcrumbs = soup.select("[itemtype*='BreadcrumbList'] [itemprop='name'], "
                              "nav[aria-label*='read'] a, .breadcrumb a, "
                              "[class*='breadcrumb'] a")
    if breadcrumbs:
        info.category = " > ".join(
            _clean_text(b.get_text()) for b in breadcrumbs if _clean_text(b.get_text())
        )

    # メインコンテンツから追加テキストを収集
    # <main>, <article>, id/class に "product", "item", "detail" を含む要素を優先
    main_el = (
        soup.select_one("main, article, [id*='product'], [id*='item'], [class*='product-detail']")
        or soup.body
    )
    if main_el:
        # スクリプト・スタイル・ナビゲーションを除外してテキスト取得
        for tag in main_el.select("script, style, nav, header, footer, aside"):
            tag.decompose()
        raw = _clean_text(main_el.get_text())
        # 長すぎる場合は先頭2000文字のみ
        info.raw_text = raw[:2000]

    return info


# ─────────────────────────────────────────────
# 公開API
# ─────────────────────────────────────────────
def scrape_product(url: str) -> ProductInfo:
    """
    ECサイトの商品ページURLを受け取り、ProductInfo を返す。
    サイトを自動判別して適切なパーサーを選択する。
    """
    html = _get_html(url)
    soup = BeautifulSoup(html, "html.parser")
    domain = urlparse(url).netloc.lower()

    if "amazon.co.jp" in domain or "amazon.com" in domain:
        info = _parse_amazon(soup, url)
    elif "rakuten.co.jp" in domain or "item.rakuten" in domain:
        info = _parse_rakuten(soup, url)
    elif "shopping.yahoo.co.jp" in domain:
        info = _parse_yahoo_shopping(soup, url)
    else:
        info = _parse_generic(soup, url)

    # 汎用パーサーで補完（専用パーサーで取れなかった項目）
    if not info.title or not info.description:
        generic = _parse_generic(soup, url)
        info.title = info.title or generic.title
        info.description = info.description or generic.description
        info.brand = info.brand or generic.brand
        info.price = info.price or generic.price
        info.category = info.category or generic.category
        info.rating = info.rating or generic.rating
        info.review_count = info.review_count or generic.review_count
        info.raw_text = info.raw_text or generic.raw_text

    return info

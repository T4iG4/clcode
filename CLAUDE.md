# CLAUDE.md

## コードスタイル
- ES modules (import/export) を使う。CommonJS (require) は使わない
- 可能な限り import を分割する (e.g. import { foo } from 'bar')

## ワークフロー
- コード変更が終わったら必ず型チェックを実行
- テストスイート全体ではなく、単一テストの実行を優先（パフォーマンスのため）

## 禁止事項
- モック・ダミー実装は禁止。必要なら許可を得ること
- 指示にない機能追加は禁止
- console.log を本番コードに残さない

## 注意点
- src/legacy/ 配下は触らない（リファクタリング対象外）
- 環境変数 DATABASE_URL が必要

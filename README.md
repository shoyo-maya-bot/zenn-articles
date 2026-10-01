# zenn-articles

Zennに公開するAI活用記事のリポジトリです。

## 置き場所

- `articles/` … 記事（1記事1ファイル）。ファイル名はa-z0-9・`-`・`_`の12〜50文字。
- `scripts/check-frontmatter.mjs` … 記事のfront matterのチェック
- `.markdownlint-cli2.jsonc` … Markdownのlint設定
- `.github/workflows/check-articles.yml` … PRのたびに上の2つを自動で実行

## 運用ルール

- 記事の追加や修正は、ブランチを切ってPRで出す。mainに直接pushしない。
- チェックが通ったPRだけをmainにマージする。mainへのマージでZennに反映される。
- 下書きは `published: false`、公開するときに `true` にする。

## 手元でチェックする

```bash
npx markdownlint-cli2 "articles/*.md"
node scripts/check-frontmatter.mjs
```

---
title: "ドキュメントもGitHubで管理しよう：PRレビューとGitHub Actionsで自動チェック"
emoji: "📚"
type: "tech"
topics: ["github", "githubactions", "markdown", "ai", "初心者"]
published: false
---

仕様書や手順書を、WordやExcelで共有フォルダに置いていないでしょうか。「最新版はどれ？」「誰がどこを変えた？」が分からなくなるのは、よくある悩みです。

ドキュメントも、コードと同じようにGitHubで管理できます。変更はPR（プルリクエスト）でレビューし、書式のミスはGitHub Actionsで自動チェックする。この記事では、その始め方を紹介します。

例として、Zennの記事をGitHubで管理しているリポジトリを使います。仕様書でも社内Wikiでも、Markdownで書くものなら同じ考え方で使えます。

## なぜドキュメントをGitHubで管理するのか

ドキュメントをコードと同じ仕組みで管理する考え方は「Docs as Code」と呼ばれます。主なメリットは次の4つです。

- **履歴が残る。** いつ、誰が、何を、なぜ変えたかが全部残ります。「前の版に戻したい」もすぐできます。
- **差分が見える。** 変更点だけを行単位で確認できます。WordとExcelでは難しいところです。
- **レビューできる。** 変更をPRにすれば、公開や反映の前に他の人がチェックできます。
- **自動チェックできる。** 書式のミスや必須項目の漏れを、人の代わりに機械が見つけてくれます。

そして、AIとの相性も抜群です。Markdownのファイルがリポジトリにあれば、エージェント型のAIがそのまま読めます。仕様書をMarkdown化してリポジトリに置くことは、AIに良いinputを渡すハーネス整備でもあります（ハーネスについては別の記事で書いています）。

## 全体の流れ

この記事で作る流れは、次のとおりです。

1. 作業用のブランチを作り、ドキュメントを書く
2. PRを作る
3. GitHub Actionsが、Markdownの書式とfront matterを自動でチェックする
4. 人（やAI）がPRをレビューする
5. チェックとレビューが通ったら、mainにマージする

mainに入ったものだけが「正式な版」になります。Zennの場合は、mainにマージされた時点で記事が反映されます。

## 手順1：フォルダ構成を決める

まずは、どこに何を置くかを決めます。Zennのリポジトリなら、次のような構成です。

```text
zenn-articles/
  articles/                  ← 記事（1記事1ファイル）
  scripts/
    check-frontmatter.mjs    ← front matterのチェック（後で作ります）
  .github/
    workflows/
      check-articles.yml     ← GitHub Actionsの設定（後で作ります）
    pull_request_template.md ← PRのテンプレート
  .markdownlint-cli2.jsonc   ← Markdownのlint設定
  README.md
```

仕様書なら、`docs/` の下に機能ごとのフォルダを切るのが一般的です。大事なのは、置き場所のルールをREADMEに書いておくことです。人もAIも、READMEを見れば迷いません。

## 手順2：PRでレビューする流れにする

### ブランチを切ってPRを作る

mainに直接pushするのではなく、作業ごとにブランチを切ります。

```bash
git switch -c add-github-docs-article
# 記事を書く
git add articles/github-docs-pr-review-actions-lint.md
git commit -m "記事を追加：GitHubでのドキュメント管理"
git push -u origin add-github-docs-article
```

pushすると、GitHubの画面に「Compare & pull request」ボタンが出ます。そこからPRを作れます。

### PRテンプレートを用意する

`.github/pull_request_template.md` を置くと、PRを作るたびにその内容が本文に入ります。レビューで毎回確認したいことを、チェックリストにしておきましょう。

```markdown
## 変更内容
<!-- 何を書いた・直したかを1〜2行で -->

## チェックリスト
- [ ] タイトルと内容が合っている
- [ ] 社外に出してはいけない情報が入っていない
- [ ] コードやプロンプトの例を実際に試した
- [ ] 公開してよい状態なら published: true にした
```

### mainを守るルールを設定する

リポジトリの Settings にある Rules（ルールセット）から、mainブランチに対してルールを設定できます。おすすめは次の2つです。

- **PRを通さないとマージできないようにする**
- **GitHub Actionsのチェックが通らないとマージできないようにする**

一人で運用しているリポジトリなら、レビュー承認の必須まではつけなくても大丈夫です。チェックが通ることだけを必須にしておくと、ミスがmainに入るのを防げます。画面の項目名は変わることがあるので、詳しくはGitHubの公式ドキュメントを確認してください。

## 手順3：GitHub ActionsでMarkdownをlintする

lint（リント）は、書式のミスや書き方のばらつきを機械的に見つける仕組みです。Markdownには、markdownlint というツールがよく使われます。

### まずは手元で試す

いきなりGitHub Actionsに入れる前に、手元で一度かけてみましょう。Node.jsが入っていれば、インストールなしで試せます。

```bash
npx markdownlint-cli2 "articles/*.md"
```

このシリーズの記事に実際にかけてみたところ、次のような指摘が出ました。

| ルール | 内容 | 対応 |
| --- | --- | --- |
| MD036 | 太字を見出し代わりに使っている | わざとそう書いているので、ルールを外す |
| MD028 | 引用ブロックの間に空行がある | 表示が崩れる環境があるので、直す |
| MD060 | 表の区切り線の空白がそろっていない | 見た目に影響しないので、ルールを外す |

ここで大事なのは、**全部の指摘に従う必要はない**ということです。チームの書き方として意図しているものは、設定でルールを外します。

### ルールを設定する

リポジトリの直下に `.markdownlint-cli2.jsonc` を置きます。

```jsonc
{
  "config": {
    "default": true,
    // 日本語は1行が長くなりやすいので、行の長さはチェックしない
    "MD013": false,
    // 太字を小見出しとして使うことを許可する
    "MD036": false,
    // 表の空白のそろえ方は問わない
    "MD060": false
  }
}
```

`"default": true` で全ルールを有効にしたうえで、合わないものだけ `false` にしています。外したルールには、なぜ外したかをコメントで残しておきましょう。後から見た人（とAI）が迷いません。

## 手順4：front matterを自動チェックする

Zennの記事の先頭には、front matterという設定欄があります。

```yaml
---
title: "記事のタイトル"
emoji: "📚"
type: "tech"
topics: ["github", "markdown"]
published: false
---
```

ここを間違えると、記事が正しく反映されません。Zennの公式ガイドでは、主に次のルールが決まっています。

- emoji は絵文字1つ
- type は `tech`（技術記事）か `idea`（アイデア記事）
- topics は5つまで
- published は `true`（公開）か `false`（下書き）
- ファイル名（slug）は、a-z0-9・ハイフン・アンダースコアの12〜50文字

これをチェックするスクリプトを `scripts/check-frontmatter.mjs` に置きます。追加のパッケージなしで、Node.jsだけで動きます。

```js
// scripts/check-frontmatter.mjs
// Zenn の記事（articles/*.md）の front matter をチェックするスクリプト
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const dir = "articles";
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
const errors = [];

for (const file of files) {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  const err = (msg) => errors.push(`${path}: ${msg}`);

  // ファイル名（slug）: a-z0-9、ハイフン、アンダースコアで12〜50文字
  const slug = basename(file, ".md");
  if (!/^[a-z0-9_-]{12,50}$/.test(slug)) {
    err("ファイル名は a-z0-9・-・_ の12〜50文字にしてください");
  }

  // 先頭の --- と --- の間を front matter として取り出す
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    err("先頭に front matter（---で囲まれた部分）がありません");
    continue;
  }
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }

  const unquote = (v) => (v ?? "").replace(/^"(.*)"$/, "$1");

  if (!unquote(fm.title)) err("title が空です");

  const emoji = unquote(fm.emoji);
  const graphemes = [...new Intl.Segmenter().segment(emoji)];
  if (graphemes.length !== 1 || !/\p{Extended_Pictographic}/u.test(emoji)) {
    err("emoji は絵文字1つにしてください");
  }

  if (!["tech", "idea"].includes(unquote(fm.type))) {
    err('type は "tech" か "idea" にしてください');
  }

  let topics = [];
  try {
    topics = JSON.parse(fm.topics ?? "");
  } catch {
    err('topics は ["ai", "aws"] の形で書いてください');
  }
  if (!Array.isArray(topics) || topics.length === 0 || topics.length > 5) {
    err("topics は1〜5個にしてください");
  }

  if (!["true", "false"].includes(fm.published)) {
    err("published は true か false にしてください");
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} 件のエラーがあります`);
  process.exit(1);
}
console.log(`${files.length} 件の記事をチェックしました。問題ありません`);
```

手元で `node scripts/check-frontmatter.mjs` と実行すると、問題があればこのように教えてくれます。

```text
articles/Bad_Slug.md: ファイル名は a-z0-9・-・_ の12〜50文字にしてください
articles/Bad_Slug.md: emoji は絵文字1つにしてください
articles/Bad_Slug.md: topics は1〜5個にしてください

3 件のエラーがあります
```

エラーメッセージは日本語で、直し方が分かる書き方にしておくのがポイントです。エラーを見た人も、AIも、すぐに直せます。

:::message
このスクリプトは、この記事のような1行ずつの書き方を前提にした簡易版です。topics を複数行で書く書き方などには対応していません。もっと厳密にしたい場合は、YAMLを読むライブラリを使いましょう。
:::

## 手順5：GitHub Actionsの設定を書く

最後に、PRのたびに2つのチェックが自動で走るようにします。`.github/workflows/check-articles.yml` を作ります。

```yaml
name: Check articles

on:
  pull_request:
    paths:
      - "articles/**"
      - ".markdownlint-cli2.jsonc"
      - "scripts/**"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          package-manager-cache: false

      - name: Markdownのlint
        uses: DavidAnson/markdownlint-cli2-action@v24
        with:
          globs: "articles/*.md"

      - name: front matterのチェック
        run: node scripts/check-frontmatter.mjs
```

上から順に、こういう意味です。

1. **on:** 記事や設定ファイルが変わったPRのときだけ動かす
2. **checkout:** リポジトリのファイルを取ってくる
3. **setup-node:** Node.jsを用意する
4. **markdownlint-cli2-action:** articles/ のMarkdownをlintする
5. **run:** さっき作ったfront matterのチェックを実行する

これをpushしてPRを作ると、PRの画面の下にチェックの結果が表示されます。失敗したら、「Details」から何が引っかかったかを確認できます。

なお、`@v7` や `@v24` はアクションのバージョンです。各アクションは定期的に更新されるので、使う前にそれぞれのGitHubのReleasesで最新版を確認してください。

## AIにもレビューしてもらう

チェックが機械で済む部分を自動化したら、人のレビューは中身に集中できます。さらに、PRのレビューをAIに手伝ってもらうこともできます。GitHub Copilotのコードレビュー機能や、Claude CodeのGitHub連携などがあり、PRにAIのレビューコメントを付けられます。設定方法はツールごとに違うので、各公式ドキュメントを確認してください。

AIにドキュメントのレビューを頼むときは、観点をはっきり書くと精度が上がります。

> このPRの記事を、AIに詳しくない初心者の読者の目でレビューしてください。分かりにくい用語、説明が飛んでいる箇所、事実として確認が必要な記述を、重要な順に挙げてください。

役割分担は、こう考えると分かりやすいです。

| チェックする人 | 得意なこと |
| --- | --- |
| GitHub Actions | 書式、必須項目、命名ルールなど、白黒はっきりするもの |
| AI | 分かりやすさ、説明の抜け、表現のばらつき |
| 人 | 事実が正しいか、出してよい内容か、最終判断 |

ハーネスの記事で、「絶対に毎回やらせたいことはHooksで仕組みにする」と書きました。GitHub Actionsは、その考え方をチーム全体に広げたものです。誰が書いても、AIが書いても、同じチェックを必ず通ります。

## よくある失敗

**最初からルールを厳しくしすぎる**
markdownlintのルールを全部有効にすると、既存のドキュメントで大量のエラーが出ます。最初は合わないルールを外し、慣れてから少しずつ増やしましょう。

**エラーが出るたびにルールを外す**
逆に、面倒だからと何でも外すと、チェックの意味がなくなります。外すのは「チームの書き方として意図しているもの」だけにしましょう。外した理由は、設定ファイルにコメントで残します。

**mainに直接pushできるままにしている**
チェックを作っても、mainに直接pushされたら素通りです。ルールセットで、PRとチェックを必須にしておきましょう。

**アクションのバージョンを古いまま放置する**
GitHub Actionsの実行環境は、少しずつ更新されています。古いバージョンのアクションが、ある日突然動かなくなることもあります。ときどきReleasesを確認するか、GitHubのDependabotでバージョン更新のPRを自動で作らせると安心です。

## まとめ

ドキュメントをGitHubで管理すると、履歴、差分、レビュー、自動チェックがすべて手に入ります。

1. Markdownでリポジトリに置く
2. PRでレビューする
3. 書式とfront matterはGitHub Actionsでチェックする
4. 中身はAIと人でレビューする

機械にできることは機械に任せ、人は「何を書くか」に集中する。AIが書いた文章が増えるこれからこそ、こうした仕組みが効いてきます。

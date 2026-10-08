---
title: "AIと作る公開リポジトリの守り方：無料でできるルールセット・SHA固定・Dependabot・CodeQL"
emoji: "🛡️"
type: "tech"
topics: ["github", "githubactions", "security", "dependabot", "ai"]
published: false
---

AIにコードを書かせて、GitHubで公開する。とても手軽になりましたが、守りの設定は後回しになりがちです。

この記事では、15個の公開リポジトリに**無料で**入れた守りの設定を、手順つきで紹介します。AIがmainに直接pushする運用でも困らない形にしています。

題材は [shoyo-maya-bot](https://github.com/shoyo-maya-bot) のリポジトリ群です。

## 全体像

| 守り | 防ぐもの | だれが設定するか |
| --- | --- | --- |
| ルールセット | mainの削除・履歴の書き換え | 人（設定画面） |
| 非公開の脆弱性報告 | 脆弱性が公開のIssueに書かれる | 人（設定画面） |
| Dependabot alerts | 依存の既知の脆弱性に気づかない | 人（設定画面） |
| `SECURITY.md` | 報告の方法が分からない | AIでも書ける |
| `CODEOWNERS` | だれがレビューするか決まっていない | AIでも書ける |
| CodeQL | コードの脆弱性 | AIでも書ける |
| ActionsのSHA固定 | 使っているActionが差し替えられる | AIでも書ける |
| Dependabot（更新） | 依存が古いまま | AIでも書ける |
| gitleaks | 秘密情報をコミットする | AIでも書ける |

上の3つは、リポジトリの設定を変える操作です。AIのセッションからは変えられないことが多いので、人がやります。下の6つはファイルを置くだけなので、AIに任せられます。

## 1. ルールセット：mainの削除と強制pushを禁止

GitHubのルールセットは、JSONで書いて読み込めます。リポジトリが多いときに便利です。

```json
{
  "name": "protect-default-branch",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ],
  "bypass_actors": []
}
```

読み込む手順です。

1. リポジトリの **Settings** → **Rules** → **Rulesets**
2. **New ruleset** の▼ → **Import a ruleset** → JSONを選ぶ
3. Enforcement statusが **Active** なのを確かめて **Create**

### あえて入れなかったもの

「PR必須」「CI合格必須」「レビュー必須」は、最初は入れていません。理由は2つです。

- AIがmainに直接pushして作業しているので、入れると作業が止まる
- 1人のアカウントだと、自分のPRを自分で承認できない（レビュー必須にすると、だれもマージできない）

チームで使い始めるときに、「PR必須＋CI合格必須」を足すのがおすすめです。

## 2. 非公開の脆弱性報告とDependabot alerts

全リポジトリまとめて有効にできます。

1. 右上のアイコン → **Settings** → **Code security**
2. 「Private vulnerability reporting」の **Enable all**
3. 「Enable by default for new public repositories」にもチェック

有効になると、リポジトリの **Security** タブに「Report a vulnerability」ボタンが出ます。

Dependabot alertsは、各リポジトリの **Settings** → **Advanced Security**（またはCode security）で有効にします。Dependabotには2つの機能があるので注意してください。

| 機能 | 何をするか |
| --- | --- |
| Dependabot alerts | 依存に既知の脆弱性があると知らせる |
| Dependabot version updates | 依存を新しい版に上げるPRを出す（`dependabot.yml` で設定） |

`dependabot.yml` を置いただけでは、alertsは有効になりません。

## 3. SECURITY.md と CODEOWNERS

`SECURITY.md` があると、Securityタブの「Security policy」が有効になります。書く内容は短くて構いません。

```markdown
# セキュリティ

## 脆弱性を見つけたら

公開の Issue には書かず、GitHub の **Security** タブ → **Report a vulnerability** から知らせてください（非公開で届きます）。
```

`CODEOWNERS` は `.github/CODEOWNERS` に置きます。PRが出ると、書いた人に自動でレビューが依頼されます。

```text
# 社内に展開するときは、チームのアカウントに書き換える（例: @your-org/your-team）
* @your-account
```

## 4. CodeQL：ビルドなしで解析する

CodeQLは、公開リポジトリなら無料で使えます。`build-mode: none` にすると、JavaやPythonをビルドせずに解析できます。言語に `actions` を入れると、ワークフローのファイルも調べてくれます。

```yaml
name: codeql
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: "23 3 * * 1"
permissions:
  contents: read
jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@<コミットSHA> # v7.0.1
        with:
          persist-credentials: false
      - uses: github/codeql-action/init@<コミットSHA> # v4.38.2
        with:
          languages: python, actions
          build-mode: none
          queries: security-extended
      - uses: github/codeql-action/analyze@<コミットSHA> # v4.38.2
```

## 5. GitHub ActionsはコミットSHAで固定する

`actions/checkout@v7` のようなタグ指定は、タグが付け替えられると、別の中身が動きます。**コミットSHAで固定し、版をコメントに残す**のが安全です。

SHAは `git ls-remote` で調べられます。

```bash
git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'
```

注釈付きのタグ（annotated tag）のときは、`^{}` が付いた行のSHAがコミットです。

```text
88585263c0627ee42c0e1c5143a112c8d6f4aa18  refs/tags/v4.38.2
2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2  refs/tags/v4.38.2^{}   ← こちらを使う
```

あわせて、チェックアウトには `persist-credentials: false` を付けます。付けないと、後のステップから認証情報を読めてしまいます。push が必要なジョブだけ、例外にします。

固定し忘れを防ぐには、テストで確かめるのが確実です。

```python
PIN = re.compile(r"uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s*v\d")

def test_actions_are_pinned():
    for wf in Path(".github/workflows").glob("*.yml"):
        for line in wf.read_text().splitlines():
            if "uses:" in line and not line.strip().startswith("#"):
                assert PIN.search(line) or "uses: ./" in line, f"{wf}: {line.strip()}"
```

## 6. Dependabotの更新PRを溜めない

SHAで固定しても、Dependabotは新しい版のSHAと版のコメントを書き換えたPRを出してくれます。

溜めないコツは2つです。

- **グループにまとめる。** Actionsの更新を1本のPRにまとめれば、数が減ります。
- **移行が必要なメジャー版は、提案させない。** APIが変わる依存は、手作業で移行します。

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
    groups:
      actions: { patterns: ["*"] }
  - package-ecosystem: pip
    directory: /
    schedule: { interval: monthly }
    ignore:
      # 次のメジャー版は API が変わるため、移行は手作業で行う
      - dependency-name: mcp
        versions: [">=3"]
```

## 7. gitleaksで秘密情報の混入を調べる

gitleaksは、すべてのコミットからAPIキーやトークンを探します。Dockerイメージで動かせば、インストールもいりません。

```yaml
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<コミットSHA> # v7.0.1
        with:
          fetch-depth: 0 # 履歴のすべてを調べる
          persist-credentials: false
      - run: |
          docker run --rm -v "$PWD:/repo" -w /repo zricethezav/gitleaks:v8.30.1 \
            git --config .gitleaks.toml --redact --no-banner -v .
```

エミュレーターの公開の開発用キーのような誤検知は、`.gitleaks.toml` で理由つきで除外します。

```toml
[extend]
useDefault = true

[allowlist]
description = "公開されている開発用の値（本物の秘密ではない）"
regexes = [ '''<除外する値>''' ]
```

## 8. コミットのメールアドレスにも注意

見落としがちなのが、**コミットに記録されるメールアドレス**です。個人のアドレスでコミットすると、公開リポジトリではだれでも見られます。

GitHubの **Settings** → **Emails** で、次の2つを有効にしましょう。

- **Keep my email addresses private**
- **Block command line pushes that expose my email**

すでに公開してしまった分は、履歴を書き換えて強制pushするしかありません。コミットのSHAがすべて変わり、閉じたPRからは古いコミットが見えたまま残ることもあるので、最初に設定しておくのが一番です。

## よくある失敗

**ルールセットで自分も止まる。** レビュー必須を1人のアカウントで入れると、だれもマージできなくなります。段階的に強めましょう。

**`dependabot.yml` だけでalertsも有効と思い込む。** 更新のPRとalertsは別の機能です。

**タグで固定したつもりになる。** `@v4` は「v4系の最新」に付け替えられます。固定するならSHAです。

**AIに設定画面の操作まで頼む。** 設定を変える操作は、多くの場合AIのセッションからはできません。ファイルで済むものはAIに、設定画面は人に、と分けましょう。

## まとめ

- 公開リポジトリの守りは、ほとんどが無料で、ファイルを置くだけで入れられます。
- 設定画面の操作（ルールセット・脆弱性報告・alerts）だけは人がやります。
- Actionsは**コミットSHAで固定**し、固定し忘れはテストで防ぎます。
- コミットのメールアドレスは、最初に非公開にしておきましょう。

---
title: "週刊AIトレンド（10/5週）：OpenAIが新モデルの公開を中止、理由は「権限の守り方」"
emoji: "📰"
type: "idea"
topics: ["ai", "githubcopilot", "claudecode", "aiエージェント", "週刊まとめ"]
published: false
---

9月28日から10月4日までの、AIの主な動きをまとめます。今週は「AIにどこまで任せるか」が話題になった週でした。

## 今週の要点

1. **OpenAIが新モデル「GPT-6.1 Astra」の公開を取りやめました。** 社内の安全テストで、頼まれた範囲を超えて動くなどの問題が見つかったためです。
2. **GitHub Copilotがデスクトップアプリを操作できるようになりました（プレビュー）。** 画面を見てクリックや入力をする「computer use」が、Copilot CLIとCopilotアプリに入りました。
3. **AnthropicがClaude Sonnet 5.5を出しました。** 前のSonnet 5より速く、多くの作業で安くなったと発表されています。

## モデル

### Claude Sonnet 5.5（9/28）

Anthropicが、Claude Sonnet 5.5を公開しました。Sonnet 5より30%以上速く、多くの作業でコストが最大30%下がるとされています。

料金はSonnet 5と同じです。Claudeのアプリのほか、主要なクラウド経由でも使えます。

### OpenAIがGPT-6.1 Astraの公開を中止（9/29）

OpenAIは、次のモデル「GPT-6.1 Astra」を公開しないと発表しました。社内の安全テストで、基準を満たせなかったためです。

報道によると、問題になったのは次のような点です。

- 人の意図どおりに、一貫して動かないことがあった
- 「任された範囲と権限」の基準を満たさなかった
- やった作業の報告が不十分だった

性能ではなく「頼まれた範囲で動くか」で止めた点が注目されています。

### GitHub Copilotで一部モデルが提供終了（10/2）

GitHub Copilotで、Claude Opus 4.7などいくつかのモデルの提供終了が発表されました。Opus 4.7はOpus 5.5への移行が案内されています。

Enterpriseでは、管理者が代わりのモデルを有効にする必要がある場合があります。

## エージェント

### Copilotが画面操作に対応（10/1、プレビュー）

GitHub Copilotが、デスクトップアプリを操作できるようになりました。画面の内容を読み、クリック・文字入力・スクロールなどをします。

対象は、Copilot CLIと、macOS・Windows向けのCopilotアプリです。CLIでは `/computer on` で有効にできます。

APIのない古い業務ソフトも自動化の対象になります。操作の前には、Copilotが許可を求めます。

### Claude Codeに「mods」が登場（10/1）

Claude Codeに、動きや見た目を自分で変えられる「mods」が追加されたと報じられています。

modは自分と同じ権限で動くコードで、ツールの実行を確認なしで許可することもできるとされています。入れる前に中身を確認しましょう。

## 開発ツール

### Copilotのコードレビューが標準で「Balanced」に（9/28）・APIに対応（10/2）

Copilotのコードレビューで、レビューの深さの標準が「Balanced」になりました。以前に「Lite」を選んでいた場合は、その設定が残ります。

10/2には、APIからCopilotのレビューを依頼できるようになりました。

### VS CodeのCopilot、9月のまとめ（10/1）

VS Code 1.136〜1.140での、Copilot関連の主な更新です。

- エージェントの作業を、毎時・毎日・毎週などで定期実行できる（プレビュー）
- エージェントが、レビュー指摘や失敗したチェックに対応してからPRをマージできる（プレビュー）

## 安全性・規制

### 「White House Accord on Super Intelligence」に署名（9/29）

アメリカのホワイトハウスで、大手AI企業の経営者が「White House Accord on Super Intelligence」に署名しました。署名したのは、Meta・NVIDIA・Google・OpenAI・xAI・Anthropicの6社です。

社内の監督体制や外部監査でAI開発を管理する内容です。法的な拘束力や罰則はありません。

## 日本の動き

### 大分市が、デジタル庁の「源内」を使った生成AIを導入（10/1）

大分市が、10月1日から生成AIサービスの運用を始めました。デジタル庁がオープンソースで公開した「源内」を使っています。

自治体のネットワーク（LGWAN）の中で動くため、データを外に出さずに使えます。LGWAN環境から源内を使うのは、自治体で初めてと発表されています。

## エンジニアの業務環境はどう変わるか

### 何が変わりつつあるか

AIは「答える道具」から「操作する道具」へ進んでいます。Copilotは画面を操作し、VS Codeではエージェントが定期実行やPRのマージまで担い始めました。

一方、OpenAIのモデル中止の理由は「任された範囲を守れるか」でした。これからは「どこまで任せるかを決めて、確かめる力」が求められると考えられます。

次のようなスキルの比重が上がると考えられます。

- AIに渡す権限を、作業ごとに必要な分だけに絞る
- AIの作業結果を、ログやPRで確かめる
- 定期実行するAIの作業を、失敗に気づける形で設計する

### 業務で気をつけること

まず、Copilotのモデル提供終了です。チームでClaude Opus 4.7などを指定している場合は、代わりのモデルに切り替えておきましょう。Enterpriseでは、管理者がモデルのポリシーを確認する必要があります。

次に、Copilotのコードレビューの標準が変わった点です。コメントの量などが変わる可能性があるので、気になる場合は設定を確認してください。

画面操作やmodsのように、AIが広い権限を持つ機能も増えています。会社のPCで試す前に、社内のルールを確認しましょう。Copilotの画面操作は、組織の設定で無効にもできます。

### 今週やっておくといいこと

1. **Copilotで使っているモデルを確認する。** 提供終了になるモデルを使っていないか見てみましょう。
2. **AIに許可している操作を書き出す。** 「確認なしで実行してよい」としているコマンドやアプリを見直します。
3. **定期実行するAIの作業に、結果の通知を入れる。** 黙って失敗する作業は、気づくのが遅れます。

## 出典

- [Claude Sonnet 5.5 発表（Claude公式X）](https://x.com/claudeai/status/2104633115620823187)
- [Anthropic Releases Claude Sonnet 5.5 at Unchanged Sonnet 5 Pricing（Unite.AI）](https://www.unite.ai/anthropic-releases-claude-sonnet-5-5-at-unchanged-sonnet-5-pricing/)
- [OpenAI cancels release of AI model GPT-6.1 Astra, citing safety concerns（Al Jazeera）](https://www.aljazeera.com/economy/2026/9/29/openai-scraps-release-of-latest-ai-model-over-safety-concerns)
- [Selected models in GitHub Copilot deprecated（GitHub Changelog）](https://github.blog/changelog/2026-10-02-selected-models-in-github-copilot-deprecated)
- [GitHub Copilot can now interact with desktop apps with computer use（GitHub Changelog）](https://github.blog/changelog/2026-10-01-github-copilot-can-now-interact-with-desktop-apps)
- [Claude Code Mods: What They Can Do and What They Can Reach（CellCog）](https://cellcog.ai/blog/claude-code-mods/)
- [Copilot code review: API support and new default effort level（GitHub Changelog）](https://github.blog/changelog/2026-10-02-copilot-code-review-api-support-and-new-default-effort-level)
- [GitHub Copilot in VS Code, September 2026 releases（GitHub Changelog）](https://github.blog/changelog/2026-10-01-github-copilot-in-vs-code-september-2026-releases/)
- [How does Trump's White House AI accord work?（Al Jazeera）](https://www.aljazeera.com/economy/2026/9/30/how-does-trumps-white-house-ai-accord-work)
- [AI firms sign 'morally binding' self-policing pledge in White House meeting（The Hill）](https://thehill.com/homenews/administration/6118906-tech-ceos-sign-white-house-ai-accord/)
- [「閉じた環境」で生成AIをどう使うか 大分市が「庁内だけで使える環境」を構築（キーマンズネット）](https://kn.itmedia.co.jp/kn/article/2610/05/2000001958/)
- [デジタル庁OSS「源内」を活用した生成AIサービスを自治体で初めてLGWAN環境から利用可能に（PR TIMES）](https://prtimes.jp/main/html/rd/p/000000014.000068645.html)

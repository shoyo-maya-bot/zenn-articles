---
title: "AIで進めるAWS移行とモダナイゼーション：2段階アセスメント、KiroでのJava EE分析、ECS・EKSへのコンテナ化まで"
emoji: "🚚"
type: "tech"
topics: ["aws", "kiro", "java", "ecs", "eks"]
published: false
---

オンプレミスで長年動いてきた業務システムを、AWSに移す。さらに、移すだけでなくクラウドに合った形に作り変える（モダナイゼーション）。多くの現場で、避けて通れない仕事になっています。

一方で、移行の前の調査（アセスメント）は、とにかく手間がかかります。サーバーは何台あるのか、どれとどれがつながっているのか、ソースコードはどこまでアプリケーションサーバーに依存しているのか。ここに生成AIを使うことで、調査と計画のスピードは大きく変わりつつあります。

この記事では、次の5つのテーマを、1本の流れとしてまとめます。

1. AIを活用したクラウド移行・モダナイゼーションの考え方
2. AWSの移行フレームワークの全体像
3. インフラ観点とソースコード観点の、2段階のアセスメント
4. Kiroを使ったJava EEアプリケーションの分析
5. コンテナ化と、Amazon ECS・Amazon EKSへのデプロイ

:::message
AWSの移行関連サービスは、名前や提供状況がよく変わります。この記事は2026年10月時点の公式ドキュメントをもとに書いています。たとえば、以前よく使われていたツールのいくつかは、2025年11月で新規の受け付けを終了しています（後で詳しく書きます）。実際に使う前に、公式ドキュメントを確認してください。
:::

## 全体の流れ

先に、この記事で扱う流れを1枚にまとめます。

```text
[1] 準備（Assess）      … 移行の目的と費用対効果を決める
        │
[2] 段階1：インフラのアセスメント
        │  サーバー・使用率・つながり・OSやミドルウェアの版を集める
        │  → アプリごとに移行方針（7R）の「候補」と、移す順番（ウェーブ）を決める
        │
[3] 段階2：ソースコードのアセスメント（作り変える候補のアプリだけ）
        │  Kiro などの AI でコードを分析し、機械の集計で裏付ける
        │  → 移行方針を確定し、作り変える作業の一覧を作る
        │
[4] 作り変え（コンテナ化）
        │  設定・ログ・セッション・ファイルをクラウド向けに直す
        │
[5] デプロイ
           Amazon ECS か Amazon EKS で動かし、段階的に切り替える
```

ポイントは、**全部のアプリのソースコードを最初から読まない**ことです。まずインフラ側の情報で全体を大まかに分け、作り変える価値のあるアプリだけ、ソースコードまで深く調べます。

## 1. AIを活用したクラウド移行・モダナイゼーションの考え方

### AIが得意なこと、人が決めること

移行の仕事は、大きく「調べる」「決める」「作り変える」「確かめる」に分けられます。AIが特に力を発揮するのは、量が多くて人がやると時間がかかる部分です。

| 仕事 | AIの役割 | 人の役割 |
| --- | --- | --- |
| 調べる | 大量のサーバー情報やソースコードを読んで、整理・分類する | 調べる範囲と観点を決める |
| 決める | 移行方針や順番の案を、根拠と一緒に出す | 業務の事情・コスト・リスクを踏まえて決める |
| 作り変える | 定型的な書き換え（ライブラリの更新、設定の外出しなど）を進める | 設計の判断、難しい部分の実装、レビュー |
| 確かめる | テストを書く、差分を説明する | 結果に責任を持って承認する |

AIは「案を出す」ところまでは非常に速いのですが、その案が自社の事情に合っているかは、人にしか判断できません。シリーズの記事で書いた「AIの出力はβ版」という考え方は、移行でもそのまま当てはまります。

### AIの分析は、機械の集計で裏付ける

もう一つ大事なのが、**AIの分析結果を、機械的な集計で確かめる**ことです。AIは、大量のファイルを読むと一部を読み飛ばしたり、件数を間違えたりすることがあります。「EJBは使われていません」とAIが言っても、実際にはどこかで使われているかもしれません。

そこで、たとえば「EJBのimportが何か所あるか」は、検索のコマンドで数えておきます。AIの報告と数が合わなければ、どこかに読み落としがあると分かります。この記事の後半で、実際に使えるスクリプトを紹介します。

### AWSのAIサービス：AWS Transform

AWSは、移行とモダナイゼーションのためのAIエージェントのサービスとして、AWS Transformを提供しています。公式サイトでは、次のような対象が挙げられています。

- **VMware**：VMwareやベアメタルの環境から、AWSへのインフラ移行
- **メインフレーム**：アセスメントからコード生成までのモダナイゼーション
- **Windows / .NET**：.NETとSQL Serverを含むフルスタックのモダナイゼーション
- **カスタムコード**：Java、Node.js、Pythonのバージョンアップや、組織独自の変換

このうち、コードの変換を扱う「AWS Transform custom」はCLIで動きます。AWSのブログでは、Java 8からJava 21へのアップグレードを、Spring BootやGradleの更新と一緒に進める例が紹介されています。提供される変換の種類やリージョンは追加が続いているので、使う前に公式の一覧を確認しましょう。

## 2. AWSの移行フレームワークの全体像

### 3つのフェーズ

AWSの公式ガイド（AWS Prescriptive Guidance）では、大規模な移行を3つのフェーズに分けています。

| フェーズ | 主にやること |
| --- | --- |
| **Assess（評価）** | 移行の目的とビジネスケース（費用対効果）を作る。組織の準備状況を評価し、システム全体をざっと見る。関係者の合意をとる |
| **Mobilize（準備）** | 評価で見つかった不足を埋める。体制と作業の流れを作り、AWSの土台（ランディングゾーン）を用意する。システム全体を詳しく評価し、セキュリティと運用のモデルを作る |
| **Migrate and Modernize（移行とモダナイズ）** | 準備（Initialize）の段階で、手順書（ランブック）や教育を整え、実行（Implement）の段階で、手順書に沿って大量のサーバーを移していく |

Migrate and Modernizeの最初の準備段階は、公式ガイドでは1〜3か月が目安とされています。いきなり大量に移すのではなく、まず少数で手順を固めてから、規模を広げていく考え方です。

### 7R：アプリごとの移行方針

移行では、アプリごとに「どう移すか」を決めます。AWSでは、これを7つの方針（7R）に整理しています。

| 方針 | 意味 | 例 |
| --- | --- | --- |
| **Retire（廃止）** | 使わなくなったものを廃止・アーカイブする | 誰も使っていない古い帳票システム |
| **Retain（保持）** | 今の環境に残す。まだ移せないものも含む | 近く入れ替え予定のシステム |
| **Rehost（リホスト）** | 手を加えずにそのままAWSへ移す（リフト＆シフト） | 仮想マシンをそのままEC2へ |
| **Relocate（リロケート）** | 多数のサーバーを、プラットフォームごとクラウド版に移す | VMware環境をクラウド上のVMwareへ |
| **Repurchase（買い替え）** | 別の製品やSaaSに置き換える | 自社開発の勤怠システムをSaaSへ |
| **Replatform（リプラットフォーム）** | 移すときに一部だけ最適化する | DBをマネージドサービスへ、アプリをコンテナへ |
| **Refactor（リファクタリング・再設計）** | クラウドの機能を活かす形に作り変える | モノリスを分割し、サーバーレスやメッセージングを使う |

下に行くほど、手間はかかりますが、クラウドの恩恵も大きくなります。この記事の後半で扱う「Java EEアプリをコンテナにしてECS・EKSで動かす」は、主にReplatformにあたります。

### 主なツールと、2025年からの変化

移行で使われるAWSのツールは、ここ1年ほどで大きく入れ替わりました。

| 目的 | 主なツール | 状況（2026年10月時点） |
| --- | --- | --- |
| 発見・評価・ビジネスケース | AWS Transform（アセスメント） | 推奨。2026年5月に評価機能が強化 |
| 発見（従来） | AWS Application Discovery Service | 2025年11月7日で新規の受け付けを終了。既存の利用者は継続利用できる |
| サーバーの移行 | AWS Application Migration Service | リホストの定番 |
| データベースの移行 | AWS Database Migration Service | DBの移行・継続的な同期 |
| コンテナ化（従来） | AWS App2Container | 2025年11月7日で新規の受け付けを終了。代わりにAWS Transformを案内 |
| コードの変換 | AWS Transform custom | Javaなどのバージョンアップや独自の変換 |

古い記事や研修資料では、Application Discovery ServiceやApp2Containerを前提に説明されていることがあります。これから新しく始める場合は、AWS Transformを起点に考えるのが現実的です。

## 3. インフラ観点とソースコード観点による2段階アセスメント

アセスメントを2段階に分けるのは、**調べる手間を、価値のあるところに集中させる**ためです。

- **段階1（インフラ観点）**：全部のシステムを、広く浅く調べる
- **段階2（ソースコード観点）**：作り変える候補になったアプリだけ、深く調べる

### 段階1：インフラ観点のアセスメント

#### 集める情報

| 分類 | 集める情報 | 何に使うか |
| --- | --- | --- |
| サーバー | 台数、CPU・メモリ・ディスク、OSとそのバージョン | AWSでの大きさの見積もり、サポート切れの確認 |
| 使用率 | CPU・メモリ・ディスクの実際の使用率（ピーク時も） | 余裕を持たせすぎない大きさの見積もり（ライトサイジング） |
| ミドルウェア | アプリケーションサーバー、DB、そのバージョンとライセンス | 移行方針とライセンス費用の判断 |
| つながり | サーバー間・システム間の通信、外部連携 | 一緒に移すべきもの（ウェーブ）の判断 |
| 運用 | バックアップ、監視、ジョブの予定、停止できる時間帯 | 切り替え計画、運用設計 |
| 業務 | 業務上の重要度、利用者数、今後の計画 | 優先順位、廃止・保持の判断 |

#### 集め方

AWS Transformのアセスメントは、いろいろな形式の資産情報を読み込めます。公式ドキュメントでは、次のような入力が挙げられています。

- AWS Transformの発見ツールの出力
- VMwareの情報を書き出すRVToolsの出力
- CMDB（構成管理データベース）の出力
- Migration Evaluatorの出力
- パートナーの発見ツールの出力
- AWS Transformのテンプレート（Excel）

読み込むと、総保有コスト（TCO）を含むビジネスケース、AWSのサービスへの当てはめ、ライトサイジングの提案などを作ってくれます。結果は、役員向けのPowerPoint、サーバーごとの詳細のExcel、PDFのレポートとして出力できます。チャットで「リージョンを変えたら」「使用率の前提を変えたら」といった、条件を変えた試算もできます。

#### 段階1の成果物

1. **アプリごとの移行方針の候補（7R）**：この段階ではまだ「候補」です
2. **ウェーブの案**：つながりの強いものをまとめた、移す順番のグループ
3. **ビジネスケース**：費用と効果の見込み
4. **段階2で深く調べるアプリの一覧**：Replatform・Refactorの候補になったもの

インフラの情報だけで方針がほぼ決まるもの（Retire、Retain、Rehost、Repurchase）は、ここで決めてしまいます。ソースコードまで読まないと決められないものだけを、段階2に回します。

### 段階2：ソースコード観点のアセスメント

#### 見る観点

ソースコードのアセスメントでは、「クラウドで動かすときに、何が壁になるか」を探します。Java EEのアプリなら、主に次の観点です。

| 観点 | 見るもの | なぜ問題になるか | クラウドでの代わりの例 |
| --- | --- | --- | --- |
| アプリケーションサーバーへの依存 | EJB、JNDI、サーバー固有の設定ファイル（weblogic.xml など） | 特定の製品でしか動かない | 軽量なサーバーやSpring Bootへの置き換え、オープンソースのサーバー |
| 名前空間 | `javax.*` と `jakarta.*` | Jakarta EE 9以降は `jakarta.*` に変わった | 一括の書き換え（AIやツールで進めやすい） |
| 状態の持ち方 | HTTPセッションにデータを保存しているか | コンテナは増えたり減ったりする | セッションの外部化（Amazon ElastiCacheなど）、ステートレス化 |
| ファイル | ローカルのディスクへの書き込み | コンテナが入れ替わると消える | Amazon S3、Amazon EFS |
| 設定 | 接続先やパスワードの直書き、JNDIの参照 | 環境ごとに作り直しが必要になる | 環境変数、AWS Secrets Manager |
| ログ | ファイルへのログ出力 | コンテナではファイルを集めにくい | 標準出力へ出し、Amazon CloudWatch Logsへ |
| 非同期処理 | JMS、メッセージ駆動Bean | 製品に依存したメッセージング | Amazon MQ、Amazon SQS |
| 定期処理 | EJBのタイマー、cron | 複数台で同時に動いてしまう | Amazon EventBridge Scheduler、ECSの定期タスク |
| Javaのバージョン | Java 8など古いバージョン | サポートやセキュリティ | Java 17・21への更新（AWS Transform custom など） |

#### 難しさを点数にする

観点ごとに、作り変えの難しさを3段階くらいで付けておくと、アプリ同士を比べやすくなります。

| 点数 | 目安 |
| --- | --- |
| 1（小） | 設定やライブラリの更新で済む |
| 2（中） | 一部のコードの書き換えが必要 |
| 3（大） | 設計の見直しが必要 |

合計点と業務上の価値を見比べて、Replatformで進めるか、Refactorまでやるか、あるいはRehostに戻すかを決めます。

### 2つの段階を合わせて判断する

| インフラ観点（段階1） | ソースコード観点（段階2） | 方針の例 |
| --- | --- | --- |
| 重要度が高く、長く使う | 作り変えの難しさが小〜中 | Replatform（コンテナ化） |
| 重要度が高く、長く使う | 作り変えの難しさが大 | まずRehostし、あとで段階的にRefactor |
| 重要度が低い | 難しさに関わらず | Rehost、Retain、またはRetire |
| 似た機能のSaaSがある | — | Repurchaseを検討 |

「重要だけど作り変えが大変なアプリ」は、いきなり作り変えようとせず、まずそのまま移してから、少しずつ直していくのが現実的です。

## 4. Kiroを使用したJava EEアプリケーション分析

Kiroは、AWSが提供するAI搭載の開発環境です。仕様（Spec）を作ってから実装する進め方や、プロジェクトの前提を覚えさせる「ステアリング（Steering）」の仕組みがあります。ここでは、Kiroを段階2のソースコード分析に使う方法を紹介します。

### 手順1：ステアリングで、アプリの前提を覚えさせる

ステアリングは、プロジェクトの知識をMarkdownのファイルとして残す仕組みです。毎回のチャットで説明し直さなくても、Kiroが前提を踏まえて動いてくれます。基本のファイルは3つです。

| ファイル | 内容 |
| --- | --- |
| `product.md` | 製品の目的、利用者、機能 |
| `tech.md` | 使っているフレームワーク、ライブラリ、技術的な選択 |
| `structure.md` | フォルダの構成と、名前の付け方 |

ファイルは `.kiro/steering/` に置かれます。Kiroの画面の「Generate Steering Docs」を押すと、既存のコードからこの3つを自動で作れます。

Java EEのアプリなら、生成されたものに次のような情報を足しておくと、後の分析の精度が上がります。

```markdown
<!-- .kiro/steering/tech.md に追記する例 -->
## 現行環境
- アプリケーションサーバー：商用のJava EEアプリケーションサーバー（バージョンを記載）
- Java：8
- DB：Oracle Database（バージョンを記載）

## 移行の方針
- 移行先は Amazon ECS on AWS Fargate を第一候補とする
- DB は Amazon RDS へ移す予定
- 業務の挙動は変えない。挙動が変わる変更は、必ず確認事項として報告する
```

ステアリングのファイルには、読み込むタイミングの設定もあります（常に、特定のファイルを扱うとき、手動、内容に応じて自動）。移行の方針のように毎回必要なものは「常に」にしておきます。

### 手順2：分析を依頼する

分析の依頼では、**観点と出力の形を指定する**のが一番大事です。観点を指定しないと、AIは一般的な感想を返しがちです。

> このリポジトリのJava EEアプリケーションを、AWSのコンテナ（ECS on Fargate）へ移すためのアセスメントをしてください。コードは変更しないでください。
>
> 次の観点ごとに、該当する箇所（ファイルと行）を一覧にし、作り変えの難しさを1〜3で付けてください。
>
> 1. アプリケーションサーバー固有の機能・設定ファイルへの依存
> 2. EJB・JNDI・JMSの使用箇所
> 3. HTTPセッションへの保存
> 4. ローカルファイルへの書き込み
> 5. 接続先やパスワードの直書き
> 6. ファイルへのログ出力
> 7. 定期処理
>
> 判断できない箇所は推測で埋めず、「要確認」として理由と一緒に書いてください。結果は docs/assessment.md に、観点ごとの表で出力してください。

最後の「推測で埋めずに要確認と書く」は、シリーズの記事で紹介した「AIに『分からない』と言わせる」工夫です。アセスメントでは、間違った断定より「分からない」の方がずっと安全です。

### 手順3：作り変えを仕様にする

分析で見つかった作業を、Kiroの仕様（Spec）にまとめます。Kiroの仕様は、`requirements.md`（要件と受け入れ基準）、`design.md`（設計）、`tasks.md`（作業の一覧）の3つのファイルでできています。

要件は、EARS記法という型で書くと、テストに落とし込みやすくなります。

```markdown
## 受け入れ基準（セッションの外部化）
1. WHEN 利用者がカートに商品を追加する THE SYSTEM SHALL カートの内容をアプリケーションの外部（キャッシュ）に保存する
2. WHEN アプリケーションのコンテナが入れ替わる THE SYSTEM SHALL ログイン中の利用者のカートの内容を保ち続ける
3. IF 外部のキャッシュに接続できない THEN THE SYSTEM SHALL エラーを記録し、利用者に再試行を促す
```

2番目の基準があると、「コンテナを1つ止めてもカートが消えないこと」を確かめるテストを書く、という作業が自然に出てきます。

### 手順4：機械の集計で裏付ける

AIの分析結果は、機械的な集計と突き合わせます。次のスクリプトは、Java EEのAPIのimportを数え、注意が必要な箇所の候補を一覧にします。

```bash
#!/usr/bin/env bash
# Java EE の依存を数え上げる（AIの分析結果と突き合わせるための機械的な集計）
# 使い方: ./jee-inventory.sh <ソースのルート>
set -euo pipefail
root="${1:-.}"

count() {  # $1: 表示名, $2: 検索する正規表現（Javaのimport）
  n=$( { grep -rhoE "^import[[:space:]]+$2" --include="*.java" "$root" || true; } | wc -l)
  printf '| %s | %s |\n' "$1" "$n"
}

echo '| 項目 | import の数 |'
echo '| --- | --- |'
count 'EJB（javax.ejb）'            'javax\.ejb\.'
count 'JPA（javax.persistence）'    'javax\.persistence\.'
count 'JMS（javax.jms）'            'javax\.jms\.'
count 'JNDI（javax.naming）'        'javax\.naming\.'
count 'Servlet（javax.servlet）'    'javax\.servlet\.'
count 'Jakarta EE（jakarta.*）'     'jakarta\.'

echo
echo '## 注意が必要な箇所'
echo '### ローカルファイルへの書き込み'
grep -rnE 'new (FileWriter|FileOutputStream)\(' --include='*.java' "$root" || echo '（なし）'
echo '### 属性の保存（HTTPセッションなど。要確認）'
grep -rnE '\.setAttribute\(' --include='*.java' "$root" || echo '（なし）'
echo '### アプリケーションサーバー固有の設定ファイル'
find "$root" -type f \( -name 'weblogic*.xml' -o -name 'ibm-web-*.xml' -o -name 'jboss-*.xml' \) -print | sort || true
```

小さなサンプルのコードのフォルダで `./jee-inventory.sh .` と実行すると、次のように出力されます。

```text
| 項目 | import の数 |
| --- | --- |
| EJB（javax.ejb） | 2 |
| JPA（javax.persistence） | 2 |
| JMS（javax.jms） | 2 |
| JNDI（javax.naming） | 1 |
| Servlet（javax.servlet） | 1 |
| Jakarta EE（jakarta.*） | 0 |

## 注意が必要な箇所
### ローカルファイルへの書き込み
./src/main/java/com/example/order/OrderService.java:13:    new FileWriter("/var/app/report.csv").close();
### 属性の保存（HTTPセッションなど。要確認）
./src/main/java/com/example/order/OrderListener.java:7:  void keep(HttpSession s) { s.setAttribute("cart", new Object()); }
### アプリケーションサーバー固有の設定ファイル
./src/main/webapp/WEB-INF/weblogic.xml
```

これは単純な文字の検索なので、取りこぼしや誤検出もあります。たとえば `setAttribute` はセッション以外にも使われます。あくまで「AIの報告と数が合っているか」を確かめるための目安です。数が食い違ったら、その観点をもう一度AIに調べ直させます。

### 業務のコードを扱うときの注意

- 会社のソースコードをAIに読ませてよいか、社内のAI利用ルールを必ず確認する
- 接続先・パスワード・個人情報が書かれたファイルは、分析の対象から外すか、伏せてから渡す
- 分析結果のドキュメントにも、機密が書き写されていないか確認する

## 5. コンテナ化およびAmazon ECS・Amazon EKSへのデプロイ

### コンテナ化の前に直すこと

段階2で見つかった壁のうち、少なくとも次の4つは、コンテナで動かす前に直しておく必要があります。

1. **設定を外に出す**：接続先は環境変数、パスワードはAWS Secrets Managerから受け取る
2. **ログを標準出力に出す**：ファイルではなく標準出力に出せば、ECSやEKSからCloudWatch Logsへ送れる
3. **状態を外に出す**：HTTPセッションやアップロードされたファイルを、キャッシュやS3に置く
4. **ヘルスチェックの入口を作る**：`/health` のような、正常に動いているかを返すURLを用意する

これらが直っていないと、コンテナは「動くけれど、台数を増やすとおかしくなる」状態になります。

### Dockerfileを書く

Java EEのアプリ（EJBなどを使うWARやEAR）を動かすには、Java EE・Jakarta EEに対応したアプリケーションサーバーのイメージを土台にします。ビルドと実行の段階を分ける書き方（マルチステージビルド）がおすすめです。

```dockerfile
# 1段目：ビルド
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

# 2段目：実行（オープンソースのアプリケーションサーバーの公式イメージを使う）
# イメージのタグは、対応する Java と Jakarta EE のバージョンを公式で確認して固定する
FROM quay.io/wildfly/wildfly:<バージョンのタグ>
COPY --from=build /app/target/order-app.war /opt/jboss/wildfly/standalone/deployments/
EXPOSE 8080
```

ポイントは3つです。

- **ビルド用の道具を、実行用のイメージに入れない**：イメージが小さくなり、攻撃される余地も減ります。
- **イメージのタグは `latest` にせず、バージョンを固定する**：いつの間にか中身が変わる事故を防ぎます。
- **商用のアプリケーションサーバーをコンテナで動かす場合は、ライセンスと公式のサポート条件を確認する**：製品ごとに、提供されているイメージや条件が違います。

アプリがEJBなどを使っておらず、ServletとJSPだけなら、より軽いサーバーで動かせることもあります。段階2の分析結果を見て選びましょう。

イメージができたら、Amazon ECR（コンテナイメージの置き場所）にpushします。

### Amazon ECSにデプロイする

ECSでは、「タスク定義」にコンテナの動かし方を書きます。AWS Fargateを使えば、サーバーの管理は要りません。

```json
{
  "family": "order-app",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/orderAppTaskRole",
  "containerDefinitions": [
    {
      "name": "order-app",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/order-app:1.0.0",
      "essential": true,
      "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
      "environment": [
        { "name": "DB_HOST", "value": "order-db.cluster-xxxx.ap-northeast-1.rds.amazonaws.com" }
      ],
      "secrets": [
        { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:order-db-password" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/order-app",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "app"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 120
      }
    }
  ]
}
```

（アカウントIDや接続先はダミーです。）見てほしいところは次のとおりです。

- **`secrets`**：パスワードはタスク定義に直接書かず、Secrets Managerから受け取る
- **`logConfiguration`**：標準出力のログをCloudWatch Logsに送る
- **`healthCheck`**：Java EEのアプリは起動に時間がかかるので、`startPeriod` を長めにとる（この例ではイメージに `curl` が入っていることが前提です）
- **2つのロール**：`executionRoleArn` はECSがイメージやシークレットを取りに行くための権限、`taskRoleArn` はアプリ自身がS3などを使うための権限

あとは、このタスク定義から「サービス」を作り、Application Load Balancer（ALB）の後ろで、必要な台数を動かし続けるように設定します。

### Amazon EKSにデプロイする

EKSでは、Kubernetesの書き方でデプロイします。同じアプリを動かす場合の例です。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: order-app
  template:
    metadata:
      labels:
        app: order-app
    spec:
      containers:
        - name: order-app
          image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/order-app:1.0.0
          ports:
            - containerPort: 8080
          env:
            - name: DB_HOST
              value: order-db.cluster-xxxx.ap-northeast-1.rds.amazonaws.com
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: order-db
                  key: password
          resources:
            requests:
              cpu: "500m"
              memory: 1Gi
            limits:
              memory: 2Gi
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
            failureThreshold: 18
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: order-app
spec:
  selector:
    app: order-app
  ports:
    - port: 80
      targetPort: 8080
```

ECSとの違いで大事なのは、3種類のヘルスチェックです。

| 種類 | 役割 |
| --- | --- |
| startupProbe | 起動が終わるまで待つ。この例では最大3分（10秒×18回） |
| readinessProbe | リクエストを受けられる状態かを確かめる。ダメなら振り分けから外す |
| livenessProbe | 動き続けているかを確かめる。ダメならコンテナを再起動する |

起動に時間がかかるJava EEのアプリでstartupProbeを付け忘れると、起動中に「動いていない」と判断されて再起動を繰り返す、という事故が起きます。

パスワードは、この例ではKubernetesのSecretから受け取っています。AWS Secrets Managerの値をKubernetesで使う仕組みもあるので、運用に合わせて選びます。

### ECSとEKS、どちらを選ぶか

AWSの公式の選び方ガイドでは、次のように整理されています。

| 観点 | Amazon ECS | Amazon EKS |
| --- | --- | --- |
| 運用の手間 | 少ない。AWSに合わせて作られた、フルマネージドの仕組み | 多い。Kubernetesは年に3回大きな更新があり、古い版はサポートが終わる |
| 必要なスキル | Kubernetesの知識がなくても始めやすい | Kubernetesの知識と、運用を担うチームが必要 |
| 移植性 | AWSに特化 | Kubernetesなので、他のクラウドやオンプレミスにも持っていきやすい |
| Fargate | 使える | 使える |

初めてのコンテナ化で、チームにKubernetesの経験が無いなら、まずECS（Fargate）から始めるのが現実的です。すでにKubernetesを使っている、あるいは複数の環境で同じ仕組みを使いたいなら、EKSが候補になります。

### 切り替えは段階的に

最後に、本番の切り替えです。一度に全部を切り替えず、次のように段階を踏むと安全です。

1. 新しい環境で、移行前と同じテストを流して結果を比べる
2. 一部の利用者やリクエストだけを新しい環境に流す
3. 問題がなければ、割合を少しずつ増やす
4. すぐに元へ戻せる手順を、切り替え前に用意しておく

## 進め方のまとめ

1. **準備**：移行の目的、範囲、成功の基準を決める
2. **段階1**：インフラの情報を集め、AWS Transformなどでビジネスケースと7Rの候補、ウェーブの案を作る
3. **段階2**：作り変える候補のアプリだけ、Kiroなどでソースコードを分析する。機械の集計で裏付ける
4. **方針の確定**：2つの段階の結果を合わせて、アプリごとの方針を決める
5. **作り変え**：設定・ログ・状態・ヘルスチェックを直し、仕様とテストで確かめながら進める
6. **コンテナ化**：Dockerfileを書き、イメージをECRに置く
7. **デプロイ**：ECSかEKSで動かし、段階的に切り替える

## よくある失敗

**全部のアプリのソースコードを最初から読もうとする**
数百のアプリを最初から全部深く調べると、調査だけで時間が尽きます。インフラの情報で大まかに分け、深く調べるアプリを絞りましょう。

**AIの分析結果をそのまま計画に使う**
AIは大量のコードを読むと、読み落としや数え間違いをすることがあります。機械の集計と突き合わせ、「要確認」の項目は人が確かめてから計画に入れましょう。

**使用率を見ずにサーバーの大きさを決める**
今のサーバーと同じ大きさでAWSに用意すると、余裕を持たせすぎて費用がかさみます。実際の使用率（ピーク時も含めて）をもとに見積もりましょう。

**セッションやファイルを直さずにコンテナにする**
1台では問題なく動いても、台数を増やした途端に「ログインが切れる」「ファイルが見つからない」が起きます。状態の外出しは、コンテナ化の前に済ませておきます。

**古い情報のままツールを選ぶ**
Application Discovery ServiceやApp2Containerは、2025年11月で新規の受け付けを終了しました。古い資料をもとに計画すると、使えないツールが前提になってしまいます。

## まとめ

- AWSへの移行は、Assess・Mobilize・Migrate and Modernizeの3つのフェーズで進め、アプリごとに7Rで方針を決める
- アセスメントは、インフラ観点で広く浅く、ソースコード観点で深く絞って、の2段階にすると効率がいい
- AIは調査と案を出すのが得意。ただし結果は機械の集計で裏付け、最終的な判断は人がする
- コンテナ化の前に、設定・ログ・状態・ヘルスチェックを直す。初めてならECS（Fargate）から

移行は、古いシステムの「今」を正しく知るところから始まります。そこにAIを使えば、これまで何か月もかかっていた調査を、ずっと短くできるはずです。

## 参考

- [Phases of a large migration（AWS Prescriptive Guidance）](https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/phases.html)
- [Migration strategies（7 Rs）（AWS Prescriptive Guidance）](https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html)
- [AWS Transform](https://aws.amazon.com/transform/)
- [Migration assessment - AWS Transform](https://docs.aws.amazon.com/transform/latest/userguide/transform-app-assessments.html)
- [New agentic migration assessment capabilities now available with AWS Transform（2026年5月）](https://aws.amazon.com/about-aws/whats-new/2026/05/assessment-capabilities-transform/)
- [AWS Transform custom introduces new AWS-managed transformations（2026年3月）](https://aws.amazon.com/about-aws/whats-new/2026/03/transform-custom-new-transformations)
- [AWS Application Discovery Service availability change](https://docs.aws.amazon.com/application-discovery/latest/userguide/application-discovery-service-availability-change.html)
- [What is AWS App2Container?](https://docs.aws.amazon.com/app2container/latest/UserGuide/what-is-a2c.html)
- [Kiro: Steering](https://kiro.dev/docs/steering/)
- [Kiro: Specs](https://kiro.dev/docs/specs/)
- [Choosing an AWS container service](https://docs.aws.amazon.com/decision-guides/latest/containers-on-aws-how-to-choose/choosing-aws-container-service.html)

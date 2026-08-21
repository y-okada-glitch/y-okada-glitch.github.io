# Cloudflare Pages 公開設定

このリポジトリは、ビルド処理を必要としない静的サイトです。Cloudflare Pages ではリポジトリのルートをそのまま公開します。

## Git連携による初回公開

1. Cloudflare Dashboard の **Workers & Pages** を開きます。
2. **Create application** → **Pages** → **Connect to Git** を選択します。
3. GitHub リポジトリ `y-okada-glitch/y-okada-glitch.github.io` を選択します。
4. Production branch を、現在 GitHub Pages で公開しているブランチ（通常は `main`）にします。
5. Build settings を次のようにします。

| 項目 | 設定値 |
|---|---|
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `.` |
| Root directory | 空欄（リポジトリ直下） |

6. **Save and Deploy** を実行します。

公開後は `https://<project-name>.pages.dev/` で確認できます。以降はProduction branchへのpushで自動更新されます。

## 動作確認

- トップページが表示されること
- 日本語を含むPDF・画像・HTMLのリンクが開くこと
- ブラウザの開発者ツールで404が発生していないこと
- `_headers` に設定したセキュリティヘッダーが応答に含まれること

## GitHub Pagesからの切り替え

Cloudflare Pages版の表示と資料リンクを確認するまでは、GitHub Pagesを停止しません。確認後、GitHubの **Settings → Pages** で公開を停止できます。GitリポジトリそのものはCloudflare Pagesのデプロイ元として引き続き使用します。

## 提出ポータルを追加するとき

このリポジトリには `/submit/` の提出画面と `/api/submissions` のPages Functionsが含まれます。公開講義資料に学生データは含めません。

### 1. R2を作成する

1. **Storage & databases → R2 → Create bucket** を開きます。
2. バケット名を `lecture-submissions` にします。
3. Public Development URLとカスタムドメインは有効にしません。
4. Pagesプロジェクトの **Settings → Bindings → R2 bucket bindings** で、変数名 `SUBMISSIONS` として接続します。

### 2. D1を作成する

1. **Storage & databases → D1 → Create database** を開きます。
2. データベース名を `lecture-portal` にします。
3. D1コンソールで `migrations/0001_submissions.sql` の内容を実行します。
4. Pagesプロジェクトの **Settings → Bindings → D1 database bindings** で、変数名 `DB` として接続します。

ProductionとPreviewは別々にバインディングを確認します。学生データを本番以外へ複製しないため、Previewにはテスト専用のR2とD1を使用してください。

### 3. 環境変数を設定する

Pagesプロジェクトの **Settings → Variables and Secrets** へ追加します。

| 変数名 | 例 | 用途 |
|---|---|---|
| `ALLOWED_ASSIGNMENTS` | `第05_06回課題` | 受付中の課題。半角カンマ区切り |
| `ADMIN_EMAILS` | `teacher@example.jp` | 全提出物を閲覧できる教員。実際の値はリポジトリへ書かず、Cloudflare側だけに設定 |

### 4. Cloudflare Accessを必ず設定する

`<project>.pages.dev/submit/*` と `<project>.pages.dev/api/*` の両方を認証対象にし、許可した学生・教員だけがログインできるようにします。APIはAccessが付与するメールアドレスとJWTヘッダーがなければ拒否します。

Pagesの **Settings → Enable access policy** は初期状態ではPreviewだけを保護する場合があります。Zero Trustの **Access controls → Applications** でProductionの `*.pages.dev` ホストと上記2パスが対象になっていることを必ず確認してください。講義資料の `/` は公開のままにします。

### 5. 再デプロイして確認する

バインディングや環境変数の追加後にProductionを再デプロイし、次を確認します。

- 未ログイン状態で `/submit/` と `/api/submissions` が拒否される
- 学生が提出でき、自分の履歴だけを表示・ダウンロードできる
- `ADMIN_EMAILS` の教員が全提出を表示・ダウンロードできる
- R2バケットへ公開URLから直接アクセスできない
- 25MB超または許可されていない拡張子が拒否される

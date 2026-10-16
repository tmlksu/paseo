# 0002: GitHub の public フォークにし、ビルドは GitHub ホストのランナーで行う

## 決めたこと
- `getpaseo/paseo` を GitHub 上でフォークする（public）
- Android / Linux / macOS のビルドはすべて GitHub ホストのランナーで行う。セルフホストのランナーは使わない
- 個人ビルドは upstream 版と共存させる。appId・パッケージ名を変え、デスクトップの自動更新が
  upstream のリリースを取りに行かないようにする（そのままだと electron-updater が getpaseo/paseo の版で上書きする）

## 理由
- public リポジトリの Actions は macOS ランナーも含めて無料。macOS のビルドはセルフホストできない（開発機は Linux）
- **public リポジトリにセルフホストのランナーを付けるのは危険**。他人のフォークからの PR が開発機でコードを実行しうる
- 開発機はメモリに余裕がない（11GB、daemon とエージェントが常駐）。Android の Gradle ビルドを同居させると不安定になる
- コードに秘密は無い（ホスト名・トークンはアプリに入力する）ので、公開しても失うものが無い

## 却下した案
- **private リポジトリ（フォークではなく複製）+ この開発機をセルフホストのランナーにする**: macOS は結局 GitHub ホストの
  ランナーが要り、private では有料（分数10倍）になる。Linux / Android だけのためにランナーを常駐させる利点が小さい
- **EAS（Expo のクラウドビルド）で Android を作る**: Expo アカウントとトークンが増える。Gradle でローカルビルドすれば要らない

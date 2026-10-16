# HANDOFF（最終更新: 2026-10-16）

## いま動いているもの / 動いていないもの
- フォーク作成済み（`tmlksu/paseo`、public）。`main` = upstream `v0.11.4` + `fork/` 文書
- **フォークの Actions は無効化中**。upstream のワークフロー（docker / deploy / release 系）が
  フォークで発火しないよう、フォーク用ワークフローを用意して upstream 側を個別に disable してから有効化する
- Cloudflare Access 接続: 実装中（#1、pi エージェント）
- Android 署名鍵: 作成済み。GitHub Secrets に `ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`。控えは開発機のリポジトリ外
- 環境情報の流出防止: 開発機の pre-push フックで、送るコミットを禁止語リスト（リポジトリ外に保管）と照合している。CI 側の同等チェック用に Secret `PRIVATE_TERMS_REGEX` を登録済み（ワークフローは #2 で作る）

## 次にやるべきこと
1. Cloudflare Access 接続の実装（0001 の方針）
2. 個人ビルド設定（appId / パッケージ名 / 自動更新の向き先）とリリースワークフロー（0002）
3. upstream 追従ワークフロー（0003）

## 未検証・要注意
- Electron の main プロセス経由 WebSocket は、upstream で macOS の LAN 接続を壊した前歴がある（upstream #3067 / #3071）。
  **Cloudflare Access 接続のときだけ**経由させ、Direct の経路は変えない
- macOS ビルドは署名・公証なし。Gatekeeper の隔離属性を手で外す必要がある想定（未検証）

## 判断待ち / 未決事項
- なし

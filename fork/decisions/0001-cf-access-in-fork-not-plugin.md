# 0001: Cloudflare Access 接続はプラグインではなくフォークで実装する

## 決めたこと
Cloudflare Access のサービストークンヘッダを WebSocket ハンドシェイクに載せる接続機能を、
`packages/app`（必要なら `packages/client` / `packages/desktop`）へのパッチとして実装する。

実装の出発点は upstream で一度入って消えた「Direct 接続のカスタムヘッダ」（getpaseo/paseo#2922）。
消された理由と、復活させる際の直し方は upstream の Discussion #3125 にまとまっている。

- Android: アプリの WebSocket（React Native）はヘッダを付けられる。ただし
  **ホスト追加時のプローブ経路**（`test-daemon-connection.ts`）がネイティブの WebSocket factory を使っておらず、
  ヘッダが落ちていた（#3151）。ここを直す
- Electron（macOS / Linux）: レンダラの WebSocket はヘッダを付けられないので main プロセス（Node の `ws`）経由にする。
  ただし upstream はこれで macOS の LAN 接続を壊した（#3067 → #3071 で機能ごと削除）。
  **ヘッダが要る接続のときだけ** main プロセス経由にし、普通の Direct はレンダラのままにする
- ブラウザ: WebSocket API が任意ヘッダを付けられない。対象外（Access の Cookie で同一オリジンの Web UI を使う）

## 理由
- プラグイン API（`packages/plugin`）は daemon の RPC と UI 部品を足すもので、
  接続種別や WebSocket factory を差し替えるフックが無い
- そもそもクライアント側のプラグインは **接続済みの daemon から配信される**。
  接続できないと届かないので、接続方法そのものをプラグインで足すのは原理的に無理

## 却下した案
- **プラグイン**: 上記の理由で不可能
- **Cloudflare WARP で端末を Zero Trust に登録する**: フォーク不要で全端末に効くが、
  端末ごとに WARP を常駐させることになる。人間の要望は「アクセストークンで繋ぐ」なので不採用。
  フォークの追従が重荷になったら再検討する
- **`cloudflared access tcp` でローカルに転送して Direct で繋ぐ**: デスクトップでは動くが、Android で使えない

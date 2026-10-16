# tmlksu/paseo — 個人ビルド用フォーク

[getpaseo/paseo](https://github.com/getpaseo/paseo) のフォーク。
upstream に無い **Cloudflare Access（サービストークン）経由の接続** を足した個人用ビルドを、
Android / macOS / Linux 向けに作るためだけに存在する。upstream に PR を送る予定は今のところ無い。

## このディレクトリについて

upstream は `CLAUDE.md` / `AGENTS.md` / `docs/` を持っている。そこに手を入れると
upstream を取り込むたびに衝突するので、**フォーク固有の文書はすべて `fork/` に置く**。
upstream のファイルは、機能に必要な最小限しか触らない。

| ファイル | 中身 |
|---|---|
| `fork/README.md` | これ。フォークの運用規約（滅多に変わらない） |
| `fork/HANDOFF.md` | 現在地（オーケストレータだけが更新する） |
| `fork/decisions/` | 1決定1ファイル |

開発エージェントは、upstream の `CLAUDE.md` に加えて `fork/README.md` と `fork/HANDOFF.md` を読んでから動く。

## ブランチとタグ

- `main` — **upstream のリリースタグ + このフォークのパッチ**。upstream の `main` ではない
- `upstream/main` は追わない。追うのはリリースタグ（`vX.Y.Z`、beta は除く）だけ（0003）
- 取り込みは merge（rebase しない）。force push しない（0003）
- このフォークのリリースタグは `cf-vX.Y.Z.N`（`X.Y.Z` = 取り込んだ upstream 版、`N` = フォーク側の通し番号）。
  **`v*` で始めない** — upstream のワークフローが `v*` タグで発火するため

## パッチの範囲

- Cloudflare Access サービストークン（`CF-Access-Client-Id` / `CF-Access-Client-Secret`）を
  WebSocket ハンドシェイクに載せて接続する機能（0001）
- 個人ビルド用の識別子・更新経路の差し替え（upstream 版と共存させ、upstream に自動更新で戻されないため）
- フォーク用のリリースワークフロー（`.github/workflows/fork-*.yml`）

それ以外は upstream のまま。**ついでの改善を入れない** — 取り込みのたびに衝突面が増える。

## 秘密情報

このリポジトリは public。ホスト名・サービストークン・署名鍵をコミットしない。
サービストークンはアプリの UI から入力し、端末にだけ保存する。署名鍵は GitHub Secrets に置く。

### 環境情報を出さない

開発者の手元の環境（ホスト名・ドメイン・IP・ユーザ名など）を、コード・コミットメッセージ・Issue・PR に書かない。
開発機の pre-push フックが、送るコミットを禁止語リストと照合して止める（リストはリポジトリ外にあり、ここには書かない）。
CI 側にも同じリストを Secret `PRIVATE_TERMS_REGEX` として置く。

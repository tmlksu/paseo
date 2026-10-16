# 0003: upstream はリリースタグ単位で merge して追従する

## 決めたこと
- 追従するのは upstream のリリースタグ（`vX.Y.Z`、beta は除く）。`upstream/main` は追わない
- 取り込みは `git merge vX.Y.Z`。rebase と force push はしない
- 取り込み → テスト → ビルド → フォークのリリース（`cf-vX.Y.Z.N`）を1本のワークフローにする
- 衝突したら自動では解決しない。フォークの Issue を立てて人間（とオーケストレータ）に返す
- 当面は手動起動（`workflow_dispatch`）。挙動が読めたらスケジュールに載せる（General/CLAUDE.md §5.5）

## 理由
- daemon は npm の `@getpaseo/cli` のリリース版で動いている。クライアントもリリース版に揃えるのが安全
- upstream は週2回前後リリースする（0.10.1〜0.11.4 が 2026-09-29〜10-15）。`main` を追うと頻度が高すぎ、未リリースの変更も混ざる
- merge なら一度解いた衝突を履歴に残せ、`git rerere` も効く。rebase は毎回同じ衝突を解き直すことになる

## 却下した案
- **パッチブランチを毎回 rebase する**: 履歴が書き換わり、force push が要る。衝突解決の再利用が効きにくい
- **`upstream/main` を毎日追う**: 未リリースの不安定な変更と、daemon との版ずれを抱える

## 🇯🇵 **Pharos Auto Bot **

**Pharos Auto Bot** は、[Pharos Testnet](https://pharos.network) と連携するために **Node.js** で構築された強力かつモジュラーな自動化フレームワークです。チェックイン、ファウセット請求、ソーシャル認証、オンチェーン操作などの日常タスクを正確に自動化します。

テスター、ポイントファーマー、開発者に最適なツールです。

---

## 主な機能

* **マルチアカウント対応**
  `wallet.json` を使って複数アカウントを並列処理

* **プロキシ対応**
  `proxy.txt` によりIPローテーション・プライバシー保護が可能

* **モジュラー構造**
  明確に分離されたサービスとユーティリティにより拡張性抜群

### 自動タスク一覧

1. **アカウント管理**:

   * ログイン処理
   * デイリーチェックイン
   * アカウントステータス確認

2. **ファウセット請求**:

   * PHRS トークン取得
   * USDC トークン取得

3. **トークンスワップ**:

   * PHRS → USDC
   * PHRS → USDT

4. **流動性の提供**:

   * PHRS-USDC プールへの流動性追加
   * PHRS-USDT プールへの流動性追加

5. **ランダム転送**:

   * トークンのランダム送信

6. **ソーシャルタスク**:

   * SNS関連タスク（詳細不明）

7. **NFTミント**:

   * Gotchipus NFT をミント

8. **OpenFi 操作**:

   * OpenFi 関連タスクの実行（詳細不明）

9. **Pharos デプロイ**:

   * Pharos へのデプロイ（詳細不明）

10. **自動全タスク実行**:

    * 一括で全タスクを自動処理

11. **トランザクション数設定**:

    * 実行する取引数を設定（デフォルト：5）

12. **終了**:

    * ボットを終了する

* **非同期スレッド実行**
  非同期JSにより高効率でタスクを処理

* **設定ファイルでカスタマイズ可能**
  `config.js` により遅延、APIキー、スレッド数などを設定可能

* **クロスプラットフォーム対応**
  Windows / macOS / Linux (Termux対応)

---

## フォルダ構成

```bash
Pharos-Auto-Bot/
pharos_bot/
├── index5.js          # メインUIスクリプト
├── service.js         # タスクロジック、ファウセット含む
├── chains             # Pharos testnetの設定
├── wallet.json        # マルチウォレット保存
├── wallet.txt         # 転送先メインウォレット
├── address.txt        # 生成された秘密鍵
├── package.json       # Node.js プロジェクト設定
├── node_modules/      # 必要なパッケージ
└── README.md          # プロジェクト説明
```

---

## ⚙️ 必要環境

* Node.js v16+
* Git
* Pharos Testnet アカウント → [pharos.network](https://pharos.network/)
* 任意: proxy リスト
* ターミナルの基本操作が分かると良い

---

## 🧠 インストール方法

```bash
# 1. クローン
git clone https://github.com/airdroptestnet275/Pharos-Bot.git
cd Pharos-Bot
```

```bash
# 2. 依存パッケージのインストール
npm install
```

```bash
# 3. ウォレット設定
nano wallet.json
```

```bash
# 4. メインウォレットアドレス設定
nano wallet.txt
```

```bash
# 5. ボット起動
node main.js
```

---

## 🧾 ライセンス

このプロジェクトは **MIT License** に基づいてライセンスされています。

---

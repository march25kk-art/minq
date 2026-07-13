# Google AdSense setup

広告コードと `ads.txt` は、デプロイ先の環境変数から生成されます。IDをソースコードへ直書きする必要はありません。

## Required environment variables

- `ADSENSE_PUBLISHER_ID`: `ca-pub-` から始まる16桁のパブリッシャーID
- `ADSENSE_SLOT_HOME_INFEED`: トップページの一覧内広告ユニットID
- `ADSENSE_SLOT_HOME_SIDEBAR`: PC版トップページのサイドバー広告ユニットID
- `ADSENSE_SLOT_RESULT_INLINE`: 回答結果ページのインライン広告ユニットID

広告ユニットIDが設定されていない枠はHTML上で非表示になります。パブリッシャーIDが未設定の場合は、外部のAdSenseスクリプトも読み込まれません。

## Verification

デプロイ後に次を確認します。

1. `https://minnano-question.com/ads.txt` にパブリッシャー情報が1行で表示される。
2. トップページでは質問一覧の4件目の後と、PC版ランキングの下に広告が表示される。
3. 回答済みの質問ページでは、全体・男女別結果と年代別結果の間に広告が表示される。
4. AdSense管理画面でサイトの所有権確認と審査申請を行う。

審査中の表示確認で実広告をクリックしないでください。テストが必要な場合だけ `ADSENSE_TEST_MODE=true` を設定します。

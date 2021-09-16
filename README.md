# テキスト小説用拡張機能

小説を書きながら、リアルタイムにTxtMiru on the Webで縦書きでプレビューできるようになります。<br>
テキストの形式は「小説家になろう」形式と「青空文庫」形式の２つをサポートしています。

![textnovel](./image/text-novel-top.gif)

## 使い方

### 1. 言語モードの選択
![planintext](./image/text-novel-01.png)

「小説家になろう」、「青空文庫」形式のどちらかを選択

![langmode](./image/text-novel-02.png)

### 2. 本文の作成
![write contents](./image/text-novel-03.png)
#### ルビ・傍点の入力補助

テキストを選択して、「ルビを振る」・「傍点を振る」機能を使用すると各モードに合わせて入力が補完されます。<br>
ルビを振りたい文字を選択して、右上のアイコンをクリックすると各モードに合わせたルビの記号が挿入されます。<br>
![put ruby](./image/text-novel-04.png)

### 3. 縦書きプレビュー

縦書きプレビューは、エディタ内で表示するプレビューとブラウザで表示する２つモードがあります。
1. エディタ内でプレビュー
![preview vscode](./image/text-novel-05.png)

2. ブラウザでプレビュー
![preview browser](./image/text-novel-06.png)

エディタ内で、TxtMiruサーバーを稼働させるため同じネットワーク内であればスマホやiPadなどでもプレビューを表示させることができます。

### 4. 設定

HTTPサーバーとWebSocketサーバー用のポート番号を変更することができます。<br>
既にポート番号が使用されている場合には、こちらから空いているポート番号を指定してください。

### 5. 公開済みの小説を読む

縦書きプレビュー本体は、TxtMiru on the Webをそのまま使用しています。
* 表示された画面のメニューを開き

![menu](./image/text-novel-07.png)
* 「URL」をクリック

![url](./image/text-novel-08.png)
* URLを入力して「開く」でWeb上の小説を閲覧できます。

![input url](./image/text-novel-09.png)

## リリースノート

### 1.0.0

初期リリース

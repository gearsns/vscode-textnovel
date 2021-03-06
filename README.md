# テキスト小説用拡張機能

小説を執筆しながらリアルタイムに縦書きプレビューできる機能とルビの入力をサポートする拡張機能です。<br>
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

##### ルビ一覧
| 機能 | 説明 |
| ---- | ---- |
|ルビの抽出|「ワークスペース」内のテキストファイルからルビを抽出して一覧にできます。|
|ルビの一覧を出力|ルビの一覧をテキストファイルに出力できます。|

![list ruby](./image/text-novel-ruby.gif)

##### ルビの候補
《》内でCtrl+スペースキーを押下することで一度入力したルビが候補としてポップアップに表示されます。<br>
※候補は「ルビ一覧」に表示されているものが対象となります。<br>
ルビ一覧を最新にする場合は「ルビの抽出」を実行してください。

#### キーワード
VS Codeのワークスペース機能を使い、同一フォルダに「keyword.txt」ファイルを作成すると

![keyword file](./image/text-novel-10.png)

本文中の文字がハイライトされ説明文がポップアップで表示されます。

![keyword file](./image/text-novel-11.png)

### 3. 縦書きプレビュー

縦書きプレビューは、エディタ内で表示するプレビューとブラウザで表示する２つモードがあります。
1. エディタ内でプレビュー
![preview vscode](./image/text-novel-05.png)

2. ブラウザでプレビュー
![preview browser](./image/text-novel-06.png)

プレビュー用TxtMiruサーバーを本拡張機能内で動かしているため同じネットワーク内であればスマホやiPadなどでも入力中の小説をリアルタイムにプレビューできます。

また、プレビュー画面は「[TxtMiru on the Web](https://gearsns.github.io/TxtMiruOnTheWeb/index.html) 」のエンジンを使用しているため、小説サイトに投稿後の小説もプレビューで表示できます。<br>
対応サイトは、以下の通り
* [小説家になろう](https://syosetu.com)
* [カクヨム](https://kakuyomu.jp)
* [アルファポリス](https://www.alphapolis.co.jp)
* [ハーメルン](https://syosetu.org)
* [暁](http://www.akatsuki-novels.com/)
* [エブリスタ](https://estar.jp)
* [マグネット](https://www.magnet-novels.com)
* [pixiv](https://www.pixiv.net/novel)
* [青空文庫](https://www.aozora.gr.jp)

### 4. 設定

HTTPサーバーとWebSocketサーバー用のポート番号をデフォルト設定から変更できます。<br>
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
### 1.0.6
### 1.0.5

* TxtMiru on the Web 1.0.12.0の修正を反映
	* 小説投稿サイトノベルアップ+に対応
	* お気に入り 「最新の情報に更新」チェック中のサイトがリストで分かるように変更
	* 小説家になろうで画像が表示されない不具合の修正
	* ローカルファイルの読み込み zipファイルに対応
	* ライブラリフォルダの変更(libに移動)
	* ローカルファイルの読み込みに対応
	* imgタグのdata:/image形式に対応
	* 最近読んだ小説をトップ画面に追加
* VSCode内にWeb小説からデータを取得するAPIを追加
	* WebサーバーのURL : http://localhost:ポート番号/api
	* ユーザーID ： 任意の値(空白以外であれば何を入力しても同じ)
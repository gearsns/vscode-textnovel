import * as vscode from 'vscode';
export type OriginEditor = vscode.TextEditor | "active" | undefined;
import { narou2html } from './narou';
import { aozoraText2Html } from './aozora';
import { HttpServer } from './httpServer';
import { WSServer } from './wsServer';
import * as jschardet from 'jschardet';
import * as iconv from 'iconv-lite';
import * as chokidar from 'chokidar';

// ルビ一覧
export class RubyAllFilesInWorkspaceProvider implements vscode.TreeDataProvider<RubyTreeItem> {
	constructor(private rubyList: { rb: string, rt: string }[] | null) { }
	getTreeItem(element: RubyTreeItem): vscode.TreeItem {
		return element;
	}
	getChildren(element?: RubyTreeItem): Thenable<RubyTreeItem[]> {
		let itemList: RubyTreeItem[] = [];
		if (this.rubyList) {
			for (const r of this.rubyList) {
				itemList.push(new RubyTreeItem(r.rb, r.rt));
			}
		}
		return Promise.resolve(itemList);
	}
	private _onDidChangeTreeData: vscode.EventEmitter<RubyTreeItem | undefined | null | void> = new vscode.EventEmitter<RubyTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<RubyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
	refresh(rubyList: { rb: string, rt: string }[] | null): void {
		this.rubyList = rubyList;
		this._onDidChangeTreeData.fire();
	}
}
class RubyTreeItem extends vscode.TreeItem {
	constructor(public readonly rb: string, private rt: string) {
		super(rb, vscode.TreeItemCollapsibleState.None);
		this.tooltip = `${this.rb}-${this.rt}`;
		this.description = this.rt;
	}
}

let statusBarItem: vscode.StatusBarItem; // プレビューサーバーの起動用
export function activate(context: vscode.ExtensionContext) {
	let watcher: chokidar.FSWatcher | null = null; // キーワードファイルの監視
	const httpserver = new HttpServer(context); // プレビュー用
	const wsserver = new WSServer(); // プレビューリアルタイム反映用
	let previewWebviewPanel: vscode.WebviewPanel | undefined; // プレビュー用のWebviewPanel
	let delayTime = vscode.workspace.getConfiguration('editor').get<number>("delay time", 500); // リアルタイム反映までの待ち時間
	let curAanchorLine = -1; // カレント行

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
	statusBarItem.command = 'textNovel.startPreviewServer';
	statusBarItem.tooltip = 'クリックでテキスト小説サーバーを開始';
	statusBarItem.text = "$(play) テキスト小説サーバー";
	statusBarItem.show();
	vscode.commands.executeCommand('setContext', "TextNovelServerOn", false);
	// テキストをhtmlに変換してプレビュー表示
	const convertTextToHtml = (e: vscode.TextEditor | undefined, supported: boolean = false) => {
		if (!e) {
			return "";
		}
		curAanchorLine = e.selection.anchor.line;
		if (e.document.languageId === "naroutext") { // 小説家になろうモード
			wsserver.send(narou2html(e.document.getText(), curAanchorLine));
		} else if (e.document.languageId === "aozoratext") { // 青空文庫モード
			wsserver.send(aozoraText2Html(e.document.getText(), curAanchorLine));
		} else if (supported) {
			vscode.window.showInformationMessage("未対応です");
		}
		// リアルタイム反映待ち時間を調整
		const config = vscode.workspace.getConfiguration('editor');
		delayTime = Math.min(e.document.getText().length / 100 + 5, config.get<number>("delay time", 500));
	};

	let timerIdConvertTextToHtml: NodeJS.Timeout | undefined = undefined; // リアルタイム反映用タイマーID
	// 連続で文字を入力した場合に都度をかけると処理が重くなるので、入力が終わるまでタイマーで少し遅らせてからhtmlに変換する
	const delayConvertTextToHtml = () => {
		const e = vscode.window.activeTextEditor;
		if (!e) {
			return "";
		}
		if (timerIdConvertTextToHtml) {
			clearTimeout(timerIdConvertTextToHtml);
		}
		timerIdConvertTextToHtml = setTimeout(() => {
			if (timerIdConvertTextToHtml) {
				clearTimeout(timerIdConvertTextToHtml);
			}
			timerIdConvertTextToHtml = undefined;
			convertTextToHtml(e);
		}, delayTime);
	};
	// プレビュー用httpサーバーの起動
	const startServer = (): void => {
		const config = vscode.workspace.getConfiguration('server');
		httpserver.start(config.get<number>("httpserver port", 8080));
		wsserver.start(config.get<number>("wsserver port", 5001));
		vscode.commands.executeCommand('setContext', "TextNovelServerOn", true);
		statusBarItem.command = 'textNovel.closePreviewServer';
		statusBarItem.tooltip = 'クリックでテキスト小説サーバーを停止\nテキスト小説サーバーは起動中です。';
		statusBarItem.text = "$(stop-circle) テキスト小説サーバー";
	};
	// プレビュー用httpサーバーの停止
	const closeServer = (): void => {
		httpserver.close();
		wsserver.close();
		vscode.commands.executeCommand('setContext', "TextNovelServerOn", false);
		statusBarItem.command = 'textNovel.startPreviewServer';
		statusBarItem.tooltip = 'クリックでテキスト小説サーバーを開始';
		statusBarItem.text = "$(play) テキスト小説サーバー";
	};
	// 青空文庫形式のタグを挿入
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertAozoraAnnotation', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e && e.document.languageId === "aozoratext") {
			const s = e.selection;
			const end = s.end;
			const text = e.document.getText(s);
			e.edit(edit => edit.replace(s, `${e.document.getText(s)}［＃「${text}」］`));
			if (text.length === 0) {
				const pos = new vscode.Position(end.line, end.character + 3);
				e.selection = new vscode.Selection(pos, pos);
			} else {
				const pos = new vscode.Position(end.line, end.character + text.length + 4);
				e.selection = new vscode.Selection(pos, pos);
			}
		}
	}));
	// 傍点の挿入
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertDots', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			const s = e.selection;
			if (!s.isEmpty) {
				if (e.document.languageId === "naroutext") { // 小説家になろうには傍点のタグがないのでそれぞれに「・」を振る
					e.edit(edit =>
						edit.replace(s, Array.from(e.document.getText(s)).map(x => `｜${x}《・》`).join(""))
					);
				} else if (e.document.languageId === "aozoratext") {
					e.edit(edit =>
						edit.replace(s, `${e.document.getText(s)}［＃「${e.document.getText(s)}」に傍点］`
						)
					);
				}
			}
		}
	}));
	// ルビの挿入
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertRuby', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			const s = e.selection;
			const end = s.end;
			e.edit(edit => edit.replace(s, `｜${e.document.getText(s)}《》`));
			const pos = new vscode.Position(end.line, end.character + 2);
			e.selection = new vscode.Selection(pos, pos);
		}
	}));
	// プレビュー画面の起動
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.launchPreview.vscode', (e) => {
		startServer();
		if (!previewWebviewPanel) {
			previewWebviewPanel = vscode.window.createWebviewPanel(
				"preview",
				"テキスト小説プレビュー",
				vscode.ViewColumn.Two, { enableScripts: true }
			);
			previewWebviewPanel.webview.html = `<!DOCTYPE html><style>body,iframe { padding:0;margin:0;border:none;width:100vw;height:100vh;min-height:100vh;overflow:hidden }</style><body><iframe src="http://localhost:8080" /></body>`;
			previewWebviewPanel.onDidDispose(() => { previewWebviewPanel = undefined; });
		}
		delayConvertTextToHtml();
	}));
	// ブラウザでプレビュー
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.launchPreview.browser', (e) => {
		startServer();
		vscode.env.openExternal(vscode.Uri.parse("http://localhost:8080"));
		delayConvertTextToHtml();
	}));
	// プレビューサーバーの起動
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.startPreviewServer', () => startServer()));
	// プレビューサーバーの停止
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.closePreviewServer', () => closeServer()));
	// キーワードのハイライト用
	let keywordPositionMap: Map<vscode.TextDocument, any[]> = new Map<vscode.TextDocument, any[]>();
	let keywordList: { value: string, description: vscode.MarkdownString }[] = [];
	// キーワードをファイルから読み込む
	const loadKeywordFile = async () => {
		if (watcher) {
			watcher.close();
		}
		let watchFiles: string[] = [];
		keywordList = [];
		keywordPositionMap.clear();
		if (vscode.workspace.workspaceFolders) {
			const config = vscode.workspace.getConfiguration('editor');
			let keywordOn = config.get<boolean>("keyword on", true);
			if (keywordOn) {
				let filename = config.get<string>("keyword file", "keyword.txt");
				let files: vscode.Uri[] = [];
				await Promise.all(
					vscode.workspace.workspaceFolders.map(async workspaceFolder => {
						watchFiles.push(`${workspaceFolder.uri.fsPath}/${filename}`);
						const pattern = new vscode.RelativePattern(workspaceFolder, filename);
						for (const file of await vscode.workspace.findFiles(pattern)) {
							files.push(file);
						}
					})
				);
				for (let file of files) {
					let encoding = 'utf8';
					const rawContent = await vscode.workspace.fs.readFile(file);
					const contents = Buffer.from(rawContent);
					const detected = jschardet.detect(contents) || encoding;
					if (detected && detected.encoding) {
						encoding = detected.encoding;
					}
					encoding = iconv.encodingExists(encoding) ? encoding : 'utf8';
					const convContetns = iconv.decode(contents, encoding);
					let item: { keyword: string, description: vscode.MarkdownString } = { keyword: "", description: new vscode.MarkdownString() };
					for (const line of convContetns.split(/(?:\r\n|\r|\n)/)) {
						if (line.match(/^\t+(.*)/)) {
							if (item.description.value.length !== 0) {
								item.description.appendMarkdown("\n\n");
							}
							item.description.appendMarkdown(RegExp.$1);
						} else {
							if (item.keyword.length > 0) {
								keywordList.push({ value: item.keyword, description: item.description });
							}
							if (line.match(/(.*)\t(.*)$/)) {
								item.keyword = RegExp.$1;
								item.description = new vscode.MarkdownString(`**${item.keyword}**\n\n----\n\n${RegExp.$2}`);
							} else {
								item.keyword = line;
								item.description = new vscode.MarkdownString(`**${item.keyword}**\n\n----\n\n`);
							}
						}
					}
					if (item.keyword.length > 0) {
						keywordList.push({ value: item.keyword, description: item.description });
					}
				}
			}
		}
		if (watchFiles.length > 0) {
			watcher = chokidar.watch(watchFiles, { persistent: true, ignoreInitial: true });
			watcher.on('add', path => loadKeywordFile());
			watcher.on('change', path => loadKeywordFile());
			watcher.on('unlink', path => loadKeywordFile());
		}
		_onDidChangeSemanticTokens.fire();
	};
	// ハイライト
	const _onDidChangeSemanticTokens: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	const legend = new vscode.SemanticTokensLegend(['comment'], ['declaration']);
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(['aozoratext', 'naroutext'], {
		onDidChangeSemanticTokens: _onDidChangeSemanticTokens.event,
		async provideDocumentSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
			const textList = document.getText().split(/\n/);
			let keywordPosition: any[] = [];
			const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
			for (let line = 0; line < textList.length; ++line) {
				let tmpKeywordPosition: any[] = [];
				const text = textList[line];
				for (const keyword of keywordList) {
					const length = keyword.value.length;
					let index = text.indexOf(keyword.value);
					while (index >= 0) {
						tmpKeywordPosition.push({ "line": line, "begin": index, "end": index + length, "length": length, "keyword": keyword });
						index = text.indexOf(keyword.value, index + length);
					}
				}
				for (const pos of tmpKeywordPosition.sort((a, b) => (a.index - b.index) || (b.length - a.length))) {
					let bExists = false;
					for (const pos2 of keywordPosition) {
						if (pos.line === pos2.line && pos2.begin <= pos.end && pos.begin <= pos2.end) {
							bExists = true;
							break;
						}
					}
					if (!bExists) {
						keywordPosition.push(pos);
						tokensBuilder.push(
							new vscode.Range(new vscode.Position(pos.line, pos.begin), new vscode.Position(pos.line, pos.end)),
							'comment',
							['declaration']
						);
					}
				}
			}
			keywordPositionMap.set(document, keywordPosition);
			return tokensBuilder.build();
		}
	}, legend));
	context.subscriptions.push(vscode.languages.registerHoverProvider(['aozoratext', 'naroutext'], {
		provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
			let pos: { begin: number, end: number, line: number, keyword: { value: string, description: vscode.MarkdownString } } | null = null;
			if (!keywordPositionMap.has(document)) {
				return Promise.resolve(null);
			}
			const keywordPosition = keywordPositionMap.get(document);
			if (!keywordPosition) {
				return Promise.resolve(null);
			}
			for (const pos2 of keywordPosition) {
				if (position.line === pos2.line && pos2.begin <= position.character && position.character <= pos2.end) {
					pos = pos2;
					break;
				}
			}
			if (!pos) {
				return Promise.resolve(null);
			}
			return Promise.resolve(new vscode.Hover(pos.keyword.description, new vscode.Range(new vscode.Position(position.line, pos.begin), new vscode.Position(position.line, pos.end))));
		}
	}));
	//
	let gListRuby: { rb: string, rt: string }[] | null = null;
	const rubyAllFilesInWorkspaceProvider = new RubyAllFilesInWorkspaceProvider(gListRuby);
	vscode.window.registerTreeDataProvider('rubyAllFilesInWorkspace', rubyAllFilesInWorkspaceProvider);
	const regexNarouRuby = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:([\\(（《])(.+?)[\\)）》])/g;
	const regexAozoraRuby = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:(《)(.+?)》)/g;
	const regexNarouRubySuggest = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:[\\(（《](.*?)[\\)）》])/g;
	const regexAozoraRubySuggest = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:《(.*?)》)/g;
	const regexNarouRubySuggestPart = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:[\\(（《](.*?))/g;
	const regexAozoraRubySuggestPart = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:《(.*?))/g;
	const isNarouRubyText = (str: string) => (str || "").match(/^[ぁ-んーァ-ヶ・　 ]*$/);
	// ルビ一覧の作成
	const discoverRubyAllFilesInWorkspace = async () => {
		let languageId = "aozoratext";
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			if (e.document.languageId === "naroutext") {
				languageId = "naroutext";
			}
		}
		let regexRuby = regexAozoraRuby;
		if ("naroutext" === languageId) {
			regexRuby = regexNarouRuby;
		}
		let mapRuby: { [key: string]: { rb: string, rt: string } } = {};
		let files: vscode.Uri[] = [];
		if (!vscode.workspace.workspaceFolders) {
			if (!gListRuby) {
				gListRuby = [];
			}
			if (e) {
				for (const line of e.document.getText().split(/(?:\r\n|\r|\n)/)) {
					regexRuby.lastIndex = 0;
					let m;
					while ((m = regexRuby.exec(line)) !== null) {
						let rb = m[1] || m[2];
						let bracketOpen = m[3];
						let rt = m[4];
						if (bracketOpen !== "《" && !isNarouRubyText(rt)) {
							continue;
						}
						if (rb.length > 0 && rt.length > 0 && !rt.match(/^[・﹅]+$/)) {
							mapRuby[`${rb}｜${rt}`] = {
								rb: rb,
								rt: rt
							};
						}
					}
				}
				gListRuby = Object.values(mapRuby);
				gListRuby.sort((a: { rb: string, rt: string }, b: { rb: string, rt: string }) => {
					return a.rb.localeCompare(b.rb) || a.rt.localeCompare(b.rt);
				});
			}
			return;
		} else {
			await Promise.all(
				vscode.workspace.workspaceFolders.map(async workspaceFolder => {
					const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.txt');
					for (const file of await vscode.workspace.findFiles(pattern)) {
						files.push(file);
					}
				})
			);
		}
		for (let file of files) {
			let encoding = 'utf8';
			const rawContent = await vscode.workspace.fs.readFile(file);
			const contents = Buffer.from(rawContent);
			const detected = jschardet.detect(contents) || encoding;
			if (detected && detected.encoding) {
				encoding = detected.encoding;
			}
			encoding = iconv.encodingExists(encoding) ? encoding : 'utf8';
			const convContetns = iconv.decode(contents, encoding);
			for (const line of convContetns.split(/(?:\r\n|\r|\n)/)) {
				regexRuby.lastIndex = 0;
				let m;
				while ((m = regexRuby.exec(line)) !== null) {
					let rb = m[1] || m[2];
					let bracketOpen = m[3];
					let rt = m[4];
					if (bracketOpen !== "《" && !isNarouRubyText(rt)) {
						continue;
					}
					if (rb.length > 0 && rt.length > 0 && !rt.match(/^[・﹅]+$/)) {
						mapRuby[`${rb}｜${rt}`] = {
							rb: rb,
							rt: rt
						};
					}
				}
			}
		}
		gListRuby = Object.values(mapRuby);
		gListRuby.sort((a: { rb: string, rt: string }, b: { rb: string, rt: string }) => {
			return a.rb.localeCompare(b.rb) || a.rt.localeCompare(b.rt);
		});
	};
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.outputRubyAll', async e => {
		const config = vscode.workspace.getConfiguration('editor');
		const exportType = config.get<string>("ruby export type", "colon");
		let text = "";
		if (gListRuby) {
			for (const r of gListRuby) {
				if (exportType === "tab") {
					text += `${r.rb}\t${r.rt}\n`;
				} else if (exportType === "novel") {
					text += `｜${r.rb}《${r.rt}》\n`;
				} else { // colon
					text += `${r.rb} : ${r.rt}\n`;
				}
			}
		}
		vscode.workspace.openTextDocument({ content: text, language: "aozoratext" }).then(document => {
			vscode.window.showTextDocument(document);
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.discoverRubyAllFilesInWorkspace', async (e) => {
		await discoverRubyAllFilesInWorkspace();
		rubyAllFilesInWorkspaceProvider.refresh(gListRuby);
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('server.httpserver port') || e.affectsConfiguration('server.wsserver port')) {
			startServer();
		}
		if (e.affectsConfiguration('editor.delay time')) {
			const config = vscode.workspace.getConfiguration('editor');
			delayTime = config.get<number>("delay time", 500);
		}
		loadKeywordFile();
	}));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
		if (e && (e.document.languageId === "aozoratext" || e.document.languageId === "naroutext")) {
			delayConvertTextToHtml();
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
		if (e && (e.languageId === "aozoratext" || e.languageId === "naroutext")) {
			if (vscode.window.activeTextEditor && e === vscode.window.activeTextEditor.document) {
				delayConvertTextToHtml();
			}
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
		if (e && (e.document.languageId === "aozoratext" || e.document.languageId === "naroutext")) {
			if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
				delayConvertTextToHtml();
			}
		}
	}));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
		if (e && (e.textEditor.document.languageId === "aozoratext" || e.textEditor.document.languageId === "naroutext")) {
			if (e.textEditor === vscode.window.activeTextEditor && curAanchorLine !== e.textEditor.selection.anchor.line) {
				delayConvertTextToHtml();
			}
		}
	}));
	//
	const rubyPattern = '(.*?)((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+))$';
	const reRubyPattern = new RegExp(rubyPattern, 'g');
	// ルビサジェスト
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
		['aozoratext', 'naroutext'],
		{
			async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				const line = document.lineAt(position).text;
				const linePrefix = line.substr(0, position.character);
				if (position.character <= 1 || !linePrefix.match(/《/)) {
					return undefined;
				}
				let languageId = "aozoratext";
				if (document.languageId === "naroutext") {
					languageId = "naroutext";
				}
				let regexRuby = regexAozoraRubySuggest;
				let regexRubyPart = regexAozoraRubySuggestPart;
				if ("naroutext" === languageId) {
					regexRuby = regexNarouRubySuggest;
					regexRubyPart = regexNarouRubySuggestPart;
				}
				//
				let posStartChar = position.character;
				let posEndChar = position.character;
				regexRuby.lastIndex = 0;
				regexRubyPart.lastIndex = 0;
				let m;
				let targetRb = "";
				while ((m = regexRuby.exec(line)) !== null) {
					let rb = m[1] || m[2];
					let rt = m[3];
					if (rb.length > 0) {
						const to = m.index + m[0].length;
						const from = to - rt.length - 1;
						if (from <= position.character && position.character < to) {
							posStartChar = from;
							posEndChar = to - 1;
							targetRb = rb;
							break;
						}
					}
				}
				if (targetRb.length === 0) {
					while ((m = regexRubyPart.exec(line)) !== null) {
						let rb = m[1] || m[2];
						let rt = m[3];
						if (rb.length > 0) {
							const to = m.index + m[0].length;
							const from = to - rt.length - 1;
							if (from <= position.character && position.character < to) {
								posStartChar = from;
								posEndChar = to - 1;
								targetRb = rb;
								break;
							}
						}
					}
				}
				if (targetRb.length === 0) {
					targetRb = linePrefix.slice(0, linePrefix.length - 1);
				}
				let item: vscode.CompletionItem[] = [];
				if (!gListRuby) {
					await discoverRubyAllFilesInWorkspace();
					rubyAllFilesInWorkspaceProvider.refresh(gListRuby);
				}
				if (gListRuby) {
					let rtList: string[] = [];
					for (const r of gListRuby) {
						if (targetRb === r.rb) {
							rtList.push(r.rt);
						}
					}
					for (const s of [...new Set(rtList)]) {
						let c = new vscode.CompletionItem(s);
						c.range = new vscode.Range(position.line, posStartChar, position.line, posEndChar);
						item.push(c);
					}
				}
				return item;
			}
		}
	));
	//
	loadKeywordFile();
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (statusBarItem) {
		statusBarItem.hide();
		statusBarItem.dispose();
	}
}


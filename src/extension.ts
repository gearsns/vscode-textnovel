import * as vscode from 'vscode';
export type OriginEditor = vscode.TextEditor | "active" | undefined;
import { narou2html } from './narou';
import { aozoraText2Html } from './aozora';
import { HttpServer } from './httpServer';
import { WSServer } from './wsServer';
import * as jschardet from 'jschardet';
import * as iconv from 'iconv-lite';
import * as path from 'path';
/////
export class RubyAllFilesInWorkspaceProvider implements vscode.TreeDataProvider<RubyTreeItem> {
	constructor(private rubyList:{ rb: string, rt: string }[] | null) { }

	getTreeItem(element: RubyTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: RubyTreeItem): Thenable<RubyTreeItem[]> {
		let itemList: RubyTreeItem[] = [];
		if(this.rubyList){
			for(const r of this.rubyList){
				itemList.push(
					new RubyTreeItem(r.rb, r.rt)
				);
			}
			return Promise.resolve(itemList);
		}
		if (element) {
			return Promise.resolve(itemList);
		} else {
			return Promise.resolve([]);
		}
	}
	private _onDidChangeTreeData: vscode.EventEmitter<RubyTreeItem | undefined | null | void> = new vscode.EventEmitter<RubyTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<RubyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
	refresh(rubyList:{ rb: string, rt: string }[] | null): void {
		this.rubyList = rubyList;
	  	this._onDidChangeTreeData.fire();
	}
}
class RubyTreeItem extends vscode.TreeItem {
	constructor(
		public readonly rb: string,
		private rt: string
	) {
		super(rb, vscode.TreeItemCollapsibleState.None);
		this.tooltip = `${this.rb}-${this.rt}`;
		this.description = this.rt;
	}
}
/////
let statusBarItem: vscode.StatusBarItem;
export function activate(context: vscode.ExtensionContext) {
	const httpserver = new HttpServer(context);
	const wsserver = new WSServer();
	let panel: vscode.WebviewPanel | undefined;
	let delayTime = 500;
	{
		const config = vscode.workspace.getConfiguration('editor');
		delayTime = config.get<number>("delay time", 500);
	}
	let curAanchorLine = -1;

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
	statusBarItem.command = 'textNovel.startPreviewServer';
	statusBarItem.tooltip = 'クリックでテキスト小説サーバーを開始';
	statusBarItem.text = "$(play) テキスト小説サーバー";
	statusBarItem.show();
	vscode.commands.executeCommand('setContext', "TextNovelServerOn", false);

	const convertTextToHtml = (e: vscode.TextEditor | undefined, supported: boolean = false) => {
		if (!e) {
			return "";
		}
		curAanchorLine = e.selection.anchor.line;
		if (e.document.languageId === "naroutext") {
			const text = e.document.getText();
			wsserver.send(narou2html(text, curAanchorLine));
		} else if (e.document.languageId === "aozoratext") {
			const text = e.document.getText();
			wsserver.send(aozoraText2Html(text, curAanchorLine));
		} else if (supported) {
			vscode.window.showInformationMessage("未対応です");
		}
		{
			const config = vscode.workspace.getConfiguration('editor');
			delayTime = Math.min(e.document.getText().length / 100 + 5, config.get<number>("delay time", 500));
		}
	};

	let timerIdConvertTextToHtml: NodeJS.Timeout | undefined = undefined;
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

	const startServer = (): void => {
		const config = vscode.workspace.getConfiguration('server');
		httpserver.start(config.get<number>("httpserver port", 8080));
		wsserver.start(config.get<number>("wsserver port", 5001));
		vscode.commands.executeCommand('setContext', "TextNovelServerOn", true);
		statusBarItem.command = 'textNovel.closePreviewServer';
		statusBarItem.tooltip = 'クリックでテキスト小説サーバーを停止\nテキスト小説サーバーは起動中です。';
		statusBarItem.text = "$(stop-circle) テキスト小説サーバー";
	};
	const closeServer = (): void => {
		httpserver.close();
		wsserver.close();
		vscode.commands.executeCommand('setContext', "TextNovelServerOn", false);
		statusBarItem.command = 'textNovel.startPreviewServer';
		statusBarItem.tooltip = 'クリックでテキスト小説サーバーを開始';
		statusBarItem.text = "$(play) テキスト小説サーバー";
	};

	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertAozoraAnnotation', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			const s = e.selection;
			if (e.document.languageId === "naroutext") {
			} else if (e.document.languageId === "aozoratext") {
				const end = s.end;
				const text = e.document.getText(s);
				e.edit(edit =>
					edit.replace(s, `${e.document.getText(s)}［＃「${text}」］`
					)
				);
				if (text.length === 0) {
					const pos = new vscode.Position(end.line, end.character + 3);
					e.selection = new vscode.Selection(pos, pos);
				} else {
					const pos = new vscode.Position(end.line, end.character + text.length + 4);
					e.selection = new vscode.Selection(pos, pos);
				}
			}
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertDots', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			const s = e.selection;
			if (!s.isEmpty) {
				if (e.document.languageId === "naroutext") {
					e.edit(edit =>
						edit.replace(s,
							Array.from(e.document.getText(s))
								.map(x => `｜${x}《・》`).join("")
						)
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
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.insertRuby', () => {
		const e: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (e) {
			const s = e.selection;
			const end = s.end;
			e.edit(edit =>
				edit.replace(s, `｜${e.document.getText(s)}《》`
				)
			);
			const pos = new vscode.Position(end.line, end.character + 2);
			e.selection = new vscode.Selection(pos, pos);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.launchPreview.vscode', (e) => {
		startServer();
		if (panel) {

		} else {
			panel = vscode.window.createWebviewPanel(
				"preview",
				"テキスト小説プレビュー",
				vscode.ViewColumn.Two,
				{
					enableScripts: true
				}
			);
			panel.webview.html = `<!DOCTYPE html><style>body,iframe { padding:0;margin:0;border:none;width:100vw;height:100vh;min-height:100vh;overflow:hidden }</style><body><iframe src="http://localhost:8080" /></body>`;
			panel.onDidDispose(() => { panel = undefined; });
		}
		delayConvertTextToHtml();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.launchPreview.browser', (e) => {
		startServer();
		vscode.env.openExternal(vscode.Uri.parse("http://localhost:8080"));
		delayConvertTextToHtml();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.startPreviewServer', () => startServer()));
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.closePreviewServer', () => closeServer()));
	//
	let gListRuby: { rb: string, rt: string }[] | null = null;
	const rubyAllFilesInWorkspaceProvider = new RubyAllFilesInWorkspaceProvider(gListRuby);
	vscode.window.registerTreeDataProvider('rubyAllFilesInWorkspace', rubyAllFilesInWorkspaceProvider);
	const regexNarouRuby = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:[\\(（《](.+?)[\\)）》])/g;
	const regexAozoraRuby = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:《(.+?)》)/g;
	const regexNarouRubySuggest = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:[\\(（《](.*?)[\\)）》])/g;
	const regexAozoraRubySuggest = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:《(.*?)》)/g;
	const regexNarouRubySuggestPart = /(?:(?:[\\|｜](.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:[\\(（《](.*?))/g;
	const regexAozoraRubySuggestPart = /(?:(?:｜(.+?))|((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+)))(?:《(.*?))/g;

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
			if(e){
				for (const line of e.document.getText().split(/(?:\r\n|\r|\n)/)) {
					regexRuby.lastIndex = 0;
					let m;
					while ((m = regexRuby.exec(line)) !== null) {
						let rb = m[1] || m[2];
						let rt = m[3];
						if(rb.length > 0 && rt.length > 0 && !rt.match(/^[・﹅]+$/)){
							mapRuby[`${rb}｜${rt}`] = {
								rb: rb,
								rt: rt
							};
						}
					}
				}
				gListRuby = Object.values(mapRuby);
				gListRuby.sort((a:{ rb: string, rt: string }, b:{ rb: string, rt: string }) => {
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
					let rt = m[3];
					if(rb.length > 0 && rt.length > 0 && !rt.match(/^[・﹅]+$/)){
						mapRuby[`${rb}｜${rt}`] = {
							rb: rb,
							rt: rt
						};
					}
				}
			}
		}
		gListRuby = Object.values(mapRuby);
		gListRuby.sort((a:{ rb: string, rt: string }, b:{ rb: string, rt: string }) => {
			return a.rb.localeCompare(b.rb) || a.rt.localeCompare(b.rt);
		});
	};
	context.subscriptions.push(vscode.commands.registerCommand('textNovel.outputRubyAll', async (e) => {
		const newFile = vscode.Uri.parse('untitled:ルビ一覧.txt');
		vscode.workspace.openTextDocument(newFile).then(document => {
			const edit = new vscode.WorkspaceEdit();
			let text = "";
			if(gListRuby){
				for (const r of gListRuby) {
					text += `${r.rb} : ${r.rt}\n`;
				}
			}
			edit.insert(newFile, new vscode.Position(0, 0), text);
			return vscode.workspace.applyEdit(edit).then(success => {
				if (success) {
					vscode.window.showTextDocument(document);
				} else {
					vscode.window.showInformationMessage('Error!');
				}
			});
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
	}));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
		delayConvertTextToHtml();
	}));
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
		if (vscode.window.activeTextEditor && e === vscode.window.activeTextEditor.document) {
			delayConvertTextToHtml();
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
		if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
			delayConvertTextToHtml();
		}
	}));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
		if (e.textEditor === vscode.window.activeTextEditor && curAanchorLine !== e.textEditor.selection.anchor.line) {
			delayConvertTextToHtml();
			//vscode.window.showInformationMessage("select");
		}
	}));
	//
	const rubyPattern = '(.*?)((?:[一-龠々仝〆〇ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+))$';
	const reRubyPattern = new RegExp(rubyPattern, 'g');

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
					console.log(`${rb}:${rt}`);
					if(rb.length > 0){
						const to = m.index + m[0].length;
						const from = to - rt.length - 1;
						if(from <= position.character && position.character < to){
							console.log(`000:${rb}:${rt}`);
							posStartChar = from;
							posEndChar = to - 1;
							targetRb = rb;
							break;
						}
					}
				}
				if(targetRb.length === 0){
					while ((m = regexRubyPart.exec(line)) !== null) {
						let rb = m[1] || m[2];
						let rt = m[3];
						console.log(`${rb}:${rt}`);
						if(rb.length > 0){
							const to = m.index + m[0].length;
							const from = to - rt.length - 1;
							if(from <= position.character && position.character < to){
								console.log(`${rb}:${rt}`);
								posStartChar = from;
								posEndChar = to - 1;
								targetRb = rb;
								break;
							}
						}
					}
				}
				if(targetRb.length === 0){
					targetRb = linePrefix.slice(0, linePrefix.length - 1);
				}
				let item: vscode.CompletionItem[] = [];
				if (!gListRuby) {
					await discoverRubyAllFilesInWorkspace();
					rubyAllFilesInWorkspaceProvider.refresh(gListRuby);
				}
				if (gListRuby) {
					let rtList:string[] = [];
					for (const r of gListRuby) {
						if (targetRb === r.rb) {
							rtList.push(r.rt);
						}
					}
					for(const s of [...new Set(rtList)]){
						let c = new vscode.CompletionItem(s);
						c.range = new vscode.Range(position.line, posStartChar, position.line, posEndChar);
						item.push(c);
					}
				}
				return item;
			}
		}
	));
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (statusBarItem) {
		statusBarItem.hide();
		statusBarItem.dispose();
	}
}


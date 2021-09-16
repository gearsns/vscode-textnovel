import * as vscode from 'vscode';
export type OriginEditor = vscode.TextEditor | "active" | undefined;
import { narou2html } from './narou';
import { aozoraText2Html } from './aozora';
import { HttpServer } from './httpServer';
import { WSServer } from './wsServer';

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
			//vscode.window.showInformationMessage(narou2html(text));
		} else if (e.document.languageId === "aozoratext") {
			const text = e.document.getText();
			wsserver.send(aozoraText2Html(text, curAanchorLine));
			//vscode.window.showInformationMessage(AozoraText2Html(text));
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
	// vscode.env.openExternal(vscode.Uri.parse("url"));

}

// this method is called when your extension is deactivated
export function deactivate() {
	if (statusBarItem) {
		statusBarItem.hide();
		statusBarItem.dispose();
	}
}

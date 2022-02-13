import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as iconv from 'iconv-lite';
const URL = require('url').URL;

export class HttpServer {
	private _server: any = null;
	private documentRoot: vscode.Uri;
	public port = 0;

	constructor(context: vscode.ExtensionContext) {
		this.documentRoot = vscode.Uri.joinPath(context.extensionUri, 'htdocs');
	}

	public start(port: number): void {
		if (this.listening()) {
			if (this.port !== port) {
				this.close();
			} else {
				return;
			}
		}
		this.port = port;
		this.startHttpServer();
	}

	public close(): void {
		if (this._server) {
			this._server.close();
		}
	}

	public listening(): boolean {
		if (this._server) {
			return this._server.listening;
		}
		return false;
	}

	private getFavoriteByUrl(parameter: any) {
		const targetUrl = parameter.get('url');
		const config = vscode.workspace.getConfiguration('server');
		const filename = config.get<string>("httpserver favorite file path", "");
		interface Obj {
			values: any[];
		};
		let arr: Obj = {
			values: []
		};
		if (filename.length === 0) {
			return arr;
		}
		try {
			const json = JSON.parse(fs.readFileSync(filename, 'utf8'));
			for (const item of json) {
				if (item.url === targetUrl) {
					arr.values.push(item);
				}
			}
		} catch { }
		return arr;
	}
	private getFavorites(parameter: any) {
		const config = vscode.workspace.getConfiguration('server');
		const filename = config.get<string>("httpserver favorite file path", "");
		interface Obj {
			values: any[];
		};
		let arr: Obj = {
			values: []
		};

		if (filename.length === 0) {
			return arr;
		}
		try {
			arr.values = JSON.parse(fs.readFileSync(filename, 'utf8'));
		} catch { }
		return arr;
	}
	private deleteFavorite(parameter: any) {
		const id = parameter.get('id');
		const config = vscode.workspace.getConfiguration('server');
		const filename = config.get<string>("httpserver favorite file path", "");
		if (filename.length === 0) {
			return { "result": false };
		}
		try {
			let arr = [];
			const json = JSON.parse(fs.readFileSync(filename, 'utf8'));
			for (const item of json) {
				if (item.id !== id) {
					arr.push(item);
				}
			}
			fs.writeFileSync(filename, JSON.stringify(arr));
		} catch { }
		return { "result": true };
	}
	private updateFavorite(parameter: any) {
		const id = parameter.get('id');
		const config = vscode.workspace.getConfiguration('server');
		const filename = config.get<string>("httpserver favorite file path", "");
		if (filename.length === 0) {
			return { "result": false };
		}
		let arr = [];
		let json = [];
		try {
			json = JSON.parse(fs.readFileSync(filename, 'utf8'));
		} catch { }
		for (const item of json) {
			if (item.id === id) {
				for (const key of ["name", "author", "url", "cur_page", "max_page", "cur_url"]) {
					if (parameter.get(key)) {
						item[key] = parameter.get(key);
					}
				}
			}
			arr.push(item);
		}
		fs.writeFileSync(filename, JSON.stringify(arr));
		return { "result": true };
	}
	private addFavorite(parameter: any) {
		const config = vscode.workspace.getConfiguration('server');
		const filename = config.get<string>("httpserver favorite file path", "");
		if (filename.length === 0) {
			return { "result": false };
		}
		let id = 1;
		let json = [];
		try {
			json = JSON.parse(fs.readFileSync(filename, 'utf8'));
		} catch { }
		for (const item of json) {
			if (parseInt(item.id) > id) {
				id = parseInt(item.id);
			}
		}
		let item: { [key: string]: any } = {};
		for (const key of ["name", "author", "url", "cur_page", "max_page", "cur_url"]) {
			if (parameter.get(key)) {
				item[key] = parameter.get(key);
			}
		}
		item['id'] = id + 1;
		json.push(item);
		fs.writeFileSync(filename, JSON.stringify(json));
		return { "result": true };
	}

	private startHttpServer(): boolean {
		const app = async (req: http.IncomingMessage, res: http.ServerResponse) => {
			const uri = req.url;
			if (req.method === "GET" && uri!.match(/^\/api\?/)) {
				const urlParse = new URL("http://localhost" + uri!);
				const func: string = (urlParse.searchParams.get("func") || "");
				let inParam = urlParse.searchParams;
				let item: any = [];
				switch (func) {
					case 'get_favorite_by_url': item = this.getFavoriteByUrl(inParam); break;
					case 'get_favorites': item = this.getFavorites(inParam); break;
					case 'delete_favorite': item = this.deleteFavorite(inParam); break;
					case 'update_favorite': item = this.updateFavorite(inParam); break;
					case 'add_favorite': item = this.addFavorite(inParam); break;
					default:
						{
							const urlParse = new URL("http://localhost" + uri!);
							const siteUrl: any = (urlParse.searchParams.get("url") || "");
							const charset = urlParse.searchParams.get("charset") || 'UTF-8';
							let cookie = urlParse.searchParams.get("cookie") || "";
							if (cookie === "request") {
								const response = await axios.get(siteUrl);
								cookie = response.headers['set-cookie'].join(";");
							}

							axios.get(siteUrl, {
								responseType: 'arraybuffer', transformResponse: (data) => {
									const buffer = Buffer.from(data, 'binary');
									let utf8 = buffer.toString('utf8');
									if (charset === "Auto") {
										if (utf8.match(/charset.*shift/i)) {
											return iconv.decode(buffer, "SHIFT_JIS");
										} else if (utf8.match(/charset.*euc/i)) {
											return iconv.decode(buffer, "euc-jp");
										}
									} else if (charset && charset.length > 0) {
										return iconv.decode(buffer, charset);
									}
									return utf8;
								}, "headers": {
									'cookie': cookie,
									// eslint-disable-next-line @typescript-eslint/naming-convention
									"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
									// eslint-disable-next-line @typescript-eslint/naming-convention
									"Access-Control-Allow-Origin": "*"
								}
							}).then(response => {
								res.writeHead(200, { "content-type": "text/plain" });
								res.write(response.data);
								res.end();
							}).catch(error => {
								res.writeHead(200, { "content-type": "text/plain" });
								res.end(error.message);
							});
							return;
						}
				}
				res.writeHead(200, { "content-type": "application/json; charset=UTF-8;" });
				res.write(JSON.stringify(item));
				res.end();
				return;
			}
			let filename = path.join(this.documentRoot.fsPath, uri!).replace(/\?.*$/, "");
			fs.stat(filename, (err, stats) => {
				if (err) {
					res.writeHead(404, { "content-type": "text/plain" });
					res.write("404 Not Found\n");
					res.end();
					return;
				}
				if (fs.statSync(filename).isDirectory()) { filename += '/index.html'; }
				fs.readFile(filename, (err, file) => {
					if (err) {
						res.writeHead(500, { "content-type": "text/plain" });
						res.write(err + "\n");
						res.end();
						return;
					}
					const CONTENT_TYPE_LIST: { [key: string]: string } = {
						".html": "text/html",
						".css": "text/css",
						".js": "text/javascript",
						".json": "application/json",
						".jpg": "image/jpeg",
						".png": "image/png",
						".ico": "image/vnd.microsoft.icon"
					};
					const fileext = path.extname(filename);
					const CONTENT_TYPE = CONTENT_TYPE_LIST[fileext];
					if (CONTENT_TYPE) {
						res.writeHead(200, {
							"content-type": CONTENT_TYPE
						});
						res.write(file);
					} else {
						res.writeHead(200, {
							"access-control-allow-origin": "*",
							"pragma": "no-cache",
							"cache-control": "no-cache"
						});
						res.write(file, "binary");
					}
					res.end();
				});
			});
		};
		this._server = http.createServer(app);
		this._server.listen(this.port);
		return true;
	};
}

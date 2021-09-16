import * as vscode from 'vscode';
import * as WebSocket from 'ws';

export class WSServer {
	private _server: any = null;
	public port = 0;
	private buffer:string = "";

	constructor() {
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
		const server = WebSocket.Server;
		this._server = new server({ port: this.port });
		this._server.on('connection', (ws:any) => {
			ws.on('message', (message:WebSocket.MessageEvent) => {
				let text:string = message.toString();
				try {
					const json = JSON.parse(text.toString());
					if(json.reload){
						text = JSON.stringify({url:"TxtMiru://websocket#current_line", html:this.buffer});
					}
				} catch{}
				this._server.clients.forEach((client:WebSocket) => {
					client.send(text);
				});
			});
			ws.on('close', () => {
				//this._server = null;
			});
		});
	}

	public close(): void {
		if (this._server) {
			this._server.close();
		}
	}

	public listening(): boolean {
		if (this._server) {
			return true;
		}
		return false;
	}

	public send(text: string): void {
		this.buffer = text;
		if(this._server){
			this._server.clients.forEach((client: WebSocket) => {
				client.send(JSON.stringify({url:"TxtMiru://websocket#current_line", html:text}));
			});
		}
	}
}

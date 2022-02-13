export const narou2html = (text: string, curRow: number = -1) => {
	const isNarouRubyText = (str: string) => (str || "").match(/^[ぁ-んーァ-ヶ・　 ]*$/);
	const totext = (html: string) => html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	let ret = [];
	for (const line of text.split(/(?:\r\n|\r|\n)/)) {
		let rubyStartIndex = -1;
		let lineItem: any = [];
		for (const target of line.split(/(｜|\||[《（\()].*?[》）\)]|<.+\|.+>)/)) {
			const rubyStart2Text = (index: number) => {
				if (index > 0 && lineItem[index - 1].type === "ruby-start") {
					lineItem[index - 1].type = "text";
				}
			};
			const setMax10character = () => {
				if (lineItem[rubyStartIndex].text.length > 10) {
					rubyStart2Text(rubyStartIndex);
					// 後ろの１０文字分にルビがかかります。
					const rubyBase = lineItem[rubyStartIndex].text;
					lineItem[rubyStartIndex].text = rubyBase.slice(0, rubyBase.length - 10);
					lineItem.push({ type: "text", text: rubyBase.slice(rubyBase.length - 10) });
					++rubyStartIndex;
				}
			};
			const splitRuby2 = (target: any, text: string, splitType: number) => {
				let itemType = "ruby";
				if (lineItem[rubyStartIndex].text.match(/^(.*[　 ])(.*)([　 ])(.*)$/)) {
					// スペースを 一つ 含む場合、分割してルビが振られます。
					const orgText = RegExp.$1;
					const rubyBase1 = RegExp.$2;
					const rubyBase2 = RegExp.$4;
					const space = RegExp.$3;
					if (text.match(/^(.*)([　 ])(.*)$/)) {
						const orgRubyStartIndex = rubyStartIndex;
						text = RegExp.$3;
						lineItem[rubyStartIndex].text = orgText;
						lineItem.push({ type: "text", text: rubyBase1 });
						rubyStartIndex = lineItem.length - 1;
						lineItem.push({ type: "ruby", text: RegExp.$1, start: rubyStartIndex });
						lineItem.push({ type: "text", text: "　"/*space*/ });
						lineItem.push({ type: "text", text: rubyBase2 });
						rubyStartIndex = lineItem.length - 1;
						rubyStart2Text(orgRubyStartIndex);
					}
				} else if (splitType === 1 && lineItem[rubyStartIndex].text.match(/^(.*)([　 ])(.*)$/)) {
					// スペースを 一つ 含む場合、分割してルビが振られます。
					const rubyBase1 = RegExp.$1;
					const rubyBase2 = RegExp.$3;
					const space = RegExp.$2;
					if (text.match(/^(.*)([　 ])(.*)$/)) {
						text = RegExp.$3;
						lineItem[rubyStartIndex].text = rubyBase1;
						lineItem.push({ type: "ruby", text: RegExp.$1, start: rubyStartIndex });
						lineItem.push({ type: "text", text: "　"/*space*/ });
						lineItem.push({ type: "text", text: rubyBase2 });
						rubyStartIndex = lineItem.length - 1;
					}
				}
				return [text, itemType];
			};
			const splitRuby = (target: any, text: string) => {
				let itemType = "ruby";
				if ((text.match(/[　 ]/g) || []).length >= 2) {
					itemType = "text";
					rubyStart2Text(rubyStartIndex);
				} else if (text.match(/[　 ].+/)) {
					return splitRuby2(target, text, 0);
				}
				return [text, itemType];
			};
			const autoDetectRubyBase = (target: any, text: string) => {
				let itemType = "ruby";
				if ((text.match(/[　 ]/g) || []).length >= 2) {
					itemType = "text";
					rubyStart2Text(rubyStartIndex);
				} else if (text.match(/[　 ].+/)) {
					// 々 及び 〇(ゼロ) は漢字として認識させない
					let pattern = '(.*?)((?:[一-龠仝〆ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ　 ]+))$';
					const re = new RegExp(pattern, 'g');
					const preText = lineItem[lineItem.length - 1].text;
					if (preText.match(re)) {
						lineItem[lineItem.length - 1].text = RegExp.$1;
						lineItem.push({ type: "text", text: RegExp.$2 });
						rubyStartIndex = lineItem.length - 1;
						setMax10character();
						return splitRuby2(target, text, 1);
					} else {
						itemType = "text";
					}
				} else {
					// 々 及び 〇(ゼロ) は漢字として認識させない
					let pattern = '(.*?)((?:[一-龠仝〆ヶ]+|[-_@0-9a-zA-Z]+|[—―＿＠０-９Ａ-Ｚａ-ｚ]+))$';
					const re = new RegExp(pattern, 'g');
					const preText = lineItem[lineItem.length - 1].text;
					if (preText.match(re)) {
						lineItem[lineItem.length - 1].text = RegExp.$1;
						lineItem.push({ type: "text", text: RegExp.$2 });
						rubyStartIndex = lineItem.length - 1;
						setMax10character();
					} else {
						itemType = "text";
					}
				}
				return [text, itemType];
			};
			//
			if (target.match(/^<(.*)\|(.*)>$/)) {
				const icode = RegExp.$1;
				const userid = RegExp.$2;
				lineItem.push({ type: "tag", text: `<a href="https://${userid}.mitemin.net/${icode}" target="_blank"><img src="https://${userid}.mitemin.net/userpageimage/viewimagebin/icode/${icode}" alt="挿絵(by みてみん)" border="0"></a>` });
			} else if (target.match(/^《(.*?)[）\)》]$/)) {
				let itemType = "ruby";
				let text = RegExp.$1;
				if (text.length > 20) {
					// ｜を使った場合でも、自動ルビ化でも、 ルビ 部分が２０文字を超えるとルビ化はされません。
					if (rubyStartIndex >= 0) {
						lineItem[rubyStartIndex].type = "text";
					}
					itemType = "text";
				} else if (rubyStartIndex >= 0) {
					if (lineItem.length === 0 || rubyStartIndex === lineItem.length - 1 || lineItem[rubyStartIndex + 1].text.length > 10) {
						// ルビを振りたくない場合
						if (rubyStartIndex === lineItem.length - 1) {
							lineItem[rubyStartIndex].text = "";
						}
						lineItem[rubyStartIndex].type = "text";
						itemType = "text";
					}
					++rubyStartIndex;
					if (itemType === "ruby") {
						[text, itemType] = splitRuby(target, text);
					}
					if (itemType === "ruby") {
						setMax10character();
					}
					if (itemType === "ruby" && target.match(/^《.*[）\)]$/)) {
						// バグ再現用
						text = text.replace(/[ 　].*$/, "");
					}
				} else if (lineItem.length > 0) {
					if (isNarouRubyText(text) && !text.match(/^[ 　]/)) {
						// 自動で範囲を探すのは、ひらがな、カタカナ、ー、・(中黒)、スペース のみ
						[text, itemType] = autoDetectRubyBase(target, text);
					} else {
						itemType = "text";
					}
				}
				if (itemType === "ruby") {
					lineItem.push({ type: itemType, text: text, start: rubyStartIndex });
				} else {
					lineItem.push({ type: itemType, text: target });
				}
				rubyStartIndex = -1;
			} else if (target.match(/^[（\()](.*?)[）\)》]$/)) {
				let itemType = "ruby";
				let text = RegExp.$1;
				if (text.length > 20) {
					// ｜を使った場合でも、自動ルビ化でも、 ルビ 部分が２０文字を超えるとルビ化はされません。
					if (rubyStartIndex >= 0) {
						lineItem[rubyStartIndex].type = "text";
					}
					itemType = "text";
				} else if (isNarouRubyText(text) && !text.match(/^[ 　]/) && (text.match(/[ 　]/g) || []).length < 2) {
					// （）で使えるルビは、ひらがな、カタカナ、ー、・(中黒)、スペース のみ
					// スペースがカッコ直後ならルビにしない
					// スペースが2つ以上含む場合、ルビにしない
					if (rubyStartIndex >= 0) {
						if (lineItem.length === 0 || rubyStartIndex === lineItem.length - 1 || lineItem[rubyStartIndex + 1].text.length > 10) {
							// ルビを振りたくない場合
							if (rubyStartIndex === lineItem.length - 1) {
								lineItem[rubyStartIndex].text = "";
							}
							lineItem[rubyStartIndex].type = "text";
							itemType = "text";
						}
						++rubyStartIndex;
						if (itemType === "ruby") {
							[text, itemType] = splitRuby(target, text);
						}
						if (itemType === "ruby") {
							setMax10character();
						}
						if (itemType === "ruby") {
							// バグ再現用
							text = text.replace(/[ 　].*$/, "");
						}
					} else if (lineItem.length > 0) {
						[text, itemType] = autoDetectRubyBase(target, text);
					}
				} else {
					if (rubyStartIndex >= 0) {
						lineItem[rubyStartIndex].type = "text";
					}
					itemType = "text";
				}
				if (itemType === "ruby") {
					lineItem.push({ type: itemType, text: text, start: rubyStartIndex });
				} else {
					lineItem.push({ type: itemType, text: target });
				}
				rubyStartIndex = -1;
			} else if (target.match(/^[｜\|]/)) {
				if (rubyStartIndex >= 0) {
					lineItem[rubyStartIndex].type = "text";
				}
				rubyStartIndex = lineItem.length;
				lineItem.push({ type: "ruby-start", text: target });
			} else if (target && target.length > 0) {
				lineItem.push({ type: "text", text: target });
			}
		}
		if (rubyStartIndex >= 0) {
			lineItem[rubyStartIndex].type = "text";
		}
		for (const item of lineItem) {
			if (item.type === "ruby" && lineItem[item.start]) {
				lineItem[item.start].type = "ruby_rb";
			}
		}
		ret.push(lineItem);
	}
	let htmlArr = [];
	for (let row = 0; row < ret.length; ++row) {
		const lineItem = ret[row];
		if (row === curRow) {
			htmlArr.push(`<p class="current_line"><a name="current_line"></a>`);
		} else {
			htmlArr.push("<p>");
		}
		for (const item of lineItem) {
			if (item.type === "text") {
				htmlArr.push(totext(item.text));
			} else if (item.type === "ruby" && lineItem[item.start]) {
				htmlArr.push(`<ruby>${lineItem[item.start].text}<rt>${item.text}</rt></ruby>`);
			} else if (item.type === "tag") {
				htmlArr.push(item.text);
			}
		}
		htmlArr.push("</p>");
	}
	return htmlArr.join("");
};
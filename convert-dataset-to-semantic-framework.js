const fs = require('fs');
const cheerio = require("cheerio");

let dataset = JSON.parse(fs.readFileSync("./cleaned-dataset.json", "utf-8"));

const loadCSSAsJson = () => {
	const cssFramework = fs.readFileSync("./semantic-css-framework.css", "utf-8");

	const jsonObj = {}
	for (const [i, firstSplit] of cssFramework.split("}").entries()) {
		if (firstSplit.split("{").length !== 2) {
			continue;
		}
		
		const key = firstSplit.split("{")[0].trim().slice(1)
		const value = firstSplit.split("{")[1].trim().split(";").map((cssStyle) => {
			return cssStyle.trim();
		});
		if (value[value.length-1].length === 0) {
			value.pop()
		}
		jsonObj[key] = value
	}
	return jsonObj

}

// [
// 	`[TINY-WEBDEV-LLM-QUESTION]
// 	 Question...
// 	 [TINY-WEBDEV-LLM-ANSWER]
// 	 ANSWER....our super contextual awesome html`
// ]
async function main() {
	const cssFramework = loadCSSAsJson()
	console.log(cssFramework)

	// framework-izing each element
	const compressWithCssFramework = (styleArray) => {
		// first match compress
		const listOfClasses = [];
		for (let cssClassName of Object.keys(cssFramework)) {
			// array of styles
			const cssClass = cssFramework[cssClassName]

			// true or false if it's a match in the style array
			const isMatch = cssClass.reduce((a, b) => {
				if (typeof a === "boolean") {
					return a && styleArray.indexOf(b) > -1
				} else {
					// first iteration
					return styleArray.indexOf(a) > -1 && styleArray.indexOf(b) > -1 
				}
			})

			if (isMatch) {
				// removing the class from the styleArry
				for (let style of cssClass) {
					styleArray.splice(styleArray.indexOf(style) > -1, 1)
				}
				listOfClasses.push(cssClassName)
			}
		}

		return [listOfClasses, styleArray]
	}

	dataset = dataset.map((datasetItem) => {
		const $ = cheerio.load(Buffer.from(datasetItem['html'].data).toString())

		Array.from($("*")).forEach((element) => {
			if (!$(element).attr('style')) return

			const styleArray = $(element).attr('style').split(";").map((style) => style.trim())
			const [listOfClasses, leftOverStyles] = compressWithCssFramework(styleArray)
			// console.log(listOfClasses, leftOverStyles.length)
			$(element).attr('class', listOfClasses.join(' '))

			// reattach style attribute with styles left over
			if (leftOverStyles.length === 0) {
				$(element).removeAttr('style');				
			} else {
				$(element).attr('style', leftOverStyles.join('; '));
			}

		});
		datasetItem['html'] = $.html();
		return datasetItem
	});

	fs.writeFileSync("./semantic-css-dataset.json", JSON.stringify(dataset, null, 2))
	return true;
}

main()
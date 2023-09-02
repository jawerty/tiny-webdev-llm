const cleaner = require('clean-html');
const fs = require("fs");
const cheerio = require('cheerio');

function run() {
	const preSemanticCssDataset = JSON.parse(fs.readFileSync('./topic_dataset.json', "utf-8"))
	const semanticCssDataset = JSON.parse(fs.readFileSync('./semantic-css-dataset.json', "utf-8"))
	const randItemIndex = Math.floor(Math.random() * semanticCssDataset.length)

	// saving pre semantic css
	const randItemPre = preSemanticCssDataset[randItemIndex]
	let $ = cheerio.load(Buffer.from(randItemPre['html'].data).toString())
	cleaner.clean($.html(), (output) => {
		fs.writeFileSync("./pre-semantic-test.html", output)
	})
	// saving post semantic css
	const randItemPost = semanticCssDataset[randItemIndex]
	$ = cheerio.load(randItemPost['html'])
	cleaner.clean($.html(), (output) => {
		fs.writeFileSync("./post-semantic-test.html", output)
	})
	
	console.log("Pre/Post test files written!")
	return true;
}

run()
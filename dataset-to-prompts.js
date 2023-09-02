const fs = require('fs');


/*
dataset = [
	{
		"label": "title of webpage",
		"html": "html snapshots using semantic css framework",
		"metadata": "inner text of the webpage" (no longer using this)
	},
	....
]
*/

const dataset = JSON.parse(fs.readFileSync('./semantic-css-dataset.json'))

async function run() {
	dataset = dataset.map((datasetItem) => {
		return `[TINY-WEBDEV-QUESTION]\n${datasetItem.label}\n[TINY-WEBDEV-ANSWER]\n${datasetItem.html}`
	})
	fs.writeFileSync("./final-dataset.json", JSON.stringify(dataset))
	return true
}

run()
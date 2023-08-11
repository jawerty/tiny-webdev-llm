const fs = require("fs");

const dataset = JSON.parse(fs.readFileSync('./topic_dataset.json'))

async function run() {
	console.log(dataset.map((item) => {
		item['html'] = "[HTML]"
		return item
	}))
}

run();
const fs = require("fs");

const dataset = JSON.parse(fs.readFileSync('./dataset-0.json'))

async function run() {
	fs.writeFileSync("./cleaned-dataset.json", JSON.stringify(dataset.filter((item) => {
		const htmlString = Buffer.from(item.html.data).toString();
		return htmlString.split(" ").length < 52000;
	})))
}

run();
const fs = require("fs");
const cheerio = require("cheerio");
const dataset = JSON.parse(fs.readFileSync('./dataset-0.json'))

async function run() {
	console.log("DATASET SIZE:", dataset.length)
	const cleanedDataset = dataset.filter((item) => {
		const htmlString = item.html
		return htmlString.split(" ").length < 52000;
	})
	console.log("CLEANED DATASET SIZE:", cleanedDataset.length)
	fs.writeFileSync("./cleaned-dataset.json", JSON.stringify(cleanedDataset))
	return true;
}

run();
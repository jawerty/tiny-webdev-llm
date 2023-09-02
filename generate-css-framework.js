const fs = require("fs");
const cheerio = require("cheerio");

const dataset = JSON.parse(fs.readFileSync("./topic_dataset.json", "utf-8"))


const maxClassSize = 10;
const percentileThreshold = 50;
const classStringSize = 6;
// for testing
const styleLimit = 1000

// if you build it they will come

async function run() {
	let occurrenceMap = new Map()

	const randStr = (n) => {
		const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWYZ1234567890"
		let newStr = ''
		for (let i = 0; i < n; i++) {
			newStr += chars[Math.floor(Math.random() * chars.length)]
		}
		return newStr
	}

	const createFramework = (topicName) => {
		// get top 10% of classes to add to framework
		let maxOccurrence = 0;
		let minOccurrence = 0; // probably going to be 1
		occurrenceMap.forEach((val) => {
			// initialize min occurrence
			if (minOccurrence === 0) {
				minOccurrence = val
			}
			if (maxOccurrence < val) {
				maxOccurrence = val
			}
			if (minOccurrence > val) {
				minOccurrence = val
			}
		})

		const percentile = 100 - percentileThreshold;
		// simple proportion
		const threshold = ((maxOccurrence-minOccurrence) * percentile)/100
		console.log("Min: ", minOccurrence)
		console.log("Max: ", maxOccurrence)
		console.log("Percentile: ", percentile)
		console.log("Threshold: ", threshold)
		const framework = {};

		Array.from(occurrenceMap.keys()).filter((comboHash) => {
			return occurrenceMap.get(comboHash) >= threshold
		}).forEach((comboHash) => {
			framework[comboHash] = `${topicName}-${randStr(classStringSize)}`
		});

		return framework
	}

	const shuffle = (array) => {
	  let currentIndex = array.length,  randomIndex;

	  // While there remain elements to shuffle.
	  while (currentIndex != 0) {

	    // Pick a remaining element.
	    randomIndex = Math.floor(Math.random() * currentIndex);
	    currentIndex--;

	    // And swap it with the current element.
	    [array[currentIndex], array[randomIndex]] = [
	      array[randomIndex], array[currentIndex]];
	  }

	  return array;
	}
		
	// `${topic1}-${topic2}-${randStr(5)}`

	const combinations = (array) => {
	 	return new Array(1 << array.length).fill().map(
	   		(e1, i) => array.filter((e2, j) => i & 1 << j));
	}

	const topicMapping = {}
	for (let datasetItem of dataset) {
		const $ = cheerio.load(datasetItem['html'])

		Array.from($("*")).forEach((element) => {
			if (!$(element).attr('style')) return

			const styleArray = $(element).attr('style').split(";").map((style) => style.trim())

			if (datasetItem["topic"] in topicMapping) {
				topicMapping[datasetItem["topic"]].push(styleArray)
			} else {
				topicMapping[datasetItem["topic"]] = [styleArray]
			}
		});
	}

	const mergedFramework = {}
	console.log("Topic Count:", Object.keys(topicMapping).length)
	for (let topic in topicMapping) {
		console.log("Getting css framework for topic:", topic);
		occurrenceMap = new Map()

		for (let [i, styleArray] of topicMapping[topic].entries()) {
			if (styleLimit && styleLimit === i-1) {
				console.log("Breaking early (memory efficient)")
				break
			}
			// remove null values
			if (styleArray[0].length === 0) {
				styleArray.shift()
			}
			if (styleArray[styleArray.length-1].length === 0) {
				styleArray.pop()
			}
			console.log(i, "of", topicMapping[topic].length)
			console.log("Style count:", styleArray.length)
			console.log("Occurrence map size", Array.from(occurrenceMap.keys()).length, "\nMore than 1:", Array.from(occurrenceMap.keys()).filter((k) => occurrenceMap.get(k) > 1).length)
			// get all permutations of subarrays
			const styleCombinations = combinations(shuffle(styleArray).slice(0,maxClassSize)).filter((combo) => {
				return combo.length > 2;
			});

			// styleCombo => occurence(int)
			console.log("getting occurrences", styleCombinations.length);
			const comboHashFunc = (styleCombination) => {
				// very important for maintaining order in the occurrence map search
				return styleCombination.sort().join(";")
			}

			// temporary occurrence map
			const styleCombinationsOccurrenceMap = {}
			styleCombinations.map((combo) => comboHashFunc(combo)).forEach((comboHash) => {
				if (comboHash in styleCombinationsOccurrenceMap) {
					styleCombinationsOccurrenceMap[comboHash]++
				} else {
					styleCombinationsOccurrenceMap[comboHash] = 1
				}
			});

			// merge the occurrence values
			for (let comboHash of Object.keys(styleCombinationsOccurrenceMap)) {
				if (occurrenceMap.has(comboHash)) {
					occurrenceMap.set(comboHash, occurrenceMap.get(comboHash) + styleCombinationsOccurrenceMap[comboHash])
				} else {
					occurrenceMap.set(comboHash, styleCombinationsOccurrenceMap[comboHash])
				}
			}
		}

		// comboHash => cssClass
		const topicFramework = createFramework(topic)
		for (let comboHash of Object.keys(topicFramework)) {
			if (comboHash in mergedFramework) {
				// append topic name to class name if it already exists
				mergedFramework[comboHash] = `${topicFramework[comboHash].split('-')[0]}-${mergedFramework[comboHash]}` 
			} else {
				mergedFramework[comboHash] = topicFramework[comboHash]
			}
		}
		fs.writeFileSync(`tmp-${topic}-framework.json`, JSON.stringify(createFramework(topic)))
	}

	let finalFramework = ""
	for (let comboHash of Object.keys(mergedFramework)) {
		const cssStyle = `.${mergedFramework[comboHash]} {\n${comboHash.split(";").map((
			(style) => `\t${style};\n`
		)).join('')}}\n`
		finalFramework += cssStyle
	}

	console.log("Writing Final Framework")
	fs.writeFileSync(`semantic-css-framework.css`, finalFramework)


}

run()
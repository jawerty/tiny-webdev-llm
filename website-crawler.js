const { Buffer } = require("node:buffer");
const minifyHtml = require("@minify-html/node");

const puppeteer = require('puppeteer');
const fs = require('fs');

const dataset = JSON.parse(fs.readFileSync('./dataset-0.json', "utf-8"))

const controlStyles = JSON.parse(fs.readFileSync('./control-styles-dictionary.json', 'utf-8'))

const urlLog = [];

const domainMaxes = {}

// don't go to this domain more than this
const domainLimit = 10

// How far to go from the seeds  
const maxSeedDepth = 5;

// how many outboundLinks to get per website
const outboundLinkLimit = 7;

// skip elements with this size 
const elementCountLimit = 750;

function timeout(miliseconds) {
	return new Promise((resolve) => {
		setTimeout(() => {resolve()}, miliseconds)
	})
}

// function expression
const setupBrowser = async () => {
  const viewportHeight = 1024;
  const viewportWidth = 1080;
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0); 
  await page.setViewport({width: viewportWidth, height: viewportHeight});
  
  page.on('console', async (msg) => {
	const msgArgs = msg.args();
	for (let i = 0; i < msgArgs.length; ++i) {
	  try {
		console.log(await msgArgs[i].jsonValue());
	  } catch(e) {
	  	console.log(e);
	  }
    }
  });

  return [browser, page]
}

async function embedStyles(page) {
	await page.evaluate((controlStyles) => {
		let controlElementsCount = 25;
		let controlElementsIndex = 0;
		window.controlStyles = controlStyles;
		window.embedHTML = (element, root) => {
			return new Promise((resolve) => {
				if (!element) {

				}
				const unstylableElement = ['svg', 'SCRIPT', 'NOSCRIPT', 'STYLE'].includes(element.tagName)
				if (!unstylableElement) {
					let styles = []
					try {
						const targetDOMElement = element;
						const targetObjsStyles = window.getComputedStyle(targetDOMElement);

						let controlElementsCSS = window.controlStyles[targetDOMElement.tagName.toLowerCase()]

						let tempCopyOfTarget
						if (!controlElementsCSS) {
							console.log("element not in control css", controlElementsIndex, "/", controlElementsCount)
							if (controlElementsCount >= controlElementsIndex) {
								return "STOP" 
							}
							controlElementsIndex++
							controlElementsCSS = {}
							tempCopyOfTarget = targetDOMElement.cloneNode(false)
							targetDOMElement.insertAdjacentElement('afterend', tempCopyOfTarget);
							const computedStylesForControl = window.getComputedStyle(tempCopyOfTarget);
							Object.entries(computedStylesForControl).forEach(p=>{
								const cssDeclaration = computedStylesForControl.item(p[0])
								controlElementsCSS[cssDeclaration] = computedStylesForControl.getPropertyValue(cssDeclaration)
							});
						}

						Object.entries(targetObjsStyles).forEach((p) => {
							const targetCssDeclaration = targetObjsStyles.item(p[0])
							const targetPropValue = targetObjsStyles.getPropertyValue(targetCssDeclaration)
							const controlPropValue = controlElementsCSS[targetCssDeclaration]
							if(targetPropValue !== controlPropValue) { 
								styles.push(`${targetCssDeclaration}: ${targetPropValue};`)
							}
						});

						element.style = styles.join(' ')
					} catch(e) {
						console.log(e.message)
					}

				}

				if (!unstylableElement) {
					if (element.children && element.children.length > 0) {

						for (let [i, child] of Array.from(element.children).entries()) {
							// console.log("child " + i + ' ' + child.tagName)
							if (child?.tagName) {
								const result = window.embedHTML(child, false)
								if (result === "STOP") {
									return "STOP"
								}
							}
						}
					}
				}
				

				if(root) {
					resolve()
				}
			})

	
		}

		return window.embedHTML(document.body, true)
	}, controlStyles)
}

async function cleanHTML(page) {
	return await page.evaluate(() => {
		// clean the html
		// clean attributes
		function cleanHTML(element) {

			element.removeAttribute('class')
			element.removeAttribute('id')
			const attrsToDelete = Array.from(element.classList).filter((_class) => {
				return _class.indexOf('data-') === 0 || _class.indexOf('aria-')
			});
			for (let attr of attrsToDelete) {
				element.removeAttribute(attr);
			}
			if (element.children && element.children.length > 0) {
				for (let [i, child] of Array.from(element.children).entries()) {
					// console.log("child " + i + ' ' + child.tagName)
					if (child?.tagName) {
						cleanHTML(child)
					}
				}
			}

		}

		// clean html
		Array.from(document.querySelectorAll("script")).forEach((el) => {
			el.remove();
		})
		Array.from(document.querySelectorAll("style")).forEach((el) => {
			el.remove();
		})
		Array.from(document.querySelectorAll("link")).forEach((el) => {
			el.remove();
		})
		cleanHTML(document.body)

		return document.body.outerHTML
	});
}

async function getTheLabelInfo(page) {
	return await page.evaluate(() => {
		return document.title
	})
}

function buildPrompt(labelInfo, finalHTML) {
	return `[TINY-WEB-DEV-TITLE]\n${labelInfo}\n[TINY-WEB-DEV-CODE]\n${finalHTML}`
}


async function getMetadataText(page) {
	return await page.evaluate(() => {
		return document.body.innerText.trim()
	})
}

async function generatePrompt(page) {
	const result = await embedStyles(page);
	if (result === "STOP") {
		return false
	}
	const html = await cleanHTML(page);
	// console.log(finalHTML);
	const finalHTML = minifyHtml.minify(Buffer.from(html), { keep_closing_tags: true })
	
	// changing this
	const labelInfo = await getTheLabelInfo(page)

	const prompt = await buildPrompt(labelInfo, finalHTML)
	return prompt
}

async function getDatasetItem(page) {
	const result = await embedStyles(page);
	if (result === "STOP") {
		return false
	}
	const html = await cleanHTML(page);

	// console.log(finalHTML);
	const finalHTML = minifyHtml.minify(Buffer.from(html), { keep_closing_tags: true })
	
	// changing this
	const metadataText = await getMetadataText(page)

	// temporary label for now
	const label = await getTheLabelInfo(page)
	const datasetItem = { label, metadata: metadataText, html: Buffer.from(finalHTML).toString() }
	return datasetItem
}

function getOutboundLinks(page) {
	return page.evaluate(() => {
		return Array.from(document.querySelectorAll("a")).filter((el) => {
		  if (el.href.indexOf('http') !== 0) return false;

		  const urlInfo = new URL(el.href);
		  const hrefOrigin = urlInfo.origin;
		  
		  return window.location.origin !== hrefOrigin && el.offsetParent !== null && el.href && el.href.length > 0; el.href.indexOf('#') !== 0 
		}).map((el) => el.href)
	});
}



async function run() {
	const seeds = fs.readFileSync("./seeds.txt", "utf-8").split("\n");

	const [browser, page] = await setupBrowser();

	let websitesToCrawl = seeds;

	let seedDepthIndex = 0;
	while (websitesToCrawl.length > 0) {
		console.log(websitesToCrawl);
		const website = websitesToCrawl.pop();
		const urlObj = new URL(website)
		if (domainMaxes[urlObj.host] && domainMaxes[urlObj.host] > domainLimit) {
			console.log("Domain limit skipping", website)
			continue
		}

		console.log("Crawling", website)

		try {
			await page.goto(website)
		} catch(e) {
			console.log("GOTO FAILED FOR", website)
			continue
		}

		// index the website in domain maxes
		if (urlObj.host in domainMaxes) {
			domainMaxes[urlObj.host] += 1
		} else {
			domainMaxes[urlObj.host] = 1
		}

		const elementCount = await page.evaluate(() => {
			return document.querySelectorAll("*").length	
		})
		console.log("Element count:", elementCount);
		if (elementCount > elementCountLimit) {
			console.log("Website too large, skipping")
			continue;
		}
		urlLog.push(website.split("?")[0]);
		// 1 get current page dataset promp
		let datasetItem;
		try {
			datasetItem = await getDatasetItem(page)
			if (!datasetItem) {
				console.log("CONTROL ELEMENT MAX ERROR")
				console.log("Just keep going")
				continue;
			}
		} catch (e) {
			console.log(e)
			console.log("Just keep going")
			continue
		}


		dataset.push(datasetItem)

		fs.writeFileSync("./dataset-0.json", JSON.stringify(dataset))
		if (seedDepthIndex == maxSeedDepth) {
			// dont look at outpound links of the seed depth is past the max 
			seedDepthIndex = 0;
			continue
		}

		// get outbound links
		const outboundLinks = await getOutboundLinks(page)
		if (outboundLinks.length > 0) {
			const newSitesToCrawl = outboundLinks.filter((website) => {
				const parsedUrl = new URL(website);

				if (urlLog.indexOf(website.split("?")[0]) > -1) {
					return false
				}

				const pathnameSplit = parsedUrl.pathname.split(".")
				const flaggedFileTypes = [
					"pdf",
					"jpg",
					"jpeg",
					"gif",
					"png",
					"zip"
				];

				for (let fileType of flaggedFileTypes) {
					if (pathnameSplit[pathnameSplit.length-1].indexOf(fileType) > -1) {
						return false
					}
				}

				// filter flagged origins
				const flaggedOrigins = [
					"instagram.com", 
					"stackoverflow.com",
					"twitter.com",
					"youtube.com",
					"linkedin.com",
					"icann.org",
					"iana.org"
				];

				for (let origin of flaggedOrigins) {
					if (parsedUrl.origin.indexOf(origin) > -1) {
						return false
					}
				}

				if (domainMaxes[parsedUrl.host] && domainMaxes[parsedUrl.host] >= domainLimit) {
					return false
				}

				return true
			}).slice(0,outboundLinkLimit); // only get n outbound links
			
			seedDepthIndex++;
			// site to be popped off next time
			if (newSitesToCrawl.length > 0) {
				websitesToCrawl = websitesToCrawl.concat(newSitesToCrawl)
			}
		}

	}

	console.log("\n\n------Finished crawling------\n\n")
	console.log(`STATS:\ndataset size: ${dataset.length}`)
	fs.writeFileSync("./dataset-0.json", JSON.stringify(dataset), "utf-8");
	return true
}

run()

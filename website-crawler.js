const { Buffer } = require("node:buffer");
const minifyHtml = require("@minify-html/node");

const puppeteer = require('puppeteer');
const fs = require('fs');

const dataset = JSON.parse(fs.readFileSync('./dataset.json', "utf-8"))

const controlStyles = JSON.parse(fs.readFileSync('./control-styles-dictionary.json', 'utf-8'))

const urlLog = [];

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
		let controlElementsCount = 50;
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
							console.log("control element")
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

async function getThePageHTML(page) {

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

async function generatePrompt(page) {
	const result = await embedStyles(page);
	if (result === "STOP") {
		return false
	}
	const html = await getThePageHTML(page);
	// console.log(finalHTML);
	const finalHTML = minifyHtml.minify(Buffer.from(html), { keep_closing_tags: true })
	
	// changing this
	const labelInfo = await getTheLabelInfo(page)

	const prompt = await buildPrompt(labelInfo, finalHTML)
	return prompt
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

	let websitesToCrawl = seeds
	while (websitesToCrawl.length > 0) {
		const website = websitesToCrawl.pop();
		console.log("Crawling", website)

		await page.goto(website)
		urlLog.push(website.split("?")[0]);
		// 1 get current page dataset promp
		let prompt;
		try {
			prompt = await generatePrompt(page)
			if (!prompt) {
				console.log("CONTROL ELEMENT MAX ERROR")
				console.log("Just keep going")
				continue
			}
		} catch (e) {
			console.log(e)
			console.log("Just keep going")
			continue
		}


		dataset.push(prompt)

		fs.writeFileSync("./dataset.json", JSON.stringify(dataset))

		// get outbound links
		const outboundLinks = await getOutboundLinks(page)
		if (outboundLinks.length > 0) {
			websitesToCrawl = websitesToCrawl.concat(outboundLinks).filter((website) => {
				const parsedUrl = new URL(website);
				if (urlLog.indexOf(website.split("?")[0]) > -1) {
					return false
				}
				return parsedUrl.origin.indexOf("youtube.com") === -1 && parsedUrl.origin.indexOf("linkedin.com") === -1
			})
		}
	}


	fs.writeFileSync("./dataset.json", JSON.stringify(dataset), "utf-8");
}

run()
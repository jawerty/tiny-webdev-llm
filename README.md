# tiny-webdev-llm (ongoing)
Smallest LLM I can fine tune for coding websites

I'll be live coding the tiniest Web Dev LLM I can build. 

This is an ongoing project for this live coding series -> [Live Coding Stream (Part 1)](https://www.youtube.com/watch?v=J81h4NS64yQ) 

# Project Overview
This past year I’ve been obsessed with making the smallest web dev LLM possible (while still an “L”LM). Essentially being able to request a certain webpage design without using an expensive model. GPT4 is ok but is overkill and I think this can be done on a less than 10b param model

I live coded myself building this tiny web dev LLM (fine tuning Llama 2 + web crawler from scratch). I’ve had this idea for a while the overall concept is I utilize a “compressed” html dataset. So I essentially embed the styles directly in the html and use a diffing algorithm to only use the styles that aren’t the default styles in the browser for that tag.

Next I’m going to build a “semantic” css framework on top of it to compress it further. Could convert it to tailwind or just make my own using the dataset. Also, with labeling the websites (the Question for the prediction) I am going to use GPT4 to describe each page. For now just using the page title (only temporary).

In the first video I build the web crawler, style embedder, get a v0 dataset and fine tune Llama with Lora. Next video I want to actually get it working well and designing websites for us.

# The Dataset
The dataset is comprised of a series of prompts with these prefixes
```
[TINY-WEB-DEV-TITLE]

...insert title of webpage...

[TINY-WEB-DEV-CODE]

...insert compressed and style embedded html...

```

In the future we will replace the title with a proper label and description of the webpage likely from a huggingface inference API request to a Llama 2 variant. 

# How to build the dataset

## Part 1 - Fetching the html page snapshots
Fill the seeds.txt with urls you want to start crawling from

Then run the website crawler to get embedded styled webpages (cleaning the dataset is optional)
```
$ node website-crawler.js
$ node clean-dataset.js
```

## Part 2 - Generating the semantic css framework
Generate a "semantic" css framework for the dataset. 

The reason for this is so we can 1. Compress our dataset (to approximately 8th the size of the original embeeded style dataset) and 2. create semantic tokens based on the 'topic' the css classes show up in (based on the text of html page)

First run the routine to cluster the html pages in the dataset and generate topics for each of them 
```
$ python3 topic-generator.py
```

Then once you run the topic generator generate the css framework (the topics will be used to name the css classes)
```
$ node generate-css-framework.js
```

This command will output a `semantic-css-framework.css` file you will use as the the css framework when you want to load your generated html pages

## Part 3 - Converting the dataset to use semantic css
Run the conversion script to convert the embedded styles to use the generated semantic css classes
```
$ node convert-dataset-to-semantic-framework.js
$ node dataset-to-prompts.js
```
You will in the end have a `final-dataset.json` with your prompts for fine-tuning.

# How to fine-tune a model with your dataset
Quickly, I want to address the labeling. We need proper labeling for each html file for prompting. This is so we can have a proper question for inference. For instance `a website for a photography website`. We are currently using the titles of the webpages which is very flawed `see website-crawler.js`. You can also manually label these in your semantic-css-dataset.json file before running `node dataset-to-prompts.js`. 

More on how to fine-tune. 

Here's a link to the training [colab](https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing). Upload the `final-dataset.json` to the dataset.json file 

Colab link -> [https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing](https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing)

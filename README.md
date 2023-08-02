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

# How to scrape the dataset
Fill the seeds.txt with urls you want to start crawling from

For now run the website-crawler.js to build the dataset
```
node website-crawler.js
```

# How to train
Here's a link to the [colab](https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing). Upload a dataset to a dataset.json file 

Colab link -> [https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing](https://colab.research.google.com/drive/1x1paWIa-HbTezYsm0a5cG1eNguKZMiI5?usp=sharing)

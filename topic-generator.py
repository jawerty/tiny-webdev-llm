import json
print("importing top2vec")
from top2vec import Top2Vec
from sklearn.datasets import fetch_20newsgroups

class TopicGenerator:
	def __init__(self, documents=[]):
		self.documents = documents

	def load_documents(self, filename):
		f = open(filename)
		data = json.load(f)
		self.documents = list(map(lambda x: " ".join(x['metadata'].split("\n")), data))
		print("Length:", len(self.documents))
		for doc in self.documents:
			print(doc)
			print("\n\n")
		return self.documents

	def train_model(self):
		self.model = Top2Vec(documents=self.documents*10, speed="learn", workers=1)
		print("Topic Count:", self.model.get_num_topics())
		return self.model


	def get_topics_per_doc(self):
		doc_id_score_map = {
			# id => { score, topic_id }
		}
		topic_sizes, topic_nums = self.model.get_topic_sizes()
		topic_words, word_scores, topic_nums = self.model.get_topics()
		topic_names = [x[0] for x in topic_words]

		print("topic_words", topic_words)
		print("word_scores", word_scores)
		print("topic_nums", topic_nums)

		for topic_id in topic_nums:
			documents, document_scores, document_ids = self.model.search_documents_by_topic(topic_num=topic_id, num_docs=topic_sizes[topic_id])
			
			# print(documents, document_ids, document_scores)
			for i, doc_id in enumerate(document_ids):
				if doc_id in doc_id_score_map:
					curr_score = doc_id_score_map[doc_id]["score"]
					if curr_score > document_scores[i]:
						doc_id_score_map[doc_id]["score"] = document_scores[i]
						doc_id_score_map[doc_id]["topic_name"] = topic_names[topic_id]
				else:
					doc_id_score_map[doc_id] = {
						"score": document_scores[i],
						"topic_name": topic_names[topic_id]
					}


		self.doc_id_topic_map = {} 
		for i in range(0, 10):
			self.doc_id_topic_map[i] = doc_id_score_map[i]["topic_name"]

		print("Topic map:", self.doc_id_topic_map)

	def save_topic_to_docs(self, input_dataset):
		f = open(input_dataset)
		data = json.load(f)
		self.documents = data

		for i in self.doc_id_topic_map:
			# print(i, self.doc_id_topic_map[i])
			# print(self.documents[i])
			self.documents[i]["topic"] = self.doc_id_topic_map[i]
			print(self.documents[i]["topic"])

		with open("./topic_dataset.json", 'w+') as f:
			json.dump(self.documents, f)

if __name__ == "__main__":
	print("Initializing topic generator")
	topic_gen = TopicGenerator()
	topic_gen.load_documents("./cleaned-dataset.json")
	print("Training the model")
	topic_gen.train_model()
	topic_gen.get_topics_per_doc()

	topic_gen.save_topic_to_docs("./cleaned-dataset.json")
	print("saved dataset!")
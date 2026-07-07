"""BERTopic-style c-TF-IDF labeling: each cluster's docs form one document."""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

TOP_TERMS = 2


class CTfidfLabeler:
    def label(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, str]:
        cluster_ids = list(docs_by_cluster)
        if not cluster_ids:
            return {}
        corpus = [" ".join(docs_by_cluster[cid]) for cid in cluster_ids]
        if len(cluster_ids) == 1:
            return {cluster_ids[0]: self._top_terms_single(corpus[0])}

        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        matrix = vectorizer.fit_transform(corpus)
        terms = np.array(vectorizer.get_feature_names_out())

        labels: dict[int, str] = {}
        for row, cid in enumerate(cluster_ids):
            weights = matrix[row].toarray().ravel()
            top = terms[np.argsort(weights)[::-1][:TOP_TERMS]]
            labels[cid] = " · ".join(t.title() for t in top)
        return labels

    @staticmethod
    def _top_terms_single(doc: str) -> str:
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform([doc])
        terms = np.array(vectorizer.get_feature_names_out())
        weights = matrix.toarray().ravel()
        top = terms[np.argsort(weights)[::-1][:TOP_TERMS]]
        return " · ".join(t.title() for t in top)

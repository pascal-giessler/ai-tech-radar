"""BERTopic-style c-TF-IDF labeling: each cluster's docs form one document."""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

TOP_TERMS = 2
KEYWORD_TERMS = 6


class CTfidfLabeler:
    def label(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, str]:
        return {cid: label for cid, (label, _kw) in self.profile(docs_by_cluster).items()}

    def profile(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, tuple[str, list[str]]]:
        """Per cluster: (2-term title-case label, top ~6 c-TF-IDF keywords)."""
        cluster_ids = list(docs_by_cluster)
        if not cluster_ids:
            return {}
        corpus = [" ".join(docs_by_cluster[cid]) for cid in cluster_ids]
        if len(cluster_ids) == 1:
            keywords = self._top_terms_single(corpus[0])
            return {cluster_ids[0]: (self._label_from(keywords), keywords)}

        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        matrix = vectorizer.fit_transform(corpus)
        terms = np.array(vectorizer.get_feature_names_out())

        profiles: dict[int, tuple[str, list[str]]] = {}
        for row, cid in enumerate(cluster_ids):
            weights = matrix[row].toarray().ravel()
            ordered = terms[np.argsort(weights)[::-1][:KEYWORD_TERMS]]
            keywords = [str(t) for t in ordered]
            profiles[cid] = (self._label_from(keywords), keywords)
        return profiles

    @staticmethod
    def _label_from(keywords: list[str]) -> str:
        return " · ".join(t.title() for t in keywords[:TOP_TERMS])

    @staticmethod
    def _top_terms_single(doc: str) -> list[str]:
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform([doc])
        terms = np.array(vectorizer.get_feature_names_out())
        weights = matrix.toarray().ravel()
        ordered = terms[np.argsort(weights)[::-1][:KEYWORD_TERMS]]
        return [str(t) for t in ordered]

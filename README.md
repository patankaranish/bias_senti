# Bias and sentiment detection for a web page
A Chrome extension that shows sentiment and bias of the currently loaded article

The algorithm is quite simple, too simplistic actually.

For sentiment, it counts the words present in positive and negative lexicon given by Liu and Hu [References 1]
For bias, it relies on NPOV terms from Wikipedia as extracted by [References 2]
 
### TODO: 
1. Topic/keyword based analysis: The positive or negative aspects are typically associated with the subject of the sentence. Hence, the aticle content depicts one subject in positive light while depicting another subject in negative light. Those different subjects need to be identified and used accordingly for overall analysis.
2. Keyword detection itself would need use of RAKE or similar ideas.
3. Readability has closed down. As of now the extension relies on boilerpipe service for getting plain text content from a webpage.

#### References:
1. Minqing Hu and Bing Liu. "Mining and Summarizing Customer Reviews.", Proceedings of the ACM SIGKDD International Conference on Knowledge Discovery and Data Mining (KDD-2004), Aug 22-25, 2004, Seattle, Washington, USA
2. Marta Recasens, Cristian Danescu-Niculescu-Mizil, and Dan Jurafsky. 2013. Linguistic Models for Analyzing and Detecting Biased Language. Proceedings of ACL 2013.

import unittest

from web_ingest import extract_text_from_html


class WebIngestTests(unittest.TestCase):
    def test_extract_text_from_html_removes_scripts_and_styles(self):
        html = """
        <html>
          <head>
            <style>body { color: red; }</style>
            <script>var x = 1;</script>
          </head>
          <body>
            <h1>AI/ML Basics</h1>
            <p>Machine learning is the study of algorithms.</p>
            <p>Deep learning uses neural networks.</p>
          </body>
        </html>
        """

        text = extract_text_from_html(html, "https://example.com/ai")

        self.assertIn("AI/ML Basics", text)
        self.assertIn("Machine learning is the study of algorithms.", text)
        self.assertIn("Deep learning uses neural networks.", text)
        self.assertNotIn("var x = 1", text)
        self.assertNotIn("color: red", text)

    def test_discover_links_filters_to_allowed_domains(self):
        from web_ingest import discover_links

        html = """
        <html><body>
          <a href="https://huggingface.co/learn">Hugging Face</a>
          <a href="https://example.com/other">Other</a>
          <a href="/docs">Docs</a>
        </body></html>
        """

        links = discover_links(html, "https://huggingface.co", allowed_domains=["huggingface.co"])

        self.assertIn("https://huggingface.co/learn", links)
        self.assertIn("https://huggingface.co/docs", links)
        self.assertNotIn("https://example.com/other", links)


if __name__ == "__main__":
    unittest.main()

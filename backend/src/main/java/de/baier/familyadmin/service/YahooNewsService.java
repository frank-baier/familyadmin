package de.baier.familyadmin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Free, key-less per-ticker news via Yahoo Finance's RSS feed — same source family as the
 * price data, so no new credentials or account to manage.
 */
@Slf4j
@Service
public class YahooNewsService {

    public record NewsItem(String title, String description, String link) {}

    private final RestClient restClient = RestClient.builder().build();

    public List<NewsItem> fetchNews(String ticker, int maxItems) {
        List<NewsItem> results = new ArrayList<>();
        try {
            String xml = restClient.get()
                    .uri("https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US", ticker.trim())
                    .header(HttpHeaders.USER_AGENT, "Mozilla/5.0")
                    .retrieve()
                    .body(String.class);
            if (xml == null) return results;

            var factory = DocumentBuilderFactory.newInstance();
            // XXE hardening — this is externally-sourced XML.
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);

            Document doc = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            NodeList items = doc.getElementsByTagName("item");
            for (int i = 0; i < items.getLength() && results.size() < maxItems; i++) {
                Element item = (Element) items.item(i);
                results.add(new NewsItem(textOf(item, "title"), textOf(item, "description"), textOf(item, "link")));
            }
        } catch (Exception e) {
            log.warn("News lookup failed for '{}': {}", ticker, e.getMessage());
        }
        return results;
    }

    private String textOf(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent();
    }
}

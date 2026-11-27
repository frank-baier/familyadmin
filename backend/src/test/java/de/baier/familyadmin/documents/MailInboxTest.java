package de.baier.familyadmin.documents;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.ai.AnthropicChatService;
import de.baier.familyadmin.ai.OllamaService;
import de.baier.familyadmin.user.UserRepository;

import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import jakarta.activation.DataHandler;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MailInboxTest {

    // ── Filing suggestion ───────────────────────────────────────────────────

    private MailFilingSuggestionService suggestionService(AnthropicChatService claude, OllamaService ollama) {
        DocumentRepository repo = mock(DocumentRepository.class);
        when(repo.findGroupedTreeForUser(any())).thenReturn(List.of(
                new DocumentTreeNode("Finanzen", 2025, "Banken/SoBa", 3)));
        DocumentIndexingService indexing = mock(DocumentIndexingService.class);
        when(indexing.extractText(any(), anyString())).thenReturn("Kontoauszug Solothurner Bank");
        var s = new MailFilingSuggestionService(repo, indexing, claude, ollama, new ObjectMapper());
        ReflectionTestUtils.setField(s, "llmProvider", "anthropic");
        return s;
    }

    @Test
    void claudeSuggestionIsParsedAndCategoryPrefixStripped() {
        AnthropicChatService claude = mock(AnthropicChatService.class);
        when(claude.isConfigured()).thenReturn(true);
        when(claude.model()).thenReturn("claude-haiku-5-5");
        when(claude.complete(anyString(), anyString())).thenReturn(new AnthropicChatService.Result(
                "```json\n{\"category\":\"Finanzen\",\"subcategory\":\"Finanzen/Banken/SoBa\",\"year\":2026,"
                        + "\"important\":true,\"reason\":\"Kontoauszug der SoBa\"}\n```",
                10, 10, BigDecimal.ZERO));

        var s = suggestionService(claude, mock(OllamaService.class))
                .suggest(UUID.randomUUID(), "auszug.pdf", new byte[]{1}, "SoBa", "Ihr Auszug", LocalDate.of(2026, 11, 1));

        assertThat(s.category()).isEqualTo("Finanzen");
        assertThat(s.subcategory()).isEqualTo("Banken/SoBa");
        assertThat(s.year()).isEqualTo(2026);
        assertThat(s.important()).isTrue();
        assertThat(s.model()).isEqualTo("claude-haiku-5-5");
    }

    @Test
    void fallsBackToOllamaWhenClaudeFails() {
        AnthropicChatService claude = mock(AnthropicChatService.class);
        when(claude.isConfigured()).thenReturn(true);
        when(claude.complete(anyString(), anyString())).thenThrow(new IllegalStateException("down"));
        OllamaService ollama = mock(OllamaService.class);
        when(ollama.chatModel()).thenReturn("llama3.2:3b");
        when(ollama.generate(anyString(), any())).thenReturn(
                "Hier: {\"category\":\"Werbung\",\"subcategory\":null,\"year\":1800,\"important\":false,\"reason\":\"Newsletter\"}");

        var s = suggestionService(claude, ollama)
                .suggest(UUID.randomUUID(), "x.pdf", new byte[]{1}, null, null, null);

        assertThat(s.category()).isEqualTo("Werbung");
        assertThat(s.subcategory()).isNull();
        assertThat(s.year()).isNull();          // implausible year dropped
        assertThat(s.important()).isFalse();
        assertThat(s.model()).isEqualTo("ollama:llama3.2:3b");
    }

    // ── Attachment detection ────────────────────────────────────────────────

    @Test
    void onlyRealAttachmentsAreCollected() throws Exception {
        MimeMessage msg = new MimeMessage(Session.getInstance(new Properties()));
        MimeMultipart related = new MimeMultipart("related");
        MimeBodyPart html = new MimeBodyPart();
        html.setText("<p>Hallo <img src=\"cid:logo\"></p>", "utf-8", "html");
        related.addBodyPart(html);
        related.addBodyPart(part("logo.png", "image/png", Part.INLINE, "<logo>"));

        MimeMultipart mixed = new MimeMultipart("mixed");
        MimeBodyPart relatedWrapper = new MimeBodyPart();
        relatedWrapper.setContent(related);
        mixed.addBodyPart(relatedWrapper);
        mixed.addBodyPart(part("=?UTF-8?Q?Rechnung_M=C3=A4rz.pdf?=", "application/pdf", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("smime.p7s", "application/pkcs7-signature", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("einladung.ics", "text/calendar", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("foto.jpg", "image/jpeg", Part.ATTACHMENT, null));
        msg.setContent(mixed);
        msg.saveChanges();

        MailInboxPoller poller = new MailInboxPoller(mock(MailInboxItemRepository.class),
                mock(MailFilingSuggestionService.class), mock(UserRepository.class), mock(JdbcTemplate.class));
        List<Part> found = new ArrayList<>();
        poller.collectAttachments(new MimeMessage(msg), found, 0);

        assertThat(found).extracting(Part::getFileName)
                .containsExactly("=?UTF-8?Q?Rechnung_M=C3=A4rz.pdf?=", "foto.jpg");
    }

    private static MimeBodyPart part(String filename, String type, String disposition, String cid) throws Exception {
        MimeBodyPart p = new MimeBodyPart();
        p.setDataHandler(new DataHandler(new ByteArrayDataSource(new byte[]{1, 2, 3}, type)));
        p.setFileName(filename);
        p.setDisposition(disposition);
        if (cid != null) p.setContentID(cid);
        return p;
    }
}

package de.baier.familyadmin.dto;

import java.util.List;

public record ResendInboundPayload(
        String type,
        ResendEmailData data
) {
    public record ResendEmailData(
            String from,
            List<String> to,
            String subject,
            List<ResendAttachment> attachments
    ) {}

    public record ResendAttachment(
            String filename,
            String content,
            String contentType
    ) {}
}

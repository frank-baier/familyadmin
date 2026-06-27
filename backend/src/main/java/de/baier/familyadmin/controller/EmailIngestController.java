package de.baier.familyadmin.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.dto.ResendInboundPayload;
import de.baier.familyadmin.service.EmailIngestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/trips/ingest")
@RequiredArgsConstructor
@Slf4j
public class EmailIngestController {

    private final EmailIngestService emailIngestService;
    private final ObjectMapper objectMapper;

    @Value("${resend.webhook.secret:}")
    private String webhookSecret;

    @PostMapping("/email")
    public ResponseEntity<Map<String, Integer>> handleInbound(
            @RequestBody byte[] rawBody,
            @RequestHeader(value = "svix-id", required = false) String svixId,
            @RequestHeader(value = "svix-timestamp", required = false) String svixTimestamp,
            @RequestHeader(value = "svix-signature", required = false) String svixSignature) {

        if (StringUtils.hasText(webhookSecret)) {
            if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature)) {
                log.warn("Rejecting email ingest — invalid Svix signature");
                return ResponseEntity.status(401).build();
            }
        }

        try {
            ResendInboundPayload payload = objectMapper.readValue(rawBody, ResendInboundPayload.class);
            int saved = emailIngestService.ingest(payload);
            return ResponseEntity.ok(Map.of("saved", saved));
        } catch (Exception e) {
            log.error("Failed to process inbound email: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Svix webhook signature verification.
     * Signed content: "{svix-id}.{svix-timestamp}.{raw-body}"
     * Key: base64-decode of secret after stripping "whsec_" prefix.
     * Each signature in svix-signature is "v1,{base64(HMAC-SHA256)}".
     */
    private boolean verifySvixSignature(byte[] body, String svixId, String svixTimestamp, String svixSignature) {
        if (svixId == null || svixTimestamp == null || svixSignature == null) return false;
        try {
            String secret = webhookSecret.startsWith("whsec_")
                    ? webhookSecret.substring("whsec_".length()) : webhookSecret;
            byte[] keyBytes = Base64.getDecoder().decode(secret);

            String signedContent = svixId + "." + svixTimestamp + "." + new String(body, StandardCharsets.UTF_8);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keyBytes, "HmacSHA256"));
            String computed = Base64.getEncoder().encodeToString(
                    mac.doFinal(signedContent.getBytes(StandardCharsets.UTF_8)));

            for (String sig : svixSignature.split(" ")) {
                String sigValue = sig.startsWith("v1,") ? sig.substring(3) : sig;
                if (computed.equals(sigValue)) return true;
            }
            return false;
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalArgumentException e) {
            log.error("Svix signature verification error: {}", e.getMessage());
            return false;
        }
    }
}

package de.baier.familyadmin.service;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Parses uploaded portfolio CSV/XLSX files into position rows.
 * Expected columns (header names, case-insensitive, order-independent):
 * ticker/symbol, shares/quantity/menge, purchase_price/price/kaufpreis,
 * purchase_date/date/kaufdatum, name/bezeichnung (optional).
 */
@Service
public class PortfolioImportService {

    private static final Map<String, List<String>> COLUMN_ALIASES = Map.of(
            "ticker", List.of("ticker", "symbol", "wkn", "isin"),
            "shares", List.of("shares", "quantity", "menge", "anzahl", "stueck", "stück"),
            "purchasePrice", List.of("purchase_price", "purchaseprice", "price", "kaufpreis", "einstandspreis"),
            "purchaseDate", List.of("purchase_date", "purchasedate", "date", "kaufdatum", "datum"),
            "name", List.of("name", "bezeichnung", "titel")
    );

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );

    public record ParsedRow(String ticker, String name, BigDecimal shares,
                            BigDecimal purchasePrice, LocalDate purchaseDate) {}

    public record ParseResult(List<ParsedRow> rows, List<String> warnings) {}

    public ParseResult parse(MultipartFile file) throws IOException {
        String filename = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            return parseExcel(file);
        }
        return parseCsv(file);
    }

    private ParseResult parseCsv(MultipartFile file) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new IllegalArgumentException("Datei ist leer");
            }
            String delimiter = headerLine.contains(";") ? ";" : ",";
            Map<String, Integer> columnIndex = mapColumns(splitCsvLine(headerLine, delimiter));

            String line;
            int lineNumber = 1;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (!StringUtils.hasText(line)) continue;
                String[] cells = splitCsvLine(line, delimiter);
                try {
                    rows.add(toRow(cells, columnIndex));
                } catch (Exception e) {
                    warnings.add("Zeile " + lineNumber + " übersprungen: " + e.getMessage());
                }
            }
        }
        return new ParseResult(rows, warnings);
    }

    private ParseResult parseExcel(MultipartFile file) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            Iterator<Row> it = sheet.rowIterator();
            if (!it.hasNext()) throw new IllegalArgumentException("Datei ist leer");

            Row headerRow = it.next();
            List<String> headers = new ArrayList<>();
            headerRow.forEach(cell -> headers.add(formatter.formatCellValue(cell)));
            Map<String, Integer> columnIndex = mapColumns(headers.toArray(new String[0]));

            while (it.hasNext()) {
                Row row = it.next();
                int rowNumber = row.getRowNum() + 1;
                String[] cells = new String[headers.size()];
                for (int i = 0; i < headers.size(); i++) {
                    Cell cell = row.getCell(i);
                    cells[i] = cell != null ? formatter.formatCellValue(cell) : "";
                }
                if (Arrays.stream(cells).allMatch(c -> !StringUtils.hasText(c))) continue;
                try {
                    rows.add(toRow(cells, columnIndex));
                } catch (Exception e) {
                    warnings.add("Zeile " + rowNumber + " übersprungen: " + e.getMessage());
                }
            }
        }
        return new ParseResult(rows, warnings);
    }

    private Map<String, Integer> mapColumns(String[] headers) {
        Map<String, Integer> result = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            String normalized = headers[i].trim().toLowerCase(Locale.ROOT);
            for (var entry : COLUMN_ALIASES.entrySet()) {
                if (entry.getValue().contains(normalized) && !result.containsKey(entry.getKey())) {
                    result.put(entry.getKey(), i);
                }
            }
        }
        if (!result.containsKey("ticker") || !result.containsKey("shares")
                || !result.containsKey("purchasePrice") || !result.containsKey("purchaseDate")) {
            throw new IllegalArgumentException(
                    "Fehlende Spalten. Benötigt: ticker, shares, purchase_price, purchase_date");
        }
        return result;
    }

    private ParsedRow toRow(String[] cells, Map<String, Integer> columnIndex) {
        String ticker = cellAt(cells, columnIndex.get("ticker")).toUpperCase(Locale.ROOT);
        if (!StringUtils.hasText(ticker)) throw new IllegalArgumentException("Ticker fehlt");

        String name = columnIndex.containsKey("name") ? cellAt(cells, columnIndex.get("name")) : null;
        BigDecimal shares = parseDecimal(cellAt(cells, columnIndex.get("shares")), "shares");
        BigDecimal purchasePrice = parseDecimal(cellAt(cells, columnIndex.get("purchasePrice")), "purchase_price");
        LocalDate purchaseDate = parseDate(cellAt(cells, columnIndex.get("purchaseDate")));

        return new ParsedRow(ticker, StringUtils.hasText(name) ? name : null, shares, purchasePrice, purchaseDate);
    }

    private String cellAt(String[] cells, Integer index) {
        if (index == null || index >= cells.length) return "";
        return cells[index] != null ? cells[index].trim() : "";
    }

    private BigDecimal parseDecimal(String raw, String field) {
        if (!StringUtils.hasText(raw)) throw new IllegalArgumentException(field + " fehlt");
        try {
            return new BigDecimal(raw.replace(",", "."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Ungültiger Wert für " + field + ": " + raw);
        }
    }

    private LocalDate parseDate(String raw) {
        if (!StringUtils.hasText(raw)) throw new IllegalArgumentException("purchase_date fehlt");
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(raw, fmt);
            } catch (DateTimeParseException ignored) {
                // try next format
            }
        }
        throw new IllegalArgumentException("Ungültiges Datum: " + raw);
    }

    private String[] splitCsvLine(String line, String delimiter) {
        return line.split(java.util.regex.Pattern.quote(delimiter), -1);
    }
}

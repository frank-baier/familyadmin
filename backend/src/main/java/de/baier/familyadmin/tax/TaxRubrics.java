package de.baier.familyadmin.tax;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Folder conventions of iCloud "Dokumente/Behörden/Finanzamt": one folder
 * "Steuerunterlagen <Jahr>" per year with numbered rubric subfolders; the user marks
 * rubrics as done by appending suffixes like "_fertig" or "_uploaded".
 */
public final class TaxRubrics {

    public static final String ROOT = "Behörden/Finanzamt";

    /** Rubric names as in "Steuerunterlagen Template 2". */
    public static final List<String> TEMPLATE = List.of(
            "01 Arbeitnehmer",
            "02 Aussergewöhnliche Belastungen",
            "04 Handwerker und Haushaltsnahe Diensteistungen",
            "05 Kapitalanlagen",
            "06 Kinder",
            "07 Renten",
            "08 Sonderausgaben_Spenden",
            "09 Vermietungen",
            "10 Versicherungen");

    /** Files directly in "Steuerunterlagen <Jahr>". */
    public static final String GENERAL = "Allgemein";

    private static final Pattern NUMBER = Pattern.compile("^(\\d{2})\\b");

    private TaxRubrics() {}

    public static String yearFolder(int year) {
        return ROOT + "/Steuerunterlagen " + year;
    }

    /** "Behörden/Finanzamt/<Jahr>": letters of the tax office, Ansässigkeitsbescheinigung … */
    public static String officeFolder(int year) {
        return ROOT + "/" + year;
    }

    public static String officeRubric(int year) {
        return "Finanzamt " + year;
    }

    /** Rubric of a listed file, normalised to the template name (suffixes dropped). */
    public static String rubricOf(String path, int year) {
        String yf = yearFolder(year) + "/";
        if (path.startsWith(yf)) {
            String rest = path.substring(yf.length());
            int slash = rest.indexOf('/');
            return slash < 0 ? GENERAL : normalise(rest.substring(0, slash));
        }
        if (path.startsWith(officeFolder(year) + "/")) return officeRubric(year);
        return GENERAL;
    }

    /** "01 Arbeitnehmer_fertig" → "01 Arbeitnehmer"; unknown names stay as they are. */
    public static String normalise(String folderName) {
        if (folderName == null) return null;
        String name = folderName.strip();
        return number(name).flatMap(TaxRubrics::templateByNumber).orElse(name);
    }

    static Optional<String> number(String name) {
        if (name == null) return Optional.empty();
        Matcher m = NUMBER.matcher(name.strip());
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }

    static Optional<String> templateByNumber(String number) {
        return TEMPLATE.stream().filter(t -> t.startsWith(number + " ")).findFirst();
    }

    /**
     * Folder (below "Dokumente") a document of {@code rubric} is copied to: an existing rubric
     * folder of that year with the same number (the plain one is preferred over "_fertig"),
     * otherwise the template name.
     */
    public static String targetFolder(String rubric, int year, List<String> existingFolders) {
        String yf = yearFolder(year);
        String wanted = normalise(rubric);
        Optional<String> nr = number(wanted);
        if (nr.isEmpty()) return yf;
        List<String> candidates = new ArrayList<>();
        for (String f : existingFolders == null ? List.<String>of() : existingFolders) {
            if (!f.startsWith(yf + "/")) continue;
            String name = f.substring(yf.length() + 1);
            if (name.contains("/")) continue;
            if (number(name).equals(nr)) candidates.add(name);
        }
        String chosen = candidates.stream().filter(n -> n.equals(wanted)).findFirst()
                .or(() -> candidates.stream().sorted().findFirst())
                .orElse(wanted);
        return yf + "/" + chosen;
    }

    public static String fileName(String path) {
        int slash = path.lastIndexOf('/');
        return slash < 0 ? path : path.substring(slash + 1);
    }
}

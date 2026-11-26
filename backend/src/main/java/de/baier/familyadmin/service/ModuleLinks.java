package de.baier.familyadmin.service;

import java.net.URI;

/**
 * Links into the module apps, which run on subdomains of the portal
 * (https://admin.example.com → https://tasks.admin.example.com/tasks/42).
 * Hosts without subdomains (localhost, IPs) keep the portal host.
 */
public final class ModuleLinks {

    private ModuleLinks() {}

    public static String of(String portalUrl, String module, String path) {
        URI portal = URI.create(portalUrl.endsWith("/") ? portalUrl.substring(0, portalUrl.length() - 1) : portalUrl);
        String host = portal.getHost();
        boolean subdomains = host != null && host.contains(".") && !host.matches("[\\d.]+");
        String base = subdomains
                ? portal.getScheme() + "://" + module + "." + host + (portal.getPort() > 0 ? ":" + portal.getPort() : "")
                : portal.toString();
        return base + path;
    }
}

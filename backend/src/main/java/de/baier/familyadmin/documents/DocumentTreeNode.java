package de.baier.familyadmin.documents;

public record DocumentTreeNode(
        String category,
        Integer year,
        String subcategory,
        long count
) {}

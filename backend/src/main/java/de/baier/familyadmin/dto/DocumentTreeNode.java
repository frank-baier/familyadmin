package de.baier.familyadmin.dto;

public record DocumentTreeNode(
        String category,
        Integer year,
        String subcategory,
        long count
) {}

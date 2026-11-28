package de.baier.familyadmin.tax;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

/** Primary key (owner, tax year) of {@link TaxFolderListing} and {@link TaxYearState}. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaxYearKey implements Serializable {
    private UUID ownerId;
    private Integer taxYear;
}

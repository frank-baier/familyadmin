package de.baier.familyadmin.service;

import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class PhotoService {

    private static final int    MAX_PX     = 600;
    private static final double QUALITY    = 0.82;
    private static final String UPLOAD_DIR = "uploads";

    public byte[] compress(InputStream input) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Thumbnails.of(input)
                .size(MAX_PX, MAX_PX)
                .outputFormat("JPEG")
                .outputQuality(QUALITY)
                .toOutputStream(baos);
        return baos.toByteArray();
    }

    public String savePhoto(MultipartFile file) throws IOException {
        byte[] compressed = compress(file.getInputStream());
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) Files.createDirectories(uploadPath);
        String filename = UUID.randomUUID() + ".jpg";
        Files.write(uploadPath.resolve(filename), compressed);
        return "/uploads/" + filename;
    }
}

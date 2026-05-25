package de.baier.familyadmin.service;

import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@Slf4j
public class PhotoService {

    private static final String UPLOAD_DIR = "uploads";
    private static final int    MAX_PX     = 600;
    private static final double QUALITY    = 0.82;

    public String savePhoto(MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) Files.createDirectories(uploadPath);

        String filename = UUID.randomUUID() + ".jpg";
        Path   filePath = uploadPath.resolve(filename);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Thumbnails.of(file.getInputStream())
                .size(MAX_PX, MAX_PX)
                .outputFormat("JPEG")
                .outputQuality(QUALITY)
                .toOutputStream(baos);

        Files.write(filePath, baos.toByteArray());
        log.info("Saved photo {} ({} KB)", filePath, baos.size() / 1024);
        return "/uploads/" + filename;
    }
}

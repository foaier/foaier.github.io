package io.foaier.demo;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class DemoApplication {
    private final JdbcTemplate db;
    private final StringRedisTemplate redis;
    private final String message;

    public DemoApplication(JdbcTemplate db, StringRedisTemplate redis,
                           @Value("${demo.message:hello-docker}") String message) {
        this.db = db;
        this.redis = redis;
        this.message = message;
    }

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }

    @GetMapping("/")
    public Map<String, String> index() {
        return Map.of("message", message, "service", "docker-demo");
    }

    @GetMapping("/health/live")
    public Map<String, String> live() {
        return Map.of("status", "alive");
    }

    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, String>> ready() {
        try {
            db.queryForObject("SELECT 1", Integer.class);
            redis.hasKey("visits");
            return ResponseEntity.ok(Map.of("status", "ready", "mysql", "connected", "redis", "connected"));
        } catch (RuntimeException exception) {
            return ResponseEntity.status(503).body(Map.of("status", "not-ready"));
        }
    }

    @PostMapping("/visits")
    public ResponseEntity<?> visit(@RequestParam(defaultValue = "hello") String note) {
        if (note.length() > 200) {
            return ResponseEntity.badRequest().body(Map.of("error", "note must be at most 200 characters"));
        }
        db.update("INSERT INTO visits(note) VALUES (?)", note);
        // Two independent systems: this demo does not promise an atomic database/cache write.
        Long count = redis.opsForValue().increment("visits");
        return ResponseEntity.ok(Map.of("note", note, "redisCount", count == null ? 0L : count));
    }

    @GetMapping("/visits")
    public List<Map<String, Object>> visits() {
        return db.queryForList("SELECT id, note FROM visits ORDER BY id DESC LIMIT 20");
    }
}

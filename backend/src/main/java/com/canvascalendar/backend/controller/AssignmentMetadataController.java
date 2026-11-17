package com.canvascalendar.backend.controller;

import com.canvascalendar.backend.model.AssignmentMetadata;
import com.canvascalendar.backend.model.User;
import com.canvascalendar.backend.repository.AssignmentMetadataRepository;
import com.canvascalendar.backend.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentMetadataController {

    private final AssignmentMetadataRepository repository;
    private final UserRepository userRepository;

    public AssignmentMetadataController(
            AssignmentMetadataRepository repository,
            UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    public record MetadataRequest(
            String priority,
            Integer estimatedMinutes,
            String notes
    ) {}

    public record MetadataResponse(
            Long id,
            Long userId,
            String courseId,
            String assignmentId,
            String priority,
            Integer estimatedMinutes,
            String notes
    ) {}

    private MetadataResponse toResponse(AssignmentMetadata metadata) {
        return new MetadataResponse(
                metadata.getId(),
                metadata.getUser().getId(),
                metadata.getCourseId(),
                metadata.getAssignmentId(),
                metadata.getPriority(),
                metadata.getEstimatedMinutes(),
                metadata.getNotes()
        );
    }

    private User getOrCreateUser(Jwt jwt) {
        String supabaseUserId = jwt.getSubject();

        return userRepository.findBySupabaseUserId(supabaseUserId)
                .orElseGet(() -> {
                    User user = new User("supabase_" + supabaseUserId);
                    user.setSupabaseUserId(supabaseUserId);
                    return userRepository.save(user);
                });
    }

    @PutMapping("/{courseId}/{assignmentId}")
    public MetadataResponse updateMetadata(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String courseId,
            @PathVariable String assignmentId,
            @RequestBody MetadataRequest request) {

        User user = getOrCreateUser(jwt);

        AssignmentMetadata saved = repository
                .findByUser_IdAndCourseIdAndAssignmentId(
                        user.getId(), courseId, assignmentId)
                .orElseGet(AssignmentMetadata::new);

        saved.setUser(user);
        saved.setCourseId(courseId);
        saved.setAssignmentId(assignmentId);
        saved.setPriority(request.priority());
        saved.setEstimatedMinutes(request.estimatedMinutes());
        saved.setNotes(request.notes());

        return toResponse(repository.save(saved));
    }

    @GetMapping("/{courseId}/{assignmentId}")
    public ResponseEntity<MetadataResponse> getMetadata(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String courseId,
            @PathVariable String assignmentId) {

        User user = getOrCreateUser(jwt);

        return repository
                .findByUser_IdAndCourseIdAndAssignmentId(
                        user.getId(), courseId, assignmentId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}

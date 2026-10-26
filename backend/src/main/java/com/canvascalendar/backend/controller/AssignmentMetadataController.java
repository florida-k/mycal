package com.canvascalendar.backend.controller;

import com.canvascalendar.backend.model.AssignmentMetadata;
import com.canvascalendar.backend.model.User;
import com.canvascalendar.backend.repository.AssignmentMetadataRepository;
import com.canvascalendar.backend.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users/{userId}/assignments")
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

    @PutMapping("/{courseId}/{assignmentId}")
    public MetadataResponse updateMetadata(
            @PathVariable Long userId,
            @PathVariable String courseId,
            @PathVariable String assignmentId,
            @RequestBody MetadataRequest request) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        AssignmentMetadata saved = repository
                .findByUser_IdAndCourseIdAndAssignmentId(
                        userId, courseId, assignmentId)
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
            @PathVariable Long userId,
            @PathVariable String courseId,
            @PathVariable String assignmentId) {

        return repository
                .findByUser_IdAndCourseIdAndAssignmentId(
                        userId, courseId, assignmentId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
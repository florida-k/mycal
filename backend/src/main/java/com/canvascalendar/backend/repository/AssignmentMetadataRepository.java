package com.canvascalendar.backend.repository;

import com.canvascalendar.backend.model.AssignmentMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AssignmentMetadataRepository
        extends JpaRepository<AssignmentMetadata, Long> {

    Optional<AssignmentMetadata>
        findByUser_IdAndCourseIdAndAssignmentId(
                Long userId,
                String courseId,
                String assignmentId
        );
}
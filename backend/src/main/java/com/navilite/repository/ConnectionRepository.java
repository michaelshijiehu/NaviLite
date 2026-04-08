package com.navilite.repository;

import com.navilite.model.ConnectionInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConnectionRepository extends JpaRepository<ConnectionInfo, String> {
}

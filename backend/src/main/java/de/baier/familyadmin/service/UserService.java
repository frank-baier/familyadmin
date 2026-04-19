package de.baier.familyadmin.service;

import de.baier.familyadmin.model.Role;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    @Transactional
    public User createUser(String name, String email, String rawPassword, Role role) {
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered: " + email);
        }
        User user = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .role(role)
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public void updateRefreshJti(UUID userId, String jti) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setRefreshJti(jti);
            userRepository.save(user);
        });
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public User findById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
    }

    @Transactional
    public User updateUser(UUID id, String name, String email, Role role, String whatsappPhone) {
        User user = findById(id);
        if (!user.getEmail().equals(email) && userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already in use: " + email);
        }
        user.setName(name);
        user.setEmail(email);
        user.setRole(role);
        user.setWhatsappPhone(whatsappPhone);
        return userRepository.save(user);
    }

    @Transactional
    public User updateProfile(UUID id, String name, String whatsappPhone) {
        User user = findById(id);
        user.setName(name);
        user.setWhatsappPhone(whatsappPhone);
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new IllegalArgumentException("User not found: " + id);
        }
        userRepository.deleteById(id);
    }

    @Transactional
    public void resetPassword(UUID id, String newPassword) {
        User user = findById(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setRefreshJti(null); // invalidate any existing sessions
        userRepository.save(user);
    }
}

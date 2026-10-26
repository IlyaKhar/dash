package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"oksei-tdl/internal/auth"
	"oksei-tdl/internal/models"
)

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	role := strings.TrimSpace(r.URL.Query().Get("role"))
	if role != "" && !models.ValidRole(role) {
		writeError(w, http.StatusBadRequest, "неизвестная роль")
		return
	}
	users, err := s.st.ListUsers(r.Context(), r.URL.Query().Get("q"), role)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleAdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if !decodeBody(w, r, &in) {
		return
	}

	email, ok := normalizeEmail(in.Email)
	if !ok {
		writeError(w, http.StatusBadRequest, "укажите корректный email")
		return
	}
	if in.Role == "" {
		in.Role = models.RoleLab
	}
	if !models.ValidRole(in.Role) {
		writeError(w, http.StatusBadRequest, "роль должна быть lab или admin")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = email
	}

	user, err := s.st.CreateUser(r.Context(), email, name, hash, in.Role)
	if err != nil {
		writeStoreError(w, err)
		return
	}

	actor := userFrom(r.Context())
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, "user.create", user.ID, user.Email,
		fmt.Sprintf("роль: %s", user.Role))
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) handleAdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	email, valid := normalizeEmail(in.Email)
	if !valid {
		writeError(w, http.StatusBadRequest, "укажите корректный email")
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "имя не может быть пустым")
		return
	}

	user, err := s.st.UpdateUserByAdmin(r.Context(), id, in.Name, email)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	actor := userFrom(r.Context())
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, "user.update", user.ID, user.Email, "изменены имя/email")
	writeJSON(w, http.StatusOK, user)
}

// handleAdminSetRole — ключевая операция админ-панели: смена роли пользователя.
func (s *Server) handleAdminSetRole(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Role string `json:"role"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	if !models.ValidRole(in.Role) {
		writeError(w, http.StatusBadRequest, "роль должна быть lab или admin")
		return
	}

	actor := userFrom(r.Context())
	if actor.ID == id && in.Role != models.RoleAdmin {
		writeError(w, http.StatusConflict, "нельзя снять права администратора с самого себя")
		return
	}

	user, err := s.st.SetRole(r.Context(), id, in.Role)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, "user.role", user.ID, user.Email,
		fmt.Sprintf("новая роль: %s", user.Role))
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleAdminSetActive(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		IsActive bool `json:"is_active"`
	}
	if !decodeBody(w, r, &in) {
		return
	}

	actor := userFrom(r.Context())
	if actor.ID == id && !in.IsActive {
		writeError(w, http.StatusConflict, "нельзя заблокировать самого себя")
		return
	}

	user, err := s.st.SetActive(r.Context(), id, in.IsActive)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	action := "user.unblock"
	if !in.IsActive {
		action = "user.block"
	}
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, action, user.ID, user.Email, "")
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleAdminResetPassword(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.st.UpdatePassword(r.Context(), id, hash); err != nil {
		writeStoreError(w, err)
		return
	}

	actor := userFrom(r.Context())
	target, _ := s.st.UserByID(r.Context(), id)
	email := ""
	if target != nil {
		email = target.Email
	}
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, "user.password", id, email, "пароль сброшен администратором")
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	actor := userFrom(r.Context())
	if actor.ID == id {
		writeError(w, http.StatusConflict, "нельзя удалить свою учётную запись")
		return
	}

	target, err := s.st.UserByID(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if err := s.st.DeleteUser(r.Context(), id); err != nil {
		writeStoreError(w, err)
		return
	}
	s.st.AddAudit(r.Context(), actor.ID, actor.Email, "user.delete", "", target.Email, "вместе со всеми задачами")
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.st.Stats(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAdminAudit(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, err := s.st.ListAudit(r.Context(), limit)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

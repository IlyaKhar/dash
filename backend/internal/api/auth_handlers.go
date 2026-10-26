package api

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"oksei-tdl/internal/auth"
	"oksei-tdl/internal/models"
	"oksei-tdl/internal/store"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func normalizeEmail(raw string) (string, bool) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if _, err := mail.ParseAddress(email); err != nil {
		return "", false
	}
	return email, true
}

// handleRegister создаёт нового лаборанта. Роль admin выдаёт только администратор.
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.AllowRegistration {
		writeError(w, http.StatusForbidden, "регистрация закрыта, обратитесь к администратору")
		return
	}

	var in credentials
	if !decodeBody(w, r, &in) {
		return
	}

	email, ok := normalizeEmail(in.Email)
	if !ok {
		writeError(w, http.StatusBadRequest, "укажите корректный email")
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

	user, err := s.st.CreateUser(r.Context(), email, name, hash, models.RoleLab)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "пользователь с таким email уже зарегистрирован")
			return
		}
		writeStoreError(w, err)
		return
	}

	// Стартовый набор папок, чтобы интерфейс не был пустым.
	for _, f := range []string{"Лаборатория", "Личное"} {
		_, _ = s.st.CreateFolder(r.Context(), user.ID, f)
	}

	s.startSession(w, r, user)
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.limit.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "слишком много попыток входа, попробуйте через минуту")
		return
	}

	var in credentials
	if !decodeBody(w, r, &in) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(in.Email))
	user, err := s.st.UserByEmail(r.Context(), email)
	if err != nil || !auth.CheckPassword(user.PasswordHash, in.Password) {
		writeError(w, http.StatusUnauthorized, "неверный email или пароль")
		return
	}
	if !user.IsActive {
		writeError(w, http.StatusForbidden, "доступ заблокирован администратором")
		return
	}

	s.startSession(w, r, user)
	_ = s.st.TouchLogin(r.Context(), user.ID)
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, user *models.User) {
	token, expires, err := s.tok.Issue(user.ID, user.Role)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.tok.SetCookie(w, token, expires)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.tok.ClearCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, userFrom(r.Context()))
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "имя не может быть пустым")
		return
	}
	user, err := s.st.UpdateOwnProfile(r.Context(), userFrom(r.Context()).ID, in.Name)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if !decodeBody(w, r, &in) {
		return
	}

	user := userFrom(r.Context())
	if !auth.CheckPassword(user.PasswordHash, in.Current) {
		writeError(w, http.StatusBadRequest, "текущий пароль неверен")
		return
	}
	hash, err := auth.HashPassword(in.New)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.st.UpdatePassword(r.Context(), user.ID, hash); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

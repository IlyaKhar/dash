package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"oksei-tdl/internal/auth"
	"oksei-tdl/internal/config"
	"oksei-tdl/internal/store"
)

type Server struct {
	cfg   *config.Config
	st    *store.Store
	tok   *auth.Manager
	mux   *http.ServeMux
	limit *rateLimiter
}

func New(cfg *config.Config, st *store.Store) *Server {
	s := &Server{
		cfg:   cfg,
		st:    st,
		tok:   auth.NewManager(cfg.JWTSecret, cfg.TokenTTL, cfg.CookieName, cfg.CookieSecure, cfg.CookieDomain),
		mux:   http.NewServeMux(),
		limit: newRateLimiter(10, time.Minute),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return recoverMW(logMW(s.corsMW(s.mux)))
}

func (s *Server) routes() {
	m := s.mux

	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Публичные настройки, нужные экрану входа.
	m.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"allow_registration": s.cfg.AllowRegistration})
	})

	// Аутентификация
	m.HandleFunc("POST /api/auth/register", s.handleRegister)
	m.HandleFunc("POST /api/auth/login", s.handleLogin)
	m.HandleFunc("POST /api/auth/logout", s.handleLogout)
	m.Handle("GET /api/auth/me", s.authed(s.handleMe))
	m.Handle("PATCH /api/auth/me", s.authed(s.handleUpdateMe))
	m.Handle("POST /api/auth/password", s.authed(s.handleChangePassword))

	// Папки
	m.Handle("GET /api/folders", s.authed(s.handleListFolders))
	m.Handle("POST /api/folders", s.authed(s.handleCreateFolder))
	m.Handle("PATCH /api/folders/{id}", s.authed(s.handleRenameFolder))
	m.Handle("DELETE /api/folders/{id}", s.authed(s.handleDeleteFolder))

	// Задачи
	m.Handle("GET /api/tasks", s.authed(s.handleListTasks))
	m.Handle("POST /api/tasks", s.authed(s.handleCreateTask))
	m.Handle("GET /api/tasks/counters", s.authed(s.handleCounters))
	m.Handle("GET /api/tasks/{id}", s.authed(s.handleGetTask))
	m.Handle("PATCH /api/tasks/{id}", s.authed(s.handleUpdateTask))
	m.Handle("DELETE /api/tasks/{id}", s.authed(s.handleDeleteTask))
	m.Handle("GET /api/tasks/{id}/comments", s.authed(s.handleListComments))
	m.Handle("POST /api/tasks/{id}/comments", s.authed(s.handleCreateComment))
	m.Handle("PATCH /api/comments/{id}", s.authed(s.handleUpdateComment))
	m.Handle("DELETE /api/comments/{id}", s.authed(s.handleDeleteComment))

	// Админ-панель
	m.Handle("GET /api/admin/users", s.adminOnly(s.handleAdminListUsers))
	m.Handle("POST /api/admin/users", s.adminOnly(s.handleAdminCreateUser))
	m.Handle("PATCH /api/admin/users/{id}", s.adminOnly(s.handleAdminUpdateUser))
	m.Handle("PUT /api/admin/users/{id}/role", s.adminOnly(s.handleAdminSetRole))
	m.Handle("PUT /api/admin/users/{id}/active", s.adminOnly(s.handleAdminSetActive))
	m.Handle("POST /api/admin/users/{id}/password", s.adminOnly(s.handleAdminResetPassword))
	m.Handle("DELETE /api/admin/users/{id}", s.adminOnly(s.handleAdminDeleteUser))
	m.Handle("GET /api/admin/stats", s.adminOnly(s.handleAdminStats))
	m.Handle("GET /api/admin/audit", s.adminOnly(s.handleAdminAudit))

	// Статика собранного фронтенда (если STATIC_DIR задан)
	if s.cfg.StaticDir != "" {
		m.Handle("/", s.spaHandler(s.cfg.StaticDir))
	}
}

// spaHandler отдаёт файлы SPA, а на неизвестные пути — index.html.
func (s *Server) spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "маршрут не найден")
			return
		}
		clean := filepath.Join(dir, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(clean); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, index)
	})
}

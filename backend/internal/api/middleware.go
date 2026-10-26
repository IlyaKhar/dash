package api

import (
	"context"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"oksei-tdl/internal/models"
)

type ctxKey string

const userCtxKey ctxKey = "user"

func userFrom(ctx context.Context) *models.User {
	u, _ := ctx.Value(userCtxKey).(*models.User)
	return u
}

// authed проверяет сессию и кладёт пользователя в контекст.
func (s *Server) authed(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := s.tok.TokenFromRequest(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "нужна авторизация")
			return
		}
		claims, err := s.tok.Parse(token)
		if err != nil {
			s.tok.ClearCookie(w)
			writeError(w, http.StatusUnauthorized, "сессия истекла, войдите заново")
			return
		}
		// Всегда сверяемся с БД: роль могли изменить, а доступ — заблокировать.
		user, err := s.st.UserByID(r.Context(), claims.Subject)
		if err != nil {
			s.tok.ClearCookie(w)
			writeError(w, http.StatusUnauthorized, "пользователь не найден")
			return
		}
		if !user.IsActive {
			s.tok.ClearCookie(w)
			writeError(w, http.StatusForbidden, "доступ заблокирован администратором")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userCtxKey, user)))
	})
}

func (s *Server) adminOnly(next http.HandlerFunc) http.Handler {
	return s.authed(func(w http.ResponseWriter, r *http.Request) {
		if u := userFrom(r.Context()); u == nil || u.Role != models.RoleAdmin {
			writeError(w, http.StatusForbidden, "нужны права администратора")
			return
		}
		next(w, r)
	})
}

func (s *Server) corsMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, allowed := range s.cfg.AllowOrigins {
			if origin != "" && origin == allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
				w.Header().Set("Vary", "Origin")
				break
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func logMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start).Round(time.Millisecond))
	})
}

func recoverMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("api: паника: %v", rec)
				writeError(w, http.StatusInternalServerError, "внутренняя ошибка сервера")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// rateLimiter — простое ограничение попыток входа по IP.
type rateLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	limit  int
	window time.Duration
	lastGC time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{hits: make(map[string][]time.Time), limit: limit, window: window, lastGC: time.Now()}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	if now.Sub(rl.lastGC) > rl.window {
		for k, v := range rl.hits {
			if len(v) == 0 || now.Sub(v[len(v)-1]) > rl.window {
				delete(rl.hits, k)
			}
		}
		rl.lastGC = now
	}

	fresh := rl.hits[key][:0]
	for _, t := range rl.hits[key] {
		if now.Sub(t) <= rl.window {
			fresh = append(fresh, t)
		}
	}
	if len(fresh) >= rl.limit {
		rl.hits[key] = fresh
		return false
	}
	rl.hits[key] = append(fresh, now)
	return true
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		first, _, _ := strings.Cut(fwd, ",")
		return strings.TrimSpace(first)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

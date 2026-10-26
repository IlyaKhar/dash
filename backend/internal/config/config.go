package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config держит все настройки сервера, читаемые из переменных окружения.
type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     []byte
	TokenTTL      time.Duration
	CookieName    string
	CookieSecure  bool
	CookieDomain  string
	AllowOrigins  []string
	AdminEmail    string
	AdminPassword string
	StaticDir     string
	// AllowRegistration=false оставляет создание учёток только администратору.
	AllowRegistration bool
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", ""),
		TokenTTL:      envDuration("TOKEN_TTL", 720*time.Hour),
		CookieName:    env("COOKIE_NAME", "oksei_token"),
		CookieSecure:  envBool("COOKIE_SECURE", false),
		CookieDomain:  env("COOKIE_DOMAIN", ""),
		AdminEmail:    strings.ToLower(strings.TrimSpace(env("ADMIN_EMAIL", "admin@oksei.local"))),
		AdminPassword: env("ADMIN_PASSWORD", ""),
		StaticDir:     env("STATIC_DIR", ""),

		AllowRegistration: envBool("ALLOW_REGISTRATION", true),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL не задан")
	}

	secret := env("JWT_SECRET", "")
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET не задан")
	}
	if len(secret) < 16 {
		return nil, fmt.Errorf("JWT_SECRET слишком короткий, нужно минимум 16 символов")
	}
	cfg.JWTSecret = []byte(secret)

	if origins := env("ALLOWED_ORIGINS", ""); origins != "" {
		for _, o := range strings.Split(origins, ",") {
			if o = strings.TrimSpace(o); o != "" {
				cfg.AllowOrigins = append(cfg.AllowOrigins, o)
			}
		}
	}

	if cfg.AdminPassword == "" {
		log.Println("config: ADMIN_PASSWORD не задан — стартовый администратор не будет создан")
	}

	return cfg, nil
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	b, err := strconv.ParseBool(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return b
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	d, err := time.ParseDuration(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return d
}

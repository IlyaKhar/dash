package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"oksei-tdl/internal/store"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("api: не удалось записать ответ: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// writeStoreError переводит ошибки хранилища в HTTP-коды.
func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "не найдено")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "запись с такими данными уже существует")
	case errors.Is(err, store.ErrLastAdmin):
		writeError(w, http.StatusConflict, "нельзя оставить систему без активного администратора")
	case errors.Is(err, store.ErrForbidden):
		writeError(w, http.StatusForbidden, "недостаточно прав")
	case errors.Is(err, store.ErrBadRequest):
		writeError(w, http.StatusBadRequest, "некорректные данные")
	default:
		log.Printf("api: внутренняя ошибка: %v", err)
		writeError(w, http.StatusInternalServerError, "внутренняя ошибка сервера")
	}
}

func decodeBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "некорректный JSON: "+err.Error())
		return false
	}
	return true
}

// pathUUID достаёт и валидирует UUID из шаблона маршрута.
func pathUUID(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	raw := strings.TrimSpace(r.PathValue(name))
	if _, err := uuid.Parse(raw); err != nil {
		writeError(w, http.StatusNotFound, "не найдено")
		return "", false
	}
	return raw, true
}

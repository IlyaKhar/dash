package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"oksei-tdl/internal/models"
	"oksei-tdl/internal/store"
)

func (s *Server) handleListFolders(w http.ResponseWriter, r *http.Request) {
	folders, err := s.st.ListFolders(r.Context(), userFrom(r.Context()).ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, folders)
}

func (s *Server) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len([]rune(name)) > 60 {
		writeError(w, http.StatusBadRequest, "название папки: от 1 до 60 символов")
		return
	}
	folder, err := s.st.CreateFolder(r.Context(), userFrom(r.Context()).ID, name)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, folder)
}

func (s *Server) handleRenameFolder(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &in) {
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len([]rune(name)) > 60 {
		writeError(w, http.StatusBadRequest, "название папки: от 1 до 60 символов")
		return
	}
	folder, err := s.st.RenameFolder(r.Context(), userFrom(r.Context()).ID, id, name)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, folder)
}

func (s *Server) handleDeleteFolder(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if err := s.st.DeleteFolder(r.Context(), userFrom(r.Context()).ID, id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := store.TaskFilter{
		Scope: q.Get("scope"),
		Query: q.Get("q"),
	}
	if folder := strings.TrimSpace(q.Get("folder")); folder != "" {
		if _, err := uuid.Parse(folder); err != nil {
			writeError(w, http.StatusBadRequest, "некорректный идентификатор папки")
			return
		}
		filter.Scope = "folder"
		filter.FolderID = folder
	}

	tasks, err := s.st.ListTasks(r.Context(), userFrom(r.Context()).ID, filter)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (s *Server) handleCounters(w http.ResponseWriter, r *http.Request) {
	counters, err := s.st.TaskCounters(r.Context(), userFrom(r.Context()).ID)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, counters)
}

type taskInput struct {
	FolderID *string `json:"folder_id"`
	Title    *string `json:"title"`
	Body     *string `json:"body"`
	Done     *bool   `json:"done"`
	Pinned   *bool   `json:"pinned"`
	DueAt    *string `json:"due_at"`
}

func parseDue(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return &t, nil
		}
	}
	return nil, errBadDate
}

var errBadDate = errors.New("некорректная дата: ожидается 2006-01-02, 2006-01-02T15:04 или RFC3339")

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	var in taskInput
	if !decodeBody(w, r, &in) {
		return
	}

	var folderID *string
	if in.FolderID != nil && strings.TrimSpace(*in.FolderID) != "" {
		if _, err := uuid.Parse(*in.FolderID); err != nil {
			writeError(w, http.StatusBadRequest, "некорректный идентификатор папки")
			return
		}
		folderID = in.FolderID
	}

	title, body := "", ""
	if in.Title != nil {
		title = strings.TrimSpace(*in.Title)
	}
	if in.Body != nil {
		body = *in.Body
	}
	if len([]rune(title)) > 200 {
		writeError(w, http.StatusBadRequest, "заголовок не длиннее 200 символов")
		return
	}

	var due *time.Time
	if in.DueAt != nil {
		parsed, err := parseDue(*in.DueAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		due = parsed
	}

	pinned := in.Pinned != nil && *in.Pinned

	task, err := s.st.CreateTask(r.Context(), userFrom(r.Context()).ID, folderID, title, body, due, pinned)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	task, err := s.st.TaskByIDAny(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleUpdateTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}

	current, err := s.st.TaskByIDAny(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	actor := userFrom(r.Context())
	if !canManageTask(actor, current) {
		writeError(w, http.StatusForbidden, "редактировать заметку может только автор или администратор")
		return
	}

	var in taskInput
	if !decodeBody(w, r, &in) {
		return
	}

	patch := store.TaskPatch{Done: in.Done, Pinned: in.Pinned, Body: in.Body}

	if in.Title != nil {
		title := strings.TrimSpace(*in.Title)
		if len([]rune(title)) > 200 {
			writeError(w, http.StatusBadRequest, "заголовок не длиннее 200 символов")
			return
		}
		patch.Title = &title
	}

	if in.FolderID != nil {
		var target *string
		if trimmed := strings.TrimSpace(*in.FolderID); trimmed != "" {
			if _, err := uuid.Parse(trimmed); err != nil {
				writeError(w, http.StatusBadRequest, "некорректный идентификатор папки")
				return
			}
			target = &trimmed
		}
		patch.FolderID = &target
	}

	if in.DueAt != nil {
		due, err := parseDue(*in.DueAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		patch.DueAt = &due
	}

	task, err := s.st.UpdateTask(r.Context(), current.OwnerID, id, patch)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	current, err := s.st.TaskByIDAny(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	actor := userFrom(r.Context())
	if !canManageTask(actor, current) {
		writeError(w, http.StatusForbidden, "удалить заметку может только автор или администратор")
		return
	}
	if err := s.st.DeleteTask(r.Context(), current.OwnerID, id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func canManageTask(user *models.User, task *models.Task) bool {
	return user != nil && task != nil && (user.ID == task.OwnerID || user.Role == models.RoleAdmin)
}

package api

import (
	"errors"
	"net/http"

	"oksei-tdl/internal/store"
)

func (s *Server) handleListComments(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if _, err := s.st.TaskByIDAny(r.Context(), id); err != nil {
		writeStoreError(w, err)
		return
	}
	comments, err := s.st.ListComments(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, comments)
}

func (s *Server) handleCreateComment(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	if !decodeBody(w, r, &in) {
		return
	}

	comment, err := s.st.CreateComment(r.Context(), id, userFrom(r.Context()).ID, in.Body)
	if err != nil {
		if errors.Is(err, store.ErrBadRequest) {
			writeError(w, http.StatusBadRequest, "комментарий: от 1 до 2000 символов")
			return
		}
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

func (s *Server) handleUpdateComment(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	if !decodeBody(w, r, &in) {
		return
	}

	comment, err := s.st.UpdateComment(r.Context(), id, userFrom(r.Context()).ID, in.Body)
	if err != nil {
		if errors.Is(err, store.ErrBadRequest) {
			writeError(w, http.StatusBadRequest, "комментарий: от 1 до 2000 символов")
			return
		}
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, comment)
}

func (s *Server) handleDeleteComment(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	actor := userFrom(r.Context())
	if err := s.st.DeleteComment(r.Context(), id, actor.ID, actor.Role); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

package store

import (
	"context"
	"strings"
	"unicode/utf8"

	"oksei-tdl/internal/models"
)

const MaxCommentLen = 2000

const commentSelect = `
	c.id, c.task_id, c.user_id,
	COALESCE(NULLIF(u.name, ''), u.email),
	u.email, c.body, c.created_at, c.updated_at`

func (s *Store) ListComments(ctx context.Context, taskID string) ([]models.Comment, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+commentSelect+`
		FROM comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.task_id = $1
		ORDER BY c.created_at`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Comment, 0, 16)
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.TaskID, &c.AuthorID, &c.AuthorName, &c.AuthorEmail,
			&c.Body, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateComment(ctx context.Context, taskID, userID, body string) (*models.Comment, error) {
	body, err := normalizeComment(body)
	if err != nil {
		return nil, err
	}

	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM tasks WHERE id = $1)`, taskID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	var id string
	if err := s.pool.QueryRow(ctx,
		`INSERT INTO comments (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING id`,
		taskID, userID, body).Scan(&id); err != nil {
		return nil, err
	}
	return s.commentByID(ctx, id)
}

func (s *Store) UpdateComment(ctx context.Context, commentID, authorID, body string) (*models.Comment, error) {
	body, err := normalizeComment(body)
	if err != nil {
		return nil, err
	}
	tag, err := s.pool.Exec(ctx,
		`UPDATE comments SET body = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
		commentID, authorID, body)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.commentByID(ctx, commentID)
}

// DeleteComment разрешён автору, владельцу заметки или администратору.
func (s *Store) DeleteComment(ctx context.Context, commentID, actorID, actorRole string) error {
	var authorID, ownerID string
	err := s.pool.QueryRow(ctx, `
		SELECT c.user_id, t.user_id
		FROM comments c JOIN tasks t ON t.id = c.task_id
		WHERE c.id = $1`, commentID).Scan(&authorID, &ownerID)
	if err != nil {
		return wrapNotFound(err)
	}

	allowed := actorID == authorID || actorID == ownerID || actorRole == models.RoleAdmin
	if !allowed {
		return ErrForbidden
	}

	_, err = s.pool.Exec(ctx, `DELETE FROM comments WHERE id = $1`, commentID)
	return err
}

func (s *Store) commentByID(ctx context.Context, id string) (*models.Comment, error) {
	var c models.Comment
	err := s.pool.QueryRow(ctx,
		`SELECT `+commentSelect+` FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`, id).
		Scan(&c.ID, &c.TaskID, &c.AuthorID, &c.AuthorName, &c.AuthorEmail, &c.Body, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &c, nil
}

func normalizeComment(raw string) (string, error) {
	body := strings.TrimSpace(raw)
	if body == "" {
		return "", ErrBadRequest
	}
	if utf8.RuneCountInString(body) > MaxCommentLen {
		return "", ErrBadRequest
	}
	return body, nil
}

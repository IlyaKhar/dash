package store

import (
	"context"
	"strings"

	"oksei-tdl/internal/models"
)

func (s *Store) ListFolders(ctx context.Context, userID string) ([]models.Folder, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT f.id, f.name, f.position, f.created_at,
		       COALESCE(t.total, 0), COALESCE(t.open, 0)
		FROM folders f
		LEFT JOIN (
		    SELECT folder_id, count(*) AS total, count(*) FILTER (WHERE NOT done) AS open
		    FROM tasks WHERE user_id = $1 GROUP BY folder_id
		) t ON t.folder_id = f.id
		WHERE f.user_id = $1
		ORDER BY f.position, f.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Folder, 0, 8)
	for rows.Next() {
		var f models.Folder
		if err := rows.Scan(&f.ID, &f.Name, &f.Position, &f.CreatedAt, &f.Total, &f.Open); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Store) CreateFolder(ctx context.Context, userID, name string) (*models.Folder, error) {
	var f models.Folder
	err := s.pool.QueryRow(ctx, `
		INSERT INTO folders (user_id, name, position)
		VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM folders WHERE user_id = $1), 0))
		RETURNING id, name, position, created_at`, userID, strings.TrimSpace(name)).
		Scan(&f.ID, &f.Name, &f.Position, &f.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return &f, nil
}

func (s *Store) RenameFolder(ctx context.Context, userID, id, name string) (*models.Folder, error) {
	var f models.Folder
	err := s.pool.QueryRow(ctx, `
		UPDATE folders SET name = $3 WHERE id = $2 AND user_id = $1
		RETURNING id, name, position, created_at`, userID, id, strings.TrimSpace(name)).
		Scan(&f.ID, &f.Name, &f.Position, &f.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, wrapNotFound(err)
	}
	return &f, nil
}

// DeleteFolder удаляет папку; задачи из неё остаются, но теряют папку.
func (s *Store) DeleteFolder(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM folders WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

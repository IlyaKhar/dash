package store

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"oksei-tdl/internal/models"
)

const taskSelect = `
	t.id, t.user_id, COALESCE(NULLIF(u.name, ''), u.email), t.folder_id,
	t.title, t.body, t.done, t.pinned, t.due_at,
	COALESCE(c.cnt, 0), t.created_at, t.updated_at`

const taskFrom = `
	FROM tasks t
	JOIN users u ON u.id = t.user_id
	LEFT JOIN (
	    SELECT task_id, count(*) AS cnt FROM comments GROUP BY task_id
	) c ON c.task_id = t.id`

func scanTask(row pgx.Row) (*models.Task, error) {
	var t models.Task
	err := row.Scan(&t.ID, &t.OwnerID, &t.OwnerName, &t.FolderID, &t.Title, &t.Body,
		&t.Done, &t.Pinned, &t.DueAt, &t.CommentsCount, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &t, nil
}

func scanTaskRows(rows pgx.Rows) ([]models.Task, error) {
	defer rows.Close()
	out := make([]models.Task, 0, 32)
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.OwnerID, &t.OwnerName, &t.FolderID, &t.Title, &t.Body,
			&t.Done, &t.Pinned, &t.DueAt, &t.CommentsCount, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// TaskFilter описывает выборку задач для списка.
type TaskFilter struct {
	Scope    string // all | today | done | pinned | overdue | folder | lab
	FolderID string
	Query    string
}

// TaskPatch — частичное обновление: nil означает «не менять».
type TaskPatch struct {
	Title    *string
	Body     *string
	Done     *bool
	Pinned   *bool
	FolderID **string    // двойной указатель: позволяет выставить NULL
	DueAt    **time.Time // то же самое для срока
}

func (s *Store) ListTasks(ctx context.Context, userID string, f TaskFilter) ([]models.Task, error) {
	sql := `SELECT ` + taskSelect + taskFrom
	args := make([]any, 0, 3)

	if f.Scope == "lab" {
		sql += ` WHERE true`
	} else {
		args = append(args, userID)
		sql += ` WHERE t.user_id = $` + itoa(len(args))
	}

	switch f.Scope {
	case "folder":
		args = append(args, f.FolderID)
		sql += ` AND t.folder_id = $` + itoa(len(args))
	case "today":
		sql += ` AND NOT t.done AND t.due_at IS NOT NULL AND t.due_at < (now()::date + interval '1 day')`
	case "done":
		sql += ` AND t.done`
	case "pinned":
		sql += ` AND t.pinned`
	case "overdue":
		sql += ` AND NOT t.done AND t.due_at < now()`
	case "lab":
		// Общая лента лаборатории: чужие и свои заметки, выполненные внизу.
	default: // all
		sql += ` AND NOT t.done`
	}

	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, q)
		ph := `$` + itoa(len(args))
		sql += ` AND (t.title ILIKE '%' || ` + ph + ` || '%' OR t.body ILIKE '%' || ` + ph + ` || '%')`
	}

	sql += ` ORDER BY t.pinned DESC, t.done, t.updated_at DESC`

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return scanTaskRows(rows)
}

func (s *Store) TaskByID(ctx context.Context, userID, id string) (*models.Task, error) {
	return scanTask(s.pool.QueryRow(ctx,
		`SELECT `+taskSelect+taskFrom+` WHERE t.id = $1 AND t.user_id = $2`, id, userID))
}

// TaskByIDAny отдаёт заметку любому авторизованному сотруднику (для комментариев).
func (s *Store) TaskByIDAny(ctx context.Context, id string) (*models.Task, error) {
	return scanTask(s.pool.QueryRow(ctx, `SELECT `+taskSelect+taskFrom+` WHERE t.id = $1`, id))
}

func (s *Store) CreateTask(ctx context.Context, userID string, folderID *string, title, body string, dueAt *time.Time, pinned bool) (*models.Task, error) {
	if folderID != nil {
		ok, err := s.folderBelongsTo(ctx, userID, *folderID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrNotFound
		}
	}

	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO tasks (user_id, folder_id, title, body, due_at, pinned)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		userID, folderID, title, body, dueAt, pinned).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.TaskByIDAny(ctx, id)
}

func (s *Store) UpdateTask(ctx context.Context, userID, id string, p TaskPatch) (*models.Task, error) {
	sets := make([]string, 0, 7)
	args := []any{id, userID}

	add := func(expr string, val any) {
		args = append(args, val)
		sets = append(sets, expr+" = $"+itoa(len(args)))
	}

	if p.Title != nil {
		add("title", *p.Title)
	}
	if p.Body != nil {
		add("body", *p.Body)
	}
	if p.Done != nil {
		add("done", *p.Done)
	}
	if p.Pinned != nil {
		add("pinned", *p.Pinned)
	}
	if p.FolderID != nil {
		if *p.FolderID != nil {
			ok, err := s.folderBelongsTo(ctx, userID, **p.FolderID)
			if err != nil {
				return nil, err
			}
			if !ok {
				return nil, ErrNotFound
			}
		}
		add("folder_id", *p.FolderID)
	}
	if p.DueAt != nil {
		add("due_at", *p.DueAt)
	}

	if len(sets) == 0 {
		return s.TaskByID(ctx, userID, id)
	}
	sets = append(sets, "updated_at = now()")

	tag, err := s.pool.Exec(ctx,
		`UPDATE tasks SET `+strings.Join(sets, ", ")+` WHERE id = $1 AND user_id = $2`, args...)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.TaskByIDAny(ctx, id)
}

func (s *Store) DeleteTask(ctx context.Context, userID, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// TaskCounters — счётчики для системных разделов сайдбара.
type TaskCounters struct {
	All     int `json:"all"`
	Today   int `json:"today"`
	Done    int `json:"done"`
	Pinned  int `json:"pinned"`
	Overdue int `json:"overdue"`
	Inbox   int `json:"inbox"`
	Lab     int `json:"lab"`
}

func (s *Store) TaskCounters(ctx context.Context, userID string) (*TaskCounters, error) {
	var c TaskCounters
	err := s.pool.QueryRow(ctx, `
		SELECT
		  count(*) FILTER (WHERE user_id = $1 AND NOT done),
		  count(*) FILTER (WHERE user_id = $1 AND NOT done AND due_at IS NOT NULL AND due_at < (now()::date + interval '1 day')),
		  count(*) FILTER (WHERE user_id = $1 AND done),
		  count(*) FILTER (WHERE user_id = $1 AND pinned),
		  count(*) FILTER (WHERE user_id = $1 AND NOT done AND due_at < now()),
		  count(*) FILTER (WHERE user_id = $1 AND NOT done AND folder_id IS NULL),
		  count(*) FILTER (WHERE NOT done)
		FROM tasks`, userID).
		Scan(&c.All, &c.Today, &c.Done, &c.Pinned, &c.Overdue, &c.Inbox, &c.Lab)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) folderBelongsTo(ctx context.Context, userID, folderID string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM folders WHERE id = $1 AND user_id = $2)`, folderID, userID).Scan(&ok)
	return ok, err
}

func itoa(i int) string { return strconv.Itoa(i) }

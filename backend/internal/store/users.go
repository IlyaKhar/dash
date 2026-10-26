package store

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"

	"oksei-tdl/internal/models"
)

const userCols = `id, email, name, password_hash, role, is_active, last_login_at, created_at, updated_at`

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, wrapNotFound(err)
	}
	return &u, nil
}

func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash, role string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	u, err := scanUser(s.pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING `+userCols,
		email, strings.TrimSpace(name), passwordHash, role))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return u, nil
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE email = $1`, email))
}

func (s *Store) UserByID(ctx context.Context, id string) (*models.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id))
}

func (s *Store) TouchLogin(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, id)
	return err
}

func (s *Store) UpdateOwnProfile(ctx context.Context, id, name string) (*models.User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING `+userCols,
		id, strings.TrimSpace(name)))
}

func (s *Store) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListUsers возвращает пользователей со счётчиками задач (для админ-панели).
func (s *Store) ListUsers(ctx context.Context, query, roleFilter string) ([]models.UserWithStats, error) {
	sql := `
		SELECT u.id, u.email, u.name, u.password_hash, u.role, u.is_active, u.last_login_at, u.created_at, u.updated_at,
		       COALESCE(t.total, 0), COALESCE(t.open, 0)
		FROM users u
		LEFT JOIN (
		    SELECT user_id, count(*) AS total, count(*) FILTER (WHERE NOT done) AS open
		    FROM tasks GROUP BY user_id
		) t ON t.user_id = u.id
		WHERE ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%')
		  AND ($2 = '' OR u.role = $2)
		ORDER BY u.role DESC, u.created_at`

	rows, err := s.pool.Query(ctx, sql, strings.TrimSpace(query), roleFilter)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.UserWithStats, 0, 32)
	for rows.Next() {
		var u models.UserWithStats
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.IsActive,
			&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt, &u.TasksTotal, &u.TasksOpen); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// SetRole меняет роль пользователя, не позволяя остаться без администраторов.
func (s *Store) SetRole(ctx context.Context, id, role string) (*models.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := scanUser(tx.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}
	if current.Role == models.RoleAdmin && role != models.RoleAdmin {
		if err := ensureAnotherAdminExists(ctx, tx, id); err != nil {
			return nil, err
		}
	}

	u, err := scanUser(tx.QueryRow(ctx,
		`UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING `+userCols, id, role))
	if err != nil {
		return nil, err
	}
	return u, tx.Commit(ctx)
}

// SetActive блокирует или разблокирует пользователя.
func (s *Store) SetActive(ctx context.Context, id string, active bool) (*models.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := scanUser(tx.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}
	if current.Role == models.RoleAdmin && !active {
		if err := ensureAnotherAdminExists(ctx, tx, id); err != nil {
			return nil, err
		}
	}

	u, err := scanUser(tx.QueryRow(ctx,
		`UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING `+userCols, id, active))
	if err != nil {
		return nil, err
	}
	return u, tx.Commit(ctx)
}

func (s *Store) UpdateUserByAdmin(ctx context.Context, id, name, email string) (*models.User, error) {
	u, err := scanUser(s.pool.QueryRow(ctx,
		`UPDATE users SET name = $2, email = $3, updated_at = now() WHERE id = $1 RETURNING `+userCols,
		id, strings.TrimSpace(name), strings.ToLower(strings.TrimSpace(email))))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return u, nil
}

func (s *Store) DeleteUser(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	current, err := scanUser(tx.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return err
	}
	if current.Role == models.RoleAdmin {
		if err := ensureAnotherAdminExists(ctx, tx, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func ensureAnotherAdminExists(ctx context.Context, tx pgx.Tx, exceptID string) error {
	var n int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM users WHERE role = 'admin' AND is_active AND id <> $1`, exceptID).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		return ErrLastAdmin
	}
	return nil
}

// EnsureAdmin создаёт стартового администратора при первом запуске.
func (s *Store) EnsureAdmin(ctx context.Context, email, passwordHash string) (created bool, err error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var exists bool
	if err = s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')`).Scan(&exists); err != nil {
		return false, err
	}
	if exists {
		return false, nil
	}
	if _, err = s.CreateUser(ctx, email, "Администратор", passwordHash, models.RoleAdmin); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) Stats(ctx context.Context) (*models.Stats, error) {
	var st models.Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM users),
		  (SELECT count(*) FROM users WHERE role = 'admin'),
		  (SELECT count(*) FROM users WHERE role = 'lab'),
		  (SELECT count(*) FROM users WHERE NOT is_active),
		  (SELECT count(*) FROM tasks),
		  (SELECT count(*) FROM tasks WHERE NOT done),
		  (SELECT count(*) FROM tasks WHERE NOT done AND due_at::date = now()::date),
		  (SELECT count(*) FROM tasks WHERE NOT done AND due_at < now()),
		  (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days'),
		  (SELECT count(*) FROM users WHERE last_login_at > now() - interval '7 days')`).
		Scan(&st.Users, &st.Admins, &st.Labs, &st.Blocked, &st.Tasks, &st.TasksOpen,
			&st.TasksToday, &st.Overdue, &st.NewUsers7d, &st.ActiveUsers)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *Store) AddAudit(ctx context.Context, actorID, actorEmail, action, targetID, targetEmail, details string) {
	var target any
	if targetID != "" {
		target = targetID
	}
	var actor any
	if actorID != "" {
		actor = actorID
	}
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO audit_log (actor_id, actor_email, action, target_id, target_email, details)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		actor, actorEmail, action, target, targetEmail, details); err != nil {
		// журнал не должен ломать основную операцию
		return
	}
}

func (s *Store) ListAudit(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, actor_email, action, target_id, target_email, details, created_at
		 FROM audit_log ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.AuditEntry, 0, limit)
	for rows.Next() {
		var e models.AuditEntry
		if err := rows.Scan(&e.ID, &e.ActorEmail, &e.Action, &e.TargetID, &e.TargetName, &e.Details, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
